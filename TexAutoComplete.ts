import CodeMirror, {off} from "codemirror";
import FuzzySearch from "./dist/FuzzySearch";
import {App, DataAdapter} from "obsidian";
import {COMMAND_ID, MODIFIER} from "./BetterLatexSetting";
import {inspect} from "util";

const AUTOCOMPLETE_CLASS_TOKEN = {
    ITEM: 'tex-autocomplete-item',
    SELECTED_ITEM: 'tex-autocomplete-item-selected',
    MENU: 'tex-autocomplete-menu',
    ITEM_TEXT: 'tex-autocomplete-item-text',
}

const ENVIRONMENT_NAMES = [
    'align',
    'align*',
    'alignat',
    'array',
    'Bmatrix',
    'bmatrix',
    'cases',
    'eqnarray',
    'eqnarray*',
    'equation',
    'gather',
    'gather*',
    'matrix',
    'multline',
    'pmatrix',
    'smallmatrix',
    'subarray',
    'Vmatrix',
    'vmatrix',
]

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

    // public getActiveInstance() {
    //     return this.texInstances[this.activeInstanceIndex];
    // }

    private static initAutoCompleteMenu(): HTMLDivElement {
        let autoCompleteMenu = document.createElement("div");
        autoCompleteMenu.classList.add("tex-autocomplete-menu");
        document.body.appendChild(autoCompleteMenu)
        return autoCompleteMenu;
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

    getInstance(i: number) {
        return this.texInstances[i];
    }

    public enableAllInstanceTexMode(enable:boolean)
    {
        this.texInstances.forEach((instance) => {
            instance.clearAndHideMenu();
            instance.enableTexMode(enable);
        })
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
    autoCompleteMenu: HTMLDivElement;

    editor: CodeMirror.Editor;
    manager: TexAutoCompleteManager;

    texDataTable: any;

    currentCursorPosition: CodeMirror.Position;
    currentWord: string;
    currentSelectedItemIndex: number;
    currentSuggestion: string[];
    currentItems: HTMLDivElement[];

    previousKey: string;
    previousWord: string;

    isHidden: boolean;
    isInScope: boolean;
    isInTexMode: boolean;


    constructor(manager: TexAutoCompleteManager, editor: CodeMirror.Editor, autoCompleteMenu: HTMLDivElement, texDataTable: any) {
        this.editor = editor;
        this.isHidden = true;
        this.autoCompleteMenu = autoCompleteMenu;
        this.currentItems = [];
        this.texDataTable = texDataTable;
        this.currentSelectedItemIndex = 0;
        this.manager = manager;
        this.previousKey = "";
        this.isInTexMode = false;
        this.isInScope = false;
    }

    public static async readTexTables(dataAdaptor: DataAdapter) {
        let data = await dataAdaptor.read("./.obsidian/plugins/BetterLatexForObsidian/data.csv");
        return data.split(/[\r|\n]+/)
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

    private static moveCursorOnTheLine(editor: CodeMirror.Editor, offset: number) {
        let cursor = editor.getCursor();
        cursor.ch += offset;
        editor.setCursor(cursor);
    }

    private static createAutoCompleteMenuItem(text: string): HTMLDivElement {
        let menuItem = document.createElement("div");
        menuItem.classList.add("tex-autocomplete-item")
        let span = document.createElement("span")
        span.setText(text);
        span.classList.add("tex-autocomplete-item-text");
        menuItem.append(span);
        return menuItem;
    }

    private static getHotkeyAssignmentByCommandId(app: App, commandId: string): Hotkey {
        // @ts-ignore
        if (app.hotkeyManager.baked == true) {
            // @ts-ignore
            let moveDownHotkeyIndex = app.hotkeyManager.bakedIds.findIndex((id) => id == commandId);
            // @ts-ignore
            return app.hotkeyManager.bakedHotkeys[moveDownHotkeyIndex];
        }
        return undefined;
    }

    public enableTexMode(enable:boolean)
    {
        this.isInTexMode = enable;
    }

    public update = (cm: CodeMirror.Editor, event: KeyboardEvent) => {

        if (this.isInTexMode) {

            //Ignore modifier keydown
            if (!MODIFIER.contains(event.key)) {
                let doNotAutoComplete = false;

                this.currentCursorPosition = cm.getCursor();
                this.updateCurrentWord();


                if (this.isMoveSelectionHotkeyPressed(event)) {
                    this.replaceWordWithSelected();
                    doNotAutoComplete = true;
                }


                if (event.key == 'Tab' && !this.isHidden) {
                    this.currentWord = this.previousWord;
                    this.currentCursorPosition.ch--;

                    if (ENVIRONMENT_NAMES.contains(this.currentSuggestion[this.currentSelectedItemIndex].toLowerCase())) {
                        let envText = this.currentSuggestion[this.currentSelectedItemIndex];
                        let text = "{" + envText + "}\\end{" + envText + "}";
                        this.replaceWord(text);
                        TexAutoComplete.moveCursorOnTheLine(cm, -(envText.length + 6));
                    } else {

                        this.replaceWordWithSelected();
                    }
                    this.clearAndHideMenu();
                    doNotAutoComplete = true;
                }

                if (event.key == 'Esc' && !this.isHidden) {
                    this.clearAndHideMenu();
                    doNotAutoComplete = true;
                }

                if (event.key == "/") {

                }


                if (event.key == '$') {
                    if (this.previousKey != '\\') // prevent \$ completion
                    {
                        this.append("$")
                        TexAutoComplete.moveCursorOnTheLine(cm, -1);
                    }
                }

                if (!doNotAutoComplete) {
                    this.toggleAutoComplete();
                }
                this.changeSize();

                this.previousKey = event.key;
            }
        }
    }

    public clearAndHideMenu() {
        this.removeAllMenuItems();
        this.autoCompleteMenu.style.visibility = "hidden"
        this.isHidden = true;
    }

    public removeAllMenuItems() {
        if (this.currentItems.length != 0) {
            this.currentItems.forEach((item) => {
                this.autoCompleteMenu.removeChild(item);

            })
        }

        this.currentItems = [];
    }

    private isMoveSelectionHotkeyPressed(event: KeyboardEvent) {
        let moveUp = TexAutoComplete.getHotkeyAssignmentByCommandId(this.manager.app, COMMAND_ID.moveUpHotkey);
        let moveDown = TexAutoComplete.getHotkeyAssignmentByCommandId(this.manager.app, COMMAND_ID.moveDownHotkey);

        return (TexAutoComplete.checkModifierKey(event, moveUp.modifiers) && event.key == moveUp.key.toLowerCase()) || (TexAutoComplete.checkModifierKey(event, moveDown.modifiers) && event.key == moveDown.key.toLowerCase())

    }

    private toggleAutoComplete() {
        if (this.currentWord != undefined) {
            if (this.currentWord.startsWith("\\") || (this.currentWord.startsWith("{") && this.previousWord == '\\begin')) {
                this.removeAllMenuItems();
                this.showAutoComplete();
            } else if (this.currentWord == ' ' || this.currentWord == '' || this.currentWord == '\t' || !this.currentWord.startsWith("\\")) {
                this.clearAndHideMenu();
            }
        }
    }


    private replaceWordWithSelected() {
        if (this.currentSuggestion != undefined && this.currentSuggestion.length >= this.currentSelectedItemIndex) {
            // this.currentWord = this.currentWord.trim();
            let begin = this.currentCursorPosition;
            begin.ch -= this.currentWord.length;
            this.editor.replaceRange(this.currentSuggestion[this.currentSelectedItemIndex], begin, this.editor.getCursor());
            this.editor.replaceSelection("");
            this.currentWord = this.currentSuggestion[this.currentSelectedItemIndex];
        }
    }

    private replaceWord(text: string) {
        let begin = this.currentCursorPosition;
        begin.ch -= this.currentWord.length;
        this.editor.replaceRange(text, begin, this.editor.getCursor());
        this.editor.replaceSelection("");
    }

    private append(text: string) {
        this.editor.replaceRange(text, this.editor.getCursor());
    }


    private showAutoComplete() {
        let rawCursorPosition = this.editor.cursorCoords(true);
        let style = "left: " + rawCursorPosition.left + "px; top:" + (rawCursorPosition.top + 10) + "px;"
        this.autoCompleteMenu.setAttribute('style', style);
        this.currentSuggestion = this.getSuggestions();
        this.generateMenuItems(this.currentSuggestion);
        this.isHidden = false;
    }

    private moveSelectedMenuItem(index: number) {
        if (this.currentItems != undefined && this.currentItems.length >= index + 1) {
            this.currentItems[this.currentSelectedItemIndex].classList.remove(AUTOCOMPLETE_CLASS_TOKEN.SELECTED_ITEM);
            this.currentItems[index].classList.add(AUTOCOMPLETE_CLASS_TOKEN.SELECTED_ITEM);
            this.currentSelectedItemIndex = index;
        }
    }

    private generateMenuItems(items: Array<string>) {
        if (this.currentItems == undefined) {
            this.currentItems = [];
        }

        items.forEach((item) => {
            let i = TexAutoComplete.createAutoCompleteMenuItem(item);
            this.currentItems.push(i);
            this.autoCompleteMenu.appendChild(i);
        });

        if (this.currentItems.length >= 1) {
            this.currentItems[0].classList.add("tex-autocomplete-item-selected")
            this.currentSelectedItemIndex = 0;
        }
    }

    private getSuggestions() {
        let searcher = new FuzzySearch({source: this.texDataTable});
        // @ts-ignore
        let result = searcher.search(this.currentWord);
        return result.slice(0, 5);
    }

    private changeSize() {
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

    private updateCurrentWord() {
        let currentCursorPosition = this.editor.getCursor();
        let currentLineString = this.editor.getLine(currentCursorPosition.line);
        if (currentLineString[currentCursorPosition.ch - 1] == ' ') {
            this.currentWord = ' ';
        } else {
            let trimmedLineString = currentLineString.substr(0, currentCursorPosition.ch);

            let symbol = "`~!@#$%^&*()_+-={}|[]\\:\";\'<>?,./ \t";
            let symbolList = [];

            for (let ch of symbol) {
                symbolList.push({symbol: ch, index: trimmedLineString.lastIndexOf(ch)});
            }

            symbolList.sort((a, b) => {
                return b.index - a.index
            })

            let correctWordStartIndex = symbolList[0].index == -1 ? 0 : symbolList[0].index;
            let lastWordStartIndex = -1
            if (symbolList.length > 1) {
                lastWordStartIndex = symbolList[1].index;
                this.previousWord = trimmedLineString.substring(lastWordStartIndex, correctWordStartIndex);
            }

            this.currentWord = trimmedLineString.substring(correctWordStartIndex, trimmedLineString.length).trim();
        }
    }


    /*
    Commands for Obsidian
     */


}
