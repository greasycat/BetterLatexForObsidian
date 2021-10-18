import CodeMirror, {off} from "codemirror";
import FuzzySearch from "./dist/FuzzySearch";
import {App, DataAdapter} from "obsidian";
import {COMMAND_ID, MODIFIER} from "./BetterLatexSetting";

const AUTOCOMPLETE_CLASS_TOKEN = {
    ITEM: 'tex-autocomplete-item',
    SELECTED_ITEM: 'tex-autocomplete-item-selected',
    MENU: 'tex-autocomplete-menu',
    ITEM_TEXT: 'tex-autocomplete-item-text',
}

interface Hotkey {
    modifiers: string;
    key: string;
}

export class TexAutoCompleteManager {
    activeInstanceIndex: number;
    texInstances: TexAutoComplete[];
    texInstanceCounter: number;
    menu: HTMLDivElement;
    dataTable: string[];
    app: App;

    constructor(app: App, dataTable: string[]) {
        this.texInstances = [];
        this.menu = TexAutoCompleteManager.initAutoCompleteMenu();
        this.app = app;
        this.texInstanceCounter = 0;
        this.dataTable = dataTable;
        this.activeInstanceIndex = 0;
    }

    public getActiveInstance() {
        return this.texInstances[this.activeInstanceIndex];
    }

    public setActiveInstance(activeInstanceIndex: number) {
        this.activeInstanceIndex = activeInstanceIndex;
        for (let i = 0; i != this.texInstances.length; ++i) {
            if (i != activeInstanceIndex) {
                this.getInstance(i).clearAndHideMenu();
            }
        }
    }

    public newInstance(cm: CodeMirror.Editor) {
        let tex = new TexAutoComplete(this, cm, this.menu, this.dataTable);
        this.texInstances.push(tex);
        return this.texInstanceCounter++;
    }

    public getInstance(i: number) {
        return this.texInstances[i];
    }

    private static initAutoCompleteMenu(): HTMLDivElement {
        console.log("init autocomplete menu")
        let autoCompleteMenu = document.createElement("div");
        autoCompleteMenu.classList.add("tex-autocomplete-menu");
        document.body.appendChild(autoCompleteMenu)
        return autoCompleteMenu;
    }

    public unload() {
        this.texInstances.forEach((instance) => {
            instance.clearAndHideMenu();
            instance.removeAllMenuItems();
            instance.editor.off("keyup", instance.update);
        })

        document.body.removeChild(this.menu);
    }

    public moveActiveInstanceNext() {
        if (this.texInstances[this.activeInstanceIndex] != undefined) {
            TexAutoComplete.selectNext(this.texInstances[this.activeInstanceIndex]);
        }
    }

    public moveActiveInstancePrevious() {
        if (this.texInstances[this.activeInstanceIndex] != undefined) {
            TexAutoComplete.selectPrevious(this.texInstances[this.activeInstanceIndex]);
        }
    }
}

export class TexAutoComplete {
    editor: CodeMirror.Editor;
    cursorPosition: {
        left: number;
        top: number;
        bottom: number;
    }
    autoCompleteMenu: HTMLDivElement;
    isHidden: boolean;
    currentItems: HTMLDivElement[];
    texDataTable: any;
    currentWord: string;
    currentSelectedItemIndex: number;
    currentSuggestion: string[];
    manager: TexAutoCompleteManager;
    lastKey: string


    constructor(manager: TexAutoCompleteManager, editor: CodeMirror.Editor, autoCompleteMenu: HTMLDivElement, texDataTable: any) {
        this.editor = editor;
        this.isHidden = true;
        this.autoCompleteMenu = autoCompleteMenu;
        this.currentItems = [];
        this.texDataTable = texDataTable;
        this.currentSelectedItemIndex = 0;
        this.manager = manager;
        this.lastKey = "";
    }

    private static checkModifierKey(event: KeyboardEvent, modifiers: string) {
        let list = modifiers.split(",");
        if (list.length == 0) {
            return false;
        }
        let boolList = []
        for (let i = 0; i != list.length; ++i) {
            switch (list[i]) {
                case "Ctrl":
                    boolList.push(event.ctrlKey);
                    break;
                case "Shift":
                    boolList.push(event.shiftKey);
                    break;
                case "Alt":
                    boolList.push(event.altKey);
                    break;
            }
        }

        let result = boolList[0];
        for (let i = 1; i != boolList.length; ++i) {
            result = result && boolList[i];
        }

        return result;

    }

