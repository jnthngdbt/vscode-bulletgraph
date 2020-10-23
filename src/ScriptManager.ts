import * as vscode from 'vscode';

import { NEW_SCRIPT_CHAR } from './constants'
import { Strings } from './utils'

import { DocumentManager } from './DocumentManager'
import { BulletLine } from './BulletLine';

class NodeArgument {
    id = "";
    lineIdx = 0;
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
    doc = new DocumentManager();

    applyScript(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return false;
        this.parseScripts();

        if (this.scripts.length > 0) {
            const scriptIdx = this.findScriptIdxFromLineIdx(lineIdx);
            if (scriptIdx >= 0) {
                vscode.window.showInformationMessage(`Applying script [${this.scripts[scriptIdx].name}]...`);
                this.runCommand(this.scripts[scriptIdx], 0, () => {
                    vscode.window.showInformationMessage(`Finished applying script [${this.scripts[scriptIdx].name}].`);
                    if (completionHandler) completionHandler();
                });
            } else {
                vscode.window.showWarningMessage('Current line is not a script header.');
            }
        } else {
            vscode.window.showWarningMessage('There is no script defined in the file.');
            if (completionHandler) completionHandler();
        }
    }

    findScriptIdxFromLineIdx(lineIdx: number): number {
        for (let i = 0; i < this.scripts.length; ++i)
            if (this.scripts[i].lineIdx === lineIdx)
                return i;
        return -1;
    }

    runScriptIfSpecified(completionHandler: any) {
        this.parseScripts();

        // TODO: add a way to select the script
        if (this.scripts.length > 0) {
            this.runCommand(this.scripts[0], 0, completionHandler);
        } else {
            completionHandler();
        }
    }

    parseScripts() {
        this.doc.extractLines(); // script lines are trimmed and non-empty, do not contain comments
        const bullets = this.doc.parseBulletsLines();

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
                } else { // current script commands
                    let items = line.split(/[ ,]+/); // split on any number of spaces

                    if (items.length > 0) { // first word is the command
                        let command = new Command();
                        command.name = items[0].trim();
                        command.lineIdx = lineWithToken.index;

                        if (items.length > 1) { // optional second word is the node name
                            command.argument.id = items[1].trim();
                            command.argument.lineIdx = this.findLineIdxOfNodeId(bullets, command.argument.id);
                        }
    
                        currentScript.commands.push(command);
                    }
                }
            }
        });
    }

    findLineIdxOfNodeId(bullets: Array<BulletLine>, nodeId: string): number {
        for (let i = 0; i < bullets.length; i++)
            if (bullets[i].id === nodeId)
                    return bullets[i].index;
        
        return -1;
    }

    runCommand(script: Script, commandIdx: number, scriptCompletionHandler: any) {
        if (commandIdx < script.commands.length) {
            let completionHandler = () => { this.runCommand(script, commandIdx + 1, scriptCompletionHandler); };

            const command = script.commands[commandIdx];
            if      (command.name === 'hideAll'         ) { this.doc.hideAll(completionHandler); } 
            else if (command.name === 'unhideAll'       ) { this.doc.unhideAll(completionHandler); }
            else if (command.name === 'foldAll'         ) { this.doc.foldAll(completionHandler); } 
            else if (command.name === 'unfoldAll'       ) { this.doc.unfoldAll(completionHandler); } 
            else if (command.name === 'hideNode'        ) { this.doc.hideNode(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'unhideNode'      ) { this.doc.unhideNode(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'foldNode'        ) { this.doc.foldLine(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'unfoldNode'      ) { this.doc.unfoldLine(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'foldChildren'    ) { this.doc.foldChildren(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'unfoldChildren'  ) { this.doc.unfoldChildren(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'hideChildren'    ) { this.doc.hideChildren(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'unhideChildren'  ) { this.doc.unhideChildren(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'revealNode'      ) { this.doc.revealNode(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'connectNode'     ) { this.doc.connectNode(command.argument.lineIdx, completionHandler); } 
            else if (command.name === 'updateFolding'   ) { this.doc.updateFolding(completionHandler); }
            else { completionHandler(); }
        } else {
            scriptCompletionHandler();
        }
    }
}