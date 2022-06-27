import * as vscode from 'vscode';

import { Id, NEW_SCRIPT_CHAR } from './constants'
import { Editor, Strings } from './utils'

import { BulletManager } from './BulletManager'
import { Bullet } from './Bullet';
import { DotFileManager } from './DotFileManager';
import { BulletGraph } from './BulletGraph';

class NodeArgument {
    id = "";
    bullet: Bullet | undefined;
}

class Command {
    name = "";
    lineIdx = -1;
    argument = new NodeArgument();
}

export class Script {
    name = "";
    lineIdx = -1;
    commands: Array<Command> = [];
}

export type ScriptQuickItems = { label: string; index: number; script: Script }[]

export class ScriptManager {
    scripts: Array<Script> = [];
    doc = new BulletManager();

    async renderAndSaveScriptsToSvg() {
        this.parseScripts();
        if (this.scripts.length > 0) {
            vscode.window.showInformationMessage(`Exporting ${this.scripts.length} scripts to SVG files...`);

            for (const script of this.scripts) {
                // Apply script commands.
                this.doc.resetBulletsFlags(); // start fresh before running commands
                await this.runCommands(script, false);

                // Render bullets and save to SVG, without updating editor.
                let bullet = new BulletGraph();
                bullet.parse(this.doc.bullets);
                await new DotFileManager().renderBulletGraph(bullet, false, false, true, script.name);
            }

            vscode.window.showInformationMessage(`Finished exporting scripts to SVG files.`);
        } 
        else {
            vscode.window.showWarningMessage('There is no script defined in the file.');
        }
    }

    cleanupIdsAndLinksCommand() {
        this.cleanupIdsAndLinks();
        this.doc.writeBullets();
    }

    cleanupIdsAndLinks() {
        type count = number;
        var map = new Map<Id, count>();

        let incrementIdCount = (id: Id) => {
            if (map.has(id)) {
                map.set(id, map.get(id)! + 1); // increment count
            } else {
                map.set(id, 0);
            }
        }

        // Initialize id count map from bullets and links.
        this.doc.bullets.forEach( bullet => {
            if (!bullet.isRandomId) { incrementIdCount(bullet.id); }
            bullet.idsIn.forEach( (id: Id) => { incrementIdCount(id); });
            bullet.idsOut.forEach( (id: Id) => { incrementIdCount(id); });
            bullet.idsEqual.forEach( (id: Id) => { incrementIdCount(id); });
        });

        // Update id count map from script commands.
        this.parseScripts();
        this.scripts.forEach( script => {
            script.commands.forEach( command => incrementIdCount(command.argument.id) );
        });

        let isUsed = (id: Id) => map.has(id) && (map.get(id)! > 0);

        // Apply cleanup.
        this.doc.bullets.forEach( bullet => {
            if (!isUsed(bullet.id)) {
                bullet.isRandomId = true; // set random flag to remove it from file
                bullet.mustUpdate = true;
            }
            
            // Reset links to only include used ids.
            let idsInCopy = [...bullet.idsIn]; 
            let idsOutCopy = [...bullet.idsOut]; 
            let idsEqualCopy = [...bullet.idsEqual]; 
            bullet.idsIn = [];
            bullet.idsOut = [];
            bullet.idsEqual = [];
            idsInCopy.forEach( id => { if (isUsed(id)) bullet.idsIn.push(id); else bullet.mustUpdate = true; })
            idsOutCopy.forEach( id => { if (isUsed(id)) bullet.idsOut.push(id); else bullet.mustUpdate = true; })
            idsEqualCopy.forEach( id => { if (isUsed(id)) bullet.idsEqual.push(id); else bullet.mustUpdate = true; })
        })
    }

    applyScriptFromList() {
        this.parseScripts();

        var quickItems: ScriptQuickItems = []

        this.scripts.forEach((script, index) => {
            let label = "$ " + script.name + ""
            quickItems.push({ label, index, script })
        })

        Editor.showQuickPick(quickItems, 0, (selection: any) => {
            if (selection) this.runCommands(selection.script)
        })
    }

