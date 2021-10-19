import {builtinModules} from 'module';
import {
    Plugin,
    Command, Notice,
} from 'obsidian';
import CodeMirror from "codemirror";
import {TexAutoComplete, TexAutoCompleteManager} from './TexAutoComplete'
import BetterLatexSetting from "./BetterLatexSetting";


interface MyPluginSettings {
    texMode:boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    texMode : true,
}



export default class BetterLatexForObsidian extends Plugin {
    settings: MyPluginSettings;
    manager: TexAutoCompleteManager;
    statusBar: HTMLElement;
    async onload() {

        await this.loadSettings();

        this.addSettingTab(new BetterLatexSetting(this.app, this));

        this.manager = new TexAutoCompleteManager(this.app, await TexAutoComplete.readTexTables(this.app.vault.adapter));

        this.registerCodeMirror((cm: CodeMirror.Editor) => {
            let instanceIndex = this.manager.newInstance(cm);
            this.manager.getInstance(instanceIndex).enableTexMode(this.settings.texMode);
            cm.on("keyup", this.manager.getInstance(instanceIndex).update)
            cm.on("focus", () => {
                this.manager.setActiveInstance(instanceIndex);
            });
        });

        this.statusBar = this.addStatusBarItem();
        this.syncStatusBarWithLatexMode();

        this.addCommand(this.nextMenuItem);
        this.addCommand(this.previousMenuItem);
        this.addCommand(this.toggleTexMode);

    }

    public syncStatusBarWithLatexMode(){
        let status = (this.settings.texMode)? "On": "Off";
        this.statusBar.setText("Latex Mode: "+status);
        new Notice("Latex Mode: "+status);
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

    toggleTexMode:Command = {
        id: "toggle latex mode",
        name: "Toggle Latex Mode",
        editorCallback: ((editor, view) => {
            this.settings.texMode = !this.settings.texMode;
            this.manager.enableAllInstanceTexMode(this.settings.texMode);
            this.syncStatusBarWithLatexMode();
        })
    }




    async onunload() {
        this.manager.unload();
        await this.saveSettings();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}




