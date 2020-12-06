import * as vscode from 'vscode';

import { Id, LABEL_ID_SEP, EVisibility, SCRIPT_LINE_TOKEN, ELink, ENABLE_EDITOR_FOLDING } from './constants'
import { Editor, isScriptLine, Strings } from './utils'
import { Bullet } from './Bullet';
import { generateCompactRandomId } from './NodeIdGenerator';

export class DocumentLine {
    text = "";
    index = -1;
}

export class DocumentManagerNew {
    bullets: Array<Bullet> = [];
    scriptLines: Array<DocumentLine> = [];

    constructor() {
        const { bulletLines, scriptLines } = this.getLines();
        this.bullets = this.parseBullets(bulletLines);
        this.scriptLines = scriptLines;
    }

    // Extract text lines, without parsing them, classifying them script/bullet.
    getLines() {
        const lines = Editor.getAllLines();
        if (!lines) vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');

        let bulletLines: Array<DocumentLine> = [];
        let scriptLines: Array<DocumentLine> = [];

        let lineIdx = 0;
        lines.forEach( line => {
            const lineTrim = line.trim();
            if (lineTrim.length > 0) { // skip empty line, or only containing tabs/spaces
                let docLine = new DocumentLine();
                docLine.index = lineIdx;
                if (lineTrim[0] === SCRIPT_LINE_TOKEN) {
                    docLine.text = lineTrim;
                    scriptLines.push(docLine);
                } else {
                    docLine.text = line;
                    bulletLines.push(docLine);
                }
            }
            lineIdx++;
        });

        return { bulletLines, scriptLines };
    }

    parseBullets(bulletLines: Array<DocumentLine>): Array<Bullet> {
        let bullets: Array<Bullet> = [];

        bulletLines.forEach( line => {
            let bullet = new Bullet();
            bullet.parse(line.text, line.index);
            bullets.push(bullet);
        });

        return bullets;
    }

    foldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let bullet = this.bullets.find( bullet => { return bullet.index === lineIdx; });
        if (bullet) {
            if (bullet.visibility !== EVisibility.eHide) { // must explicitely unhide to unhide
                bullet.visibility = EVisibility.eFold;
                bullet.mustUpdate = true;
            }
        }
    }

    hideAll() {
        this.bullets.forEach( bullet => {
            bullet.visibility = EVisibility.eHide;
            bullet.isHighlight = false;
            bullet.mustUpdate = true;
        });
    }

    update(callback: any | undefined = undefined) {
        this.updateChildrenVisibility();
        this.writeBullets(() => {
            this.updateEditorFolding(callback);
        });
    }

    updateChildrenVisibility() {
        // TODO
    }

    writeBullets(callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || this.bullets.length <= 0) return;

        editor.edit((editBuilder) => {
            this.bullets.forEach( bullet => {
                if (bullet.isValid() && bullet.mustUpdate) {
                    let newCompString = bullet.generateComponentSectionString();
    
                    let pos = bullet.text.indexOf(LABEL_ID_SEP);
                    if (pos < 0 && newCompString.length === 0) return; // nothing to do
            
                    if (pos < 0) {
                        if (bullet.text[bullet.text.length - 1] !== " ")
                            newCompString = " " + newCompString; // add a space if not already ending with a space
                        pos = bullet.text.length;
                    }
    
                    const range = new vscode.Range(
                        new vscode.Position(bullet.index, pos),
                        new vscode.Position(bullet.index, bullet.text.length)
                    );
                    editBuilder.replace(range, newCompString);
                }
            } )
        }).then((success) => {
            if (callback) callback(this.bullets);
        });
    }

    updateEditorFolding(callback: any | undefined = undefined) {
        // Maybe only modified, or not
        if (ENABLE_EDITOR_FOLDING) {
            // TODO
            if (callback) callback();
        } else if (callback) {
            callback();
        };
    }
}