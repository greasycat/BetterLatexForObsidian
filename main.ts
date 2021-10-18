import {builtinModules} from 'module';
import {
    Plugin,
    Command,
} from 'obsidian';
import CodeMirror from "codemirror";
import {TexAutoComplete, TexAutoCompleteManager} from './TexAutoComplete'
import BetterLatexSetting from "./BetterLatexSetting";


interface MyPluginSettings {
}

const DEFAULT_SETTINGS: MyPluginSettings = {
}



export default class BetterLatexForObsidian extends Plugin {
    settings: MyPluginSettings;
    manager: TexAutoCompleteManager;







    async onload() {

        await this.loadSettings();

        this.addSettingTab(new BetterLatexSetting(this.app, this));

        this.manager = new TexAutoCompleteManager(this.app, await TexAutoComplete.readTexTables(this.app.vault.adapter));

        this.registerCodeMirror((cm: CodeMirror.Editor) => {
            let instanceIndex = this.manager.newInstance(cm);
            cm.on("keyup", this.manager.getInstance(instanceIndex).update)
            cm.on("focus", () => {
                this.manager.setActiveInstance(instanceIndex);
            });
        });

        this.addCommand(this.nextMenuItem);
        this.addCommand(this.previousMenuItem);

    }

    previousMenuItem:Command = {
        id: 'move auto complete selection up',
        name: 'Move Auto Complete Selection Up',
        hotkeys: [
            {
                modifiers:['Ctrl'],
                key:'[',
            }
        ],
        editorCallback: (editor, view) => {
            if (this.manager != undefined) {
                this.manager.moveActiveInstancePrevious();
            }
        }
    }

    nextMenuItem:Command = {
        id: 'move auto complete selection down',
        name: 'Move Auto Complete Selection Down',
        hotkeys: [
            {
                modifiers:['Ctrl'],
                key:']',
            }
        ],
        editorCallback: (editor, view) => {
            if (this.manager != undefined) {
                this.manager.moveActiveInstanceNext();
            }
        }
    }




    onunload() {
        this.manager.unload();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}