    public isMoveSelectionHotkeyPressed(event: KeyboardEvent) {
        let result = false;

        let moveUp = TexAutoComplete.getHotkeyAssignmentByCommandId(this.manager.app, COMMAND_ID.moveUpHotkey);
        let moveDown = TexAutoComplete.getHotkeyAssignmentByCommandId(this.manager.app, COMMAND_ID.moveDownHotkey);

        return (TexAutoComplete.checkModifierKey(event, moveUp.modifiers) && event.key == moveUp.key) || (TexAutoComplete.checkModifierKey(event, moveDown.modifiers) && event.key == moveDown.key)

    }

    public update = (cm: CodeMirror.Editor, event: KeyboardEvent) => {
        this.updateCurrentWord();
        let doNotUpdate = false;


        if (MODIFIER.contains(event.key)) {
            doNotUpdate = true;
        }


        if (this.isMoveSelectionHotkeyPressed(event)) {
            this.replaceWordWithSelected();
            doNotUpdate = true;
        }


        if (event.key == 'Tab' && !this.isHidden) {
            this.replaceWordWithSelected();
            this.clearAndHideMenu();

            let selected = this.currentSuggestion[this.currentSelectedItemIndex];
            if (selected.startsWith("\\begin{")) {
                let end = "\\end{" + selected.substring(6, selected.length - 1) + "}";
                this.append(end);
                this.moveCursorOnTheLine(cm, -end.length);
            }
            doNotUpdate = true;
        }

        if (event.key == "/")
        {

        }


        if (event.key == '$') {
            if (this.lastKey != '\\') // prevent \$ completion
            {
                this.append("$")
                this.moveCursorOnTheLine(cm, -1);
            }
        }

        if (!doNotUpdate) {
            this.toggleAutoComplete();
        }
        this.changeSize();

        this.lastKey = event.key;
    }

    public moveCursorOnTheLine(editor: CodeMirror.Editor, offset: number) {
        let cursor = editor.getCursor();
        cursor.ch += offset;
        editor.setCursor(cursor);
    }

    public toggleAutoComplete() {
        if (this.currentWord != undefined) {
            console.log(this.currentWord)
            if (this.currentWord.startsWith("\\") && !this.currentWord.contains("$")) {

                this.removeAllMenuItems();
                this.showAutoComplete();
            } else if (this.currentWord == ' ' || this.currentWord == '' || !this.currentWord.startsWith("\\") || this.currentWord.contains("$")) {
                this.clearAndHideMenu();
            }
        }
    }


    public replaceWordWithSelected() {
        if (this.currentSuggestion != undefined && this.currentSuggestion.length >= this.currentSelectedItemIndex) {
            let begin = this.editor.getCursor();
            begin.ch -= this.currentWord.length;
            this.editor.replaceRange(this.currentSuggestion[this.currentSelectedItemIndex], begin, this.editor.getCursor(), this.currentWord);
            this.editor.replaceSelection("");
        }
    }

    public append(text: string) {
        this.editor.replaceRange(text, this.editor.getCursor());
    }

    public showAutoComplete() {
        console.log("Show AC");
        this.cursorPosition = this.editor.cursorCoords(true);
        let style = "left: " + this.cursorPosition.left + "px; top:" + (this.cursorPosition.top + 10) + "px;"
        this.autoCompleteMenu.setAttribute('style', style);
        this.currentSuggestion = this.getSuggestions();
        this.generateMenuItems(this.currentSuggestion);
        this.isHidden = false;
    }

    public clearAndHideMenu() {
        this.removeAllMenuItems();
        this.autoCompleteMenu.style.visibility = "hidden"
        this.isHidden = true;
    }

    public moveSelectedMenuItem(index: number) {
        if (this.currentItems != undefined && this.currentItems.length >= index + 1) {
            this.currentItems[this.currentSelectedItemIndex].classList.remove(AUTOCOMPLETE_CLASS_TOKEN.SELECTED_ITEM);
            this.currentItems[index].classList.add(AUTOCOMPLETE_CLASS_TOKEN.SELECTED_ITEM);
            this.currentSelectedItemIndex = index;
        }
    }

    public generateMenuItems(items: Array<string>) {
        if (this.currentItems == undefined) {
            this.currentItems = [];
        }

        items.forEach((item) => {
            let i = this.createAutoCompleteMenuItem(item);
            this.currentItems.push(i);
            this.autoCompleteMenu.appendChild(i);
        });

        if (this.currentItems.length >= 1) {
            this.currentItems[0].classList.add("tex-autocomplete-item-selected")
            this.currentSelectedItemIndex = 0;
        }
    }

