import * as vscode from 'vscode';

import { NEW_SCRIPT_CHAR } from './constants'
import { Strings } from './utils'

import { BulletManager } from './BulletManager'
import { Bullet } from './Bullet';

class NodeArgument {
    id = "";
    bullet: Bullet | undefined;
}

class Command {
    name = "";
    lineIdx = -1;
    argument = new NodeArgument();
}

class Script {
    name = "";
    lineIdx = -1;
    commands: Array<Command> = [];
}

export class ScriptManager {
    scripts: Array<Script> = [];
    doc = new BulletManager();

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
                    currentScript.name = Strings.removeSpecialCharacters(line);
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

    runCommands(script: Script) {
        BulletManager.console.appendLine("// APPLYING SCRIPT [" + script.name + "]")

        script.commands.forEach( command => {
            if      (command.name === 'hideAll'             ) { this.doc.hideAllCommand(); } 
            else if (command.name === 'unhideAll'           ) { this.doc.unhideAllCommand(); }
            else if (command.name === 'foldAll'             ) { this.doc.foldAllCommand(); } 
            else if (command.name === 'unfoldAll'           ) { this.doc.unfoldAllCommand(); } 
            else if (command.name === 'hideNode'            ) { this.doc.hideCommand(command.argument.bullet); } 
            else if (command.name === 'unhideNode'          ) { this.doc.unhideCommand(command.argument.bullet); } 
            else if (command.name === 'foldNode'            ) { this.doc.foldCommand(command.argument.bullet); } 
            else if (command.name === 'unfoldNode'          ) { this.doc.unfoldCommand(command.argument.bullet); } 
            else if (command.name === 'foldChildren'        ) { this.doc.foldChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'unfoldChildren'      ) { this.doc.unfoldChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'hideChildren'        ) { this.doc.hideChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'unhideChildren'      ) { this.doc.unhideChildrenCommand(command.argument.bullet); } 
            else if (command.name === 'revealNode'          ) { this.doc.revealCommand(command.argument.bullet, false); } 
            else if (command.name === 'highlightNode'       ) { this.doc.highlightCommand(command.argument.bullet, false); } 
            else if (command.name === 'connectNode'         ) { this.doc.connectCommand(command.argument.bullet, false, false); } 
            else if (command.name === 'connectNodeHierarchy') { this.doc.connectCommand(command.argument.bullet, false, true); } 
            else if (command.name === 'updateFolding'       ) { this.doc.updateEditorFoldingCommand(); }
        });

        BulletManager.console.appendLine("// FINISHED SCRIPT [" + script.name + "]")

        this.doc.update();
    }
}