    applyScript(lineIdx: number | undefined) {
        if (lineIdx === undefined) return false;
        this.parseScripts();

        if (this.scripts.length > 0) {
            const scriptIdx = this.findScriptIdxFromLineIdx(lineIdx);
            if (scriptIdx >= 0) {
                vscode.window.showInformationMessage(`Applying script [${this.scripts[scriptIdx].name}]...`);
                this.runCommands(this.scripts[scriptIdx]);
                vscode.window.showInformationMessage(`Finished applying script [${this.scripts[scriptIdx].name}].`);
            } 
            else
                vscode.window.showWarningMessage('Current line is not a script header.');
        } 
        else {
            vscode.window.showWarningMessage('There is no script defined in the file.');
        }
    }

    findScriptIdxFromLineIdx(lineIdx: number): number {
        for (let i = 0; i < this.scripts.length; ++i)
            if (this.scripts[i].lineIdx === lineIdx)
                return i;
        return -1;
    }

    parseScripts() {
        this.scripts = [];
        let currentScript = new Script();

        this.doc.scriptLines.forEach( lineWithToken => {
            let line = lineWithToken.text.substring(1).trim(); // remove token and trim
            if (line.length > 0) {
                if (line[0] === NEW_SCRIPT_CHAR) { // new script definition
                    currentScript = new Script();
                    currentScript.name = Strings.removeInvalidScriptNameCharacters(line);
                    currentScript.lineIdx = lineWithToken.index;
                    this.scripts.push(currentScript);
                } 
                else { // current script commands
                    let items = line.split(/[ ,]+/); // split on any number of spaces

                    if (items.length > 0) { // first word is the command
                        let command = new Command();
                        command.name = items[0].trim();
                        command.lineIdx = lineWithToken.index;

                        if (items.length > 1) { // optional second word is the node name
                            command.argument.id = items[1].trim();
                            command.argument.bullet = this.doc.getBulletFromId(command.argument.id);
                        }
    
                        currentScript.commands.push(command);
                    }
                }
            }
        });
    }

    async runCommands(script: Script, updateEditor: Boolean = true) {
        BulletManager.console.appendLine("// APPLYING SCRIPT [" + script.name + "]")

        script.commands.forEach( command => {
            if      (command.name === 'hideAll'             ) { this.doc.hideAllCommand(); } 
            else if (command.name === 'unhideAll'           ) { this.doc.unhideAllCommand(); }
            else if (command.name === 'foldAll'             ) { this.doc.foldAllCommand(); } 
            else if (command.name === 'unfoldAll'           ) { this.doc.unfoldAllCommand(); } 
            else if (command.name === "hide"                ) { this.doc.hideCommand(command.argument.bullet); } 
            else if (command.name === 'unhide'              ) { this.doc.unhideCommand(command.argument.bullet); } 
            else if (command.name === 'fold'                ) { this.doc.foldCommand(command.argument.bullet); } 
            else if (command.name === 'unfold'              ) { this.doc.unfoldCommand(command.argument.bullet); } 
            else if (command.name === 'foldChildren'        ) { this.doc.foldChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'unfoldChildren'      ) { this.doc.unfoldChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'hideChildren'        ) { this.doc.hideChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'unhideChildren'      ) { this.doc.unhideChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'reveal'              ) { this.doc.revealCommand(command.argument.bullet, false); } 
            else if (command.name === 'highlight'           ) { this.doc.highlightCommand(command.argument.bullet, false); } 
            else if (command.name === 'spotlight'           ) { this.doc.spotlightCommand(command.argument.bullet, false); } 
            else if (command.name === 'connect'             ) { this.doc.connectCommand(command.argument.bullet); } 
            else if (command.name === 'connectHierarchy'    ) { this.doc.connectHierarchyCommand(command.argument.bullet); } 
            else if (command.name === 'networkHierarchy'    ) { this.doc.networkHierarchyCommand(command.argument.bullet); } 
            else if (command.name === 'network'             ) { this.doc.networkCommand(command.argument.bullet); } 
            else if (command.name === 'flowIn'              ) { this.doc.flowInCommand(command.argument.bullet); } 
            else if (command.name === 'flowOut'             ) { this.doc.flowOutCommand(command.argument.bullet); } 
            else if (command.name === 'updateFolding'       ) { this.doc.updateEditorFoldingCommand(); }
        });

        BulletManager.console.appendLine("// FINISHED SCRIPT [" + script.name + "]")

        await this.doc.update(updateEditor);
    }
}