    public removeAllMenuItems() {
        if (this.currentItems.length != 0) {
            this.currentItems.forEach((item) => {
                this.autoCompleteMenu.removeChild(item);

            })
        }

        this.currentItems = [];
    }

    public createAutoCompleteMenuItem(text: string): HTMLDivElement {
        let menuItem = document.createElement("div");
        menuItem.classList.add("tex-autocomplete-item")
        let span = document.createElement("span")
        span.setText(text);
        span.classList.add("tex-autocomplete-item-text");
        menuItem.append(span);
        return menuItem;
    }


    public getSuggestions() {
        let searcher = new FuzzySearch({source: this.texDataTable});
        // @ts-ignore
        let result = searcher.search(this.currentWord);
        return result.slice(0, 5);
    }

    public changeSize() {
        let bodyCss = document.body.style.cssText;
        let start = document.body.style.cssText.indexOf("font-size");
        let font = bodyCss.substr(start + 10, 4);

        if (this.currentItems != undefined && this.currentItems.length != 0) {
            this.currentItems.forEach((item) => {
                item.style.fontSize = font;
            })
        }

        this.autoCompleteMenu.style.marginTop = font;
    }


    public static async readTexTables(dataAdaptor: DataAdapter) {
        let data = await dataAdaptor.read("./.obsidian/plugins/BetterLatexForObsidian/data.csv");
        return data.split(",,,\r\n")
    }

    public updateCurrentWord() {
        let currentCursorPosition = this.editor.getCursor();
        let currentLineString = this.editor.getLine(currentCursorPosition.line);
        if (currentLineString[currentCursorPosition.ch - 1] == ' ') {
            this.currentWord = ' ';
        } else {
            let trimmedLineString = currentLineString.substr(0, currentCursorPosition.ch);

            let symbol = "`~!@#$%^&*()_+-={}|[]\\:\";\'<>?,./";

            let symbolList = [];
            for (let ch of symbol)
            {
                symbolList.push({symbol:ch, index:trimmedLineString.lastIndexOf(ch)});
            }

            symbolList.sort((a, b) => {
                return b.index - a.index
            })

            let correctWordStartIndex;

            correctWordStartIndex = symbolList[0].index == -1 ? 0 : symbolList[0].index;

            // if (lastBackSlashIndex != -1 && lastBackSlashIndex > lastSpaceIndex) {
            //     correctWordStartIndex = lastBackSlashIndex;
            // } else if (lastSpaceIndex != -1 && lastSpaceIndex > lastBackSlashIndex) {
            //     correctWordStartIndex = lastSpaceIndex;
            // } else {
            //     correctWordStartIndex = 0;
            // }

            this.currentWord = trimmedLineString.substring(correctWordStartIndex, trimmedLineString.length);
        }
    }

    /*
    Static Method Here
     */
    public static selectNext(instance: TexAutoComplete) {
        if (!instance.isHidden) {
            if (instance.currentSelectedItemIndex == instance.currentItems.length - 1) {
                instance.moveSelectedMenuItem(0);
            } else {
                instance.moveSelectedMenuItem(instance.currentSelectedItemIndex + 1);
            }
        }
    }

    public static selectPrevious(instance: TexAutoComplete) {
        if (!instance.isHidden) {
            if (instance.currentSelectedItemIndex == 0) {
                instance.moveSelectedMenuItem(instance.currentItems.length - 1);
            } else {
                instance.moveSelectedMenuItem(instance.currentSelectedItemIndex - 1);
            }
        }
    }

    public static getAutoCompleterByEditor(instances: TexAutoComplete[], cm: CodeMirror.Editor): TexAutoComplete {
        for (let i of instances) {
            if (i.editor == cm) {
                return i
            }
        }
        return undefined;
    }

    public static getHotkeyAssignmentByCommandId(app: App, commandId: string): Hotkey {
        // @ts-ignore
        if (app.hotkeyManager.baked == true) {
            // @ts-ignore
            let moveDownHotkeyIndex = app.hotkeyManager.bakedIds.findIndex((id) => id == commandId);
            // @ts-ignore
            return app.hotkeyManager.bakedHotkeys[moveDownHotkeyIndex];
        }
        return undefined;
    }

    /*
    Commands for Obsidian
     */


}
