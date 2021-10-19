import {App, PluginSettingTab, Setting, Notice, ToggleComponent} from 'obsidian'
import BetterLatexForObsidian from "./main";

export const MODIFIER = ['Control', 'Shift', 'Alt']
export const VALID_SYMBOLS = [',', '.','/',';','\'', '[', ']', '\\', '-', '+']
export const COMMAND_ID = {
    moveDownHotkey:"better-latex-for-obsidian:move auto complete selection down",
    moveUpHotkey:"better-latex-for-obsidian:move auto complete selection up",
}

export default class BetterLatexSetting extends PluginSettingTab {
    plugin: BetterLatexForObsidian

    constructor(app:App, plugin:BetterLatexForObsidian) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): any {
        this.containerEl.empty();
        this.containerEl.createEl('h2', {text:"BetterLatex Setting Page"});

        new Setting(this.containerEl)
            .setName("Enable LaTex Mode")
            .setDesc("You can setup a hotkey for this in the Hotkey setting")
            .addToggle(toggleComponent => toggleComponent
                .setValue(this.plugin.settings.texMode)
                .onChange(async (value) => {
                    this.plugin.settings.texMode = value;
                    this.plugin.manager.enableAllInstanceTexMode(value);
                    await this.plugin.saveSettings();
                    this.plugin.syncStatusBarWithLatexMode();
                })
            )

        // new Setting(this.containerEl)
        //     .setName("Move Down Hotkey")
        //     .setDesc("Choose the hotkey to move down autocomplete selection")
        //     .addText(text =>
        //     text.setPlaceholder("ctrl ]")
        //         .setValue(this.plugin.settings.moveDownHotkey.join(" "))
        //         .onChange(async (value) => {
        //
        //             if (BetterLatexSetting.checkHotkeyValidity(value))
        //             {
        //                 new Notice("Hotkey successfully set.");
        //                 this.plugin.settings.moveDownHotkey = value.split(" ");
        //                 await this.plugin.saveSettings();
        //             }else {
        //                 new Notice("Invalid Hotkey");
        //             }
        //         })
        //     )
        //
        // new Setting(this.containerEl)
        //     .setName("Move Up Hotkey")
        //     .setDesc("Choose the hotkey to move up autocomplete selection")
        //     .addText(text =>
        //         text.setPlaceholder("ctrl [")
        //             .setValue(this.plugin.settings.moveUpHotkey.join(" "))
        //             .onChange(async (value) => {
        //                 if (BetterLatexSetting.checkHotkeyValidity(value))
        //                 {
        //                     new Notice("Hotkey successfully set.");
        //                     this.plugin.settings.moveUpHotkey = value.split(" ");
        //                     await this.plugin.saveSettings();
        //                 }else {
        //                     new Notice("Invalid Hotkey");
        //                 }
        //             })
        //     )
    }

    private static checkHotkeyValidity(text:string)
    {
        let hotkeySet = text.trim().split(" ");
        // if (hotkeySet.length == 0 || hotkeySet.length>2)
        // {
        //     return false;
        // }

        if (hotkeySet.length == 2)
        {
            if (MODIFIER.contains(hotkeySet[0]) && hotkeySet[0] != hotkeySet[1])
            {
                return hotkeySet[1].match(/^[a-z0-9]+$/i) || VALID_SYMBOLS.contains(hotkeySet[1]);
            }
        }

        return false;
    }


}