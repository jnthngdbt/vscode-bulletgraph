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
            bullet.bulletIdx = bullets.length;
            bullets.push(bullet);
        });

        return bullets;
    }

    getBulletAtLine(lineIdx: number | undefined): Bullet | undefined {
        if (lineIdx !== undefined) {
            return this.bullets.find( bullet => { return bullet.lineIdx === lineIdx; });
        }
        return undefined;
    }

    isBulletParent(bullet: Bullet): Boolean {
        if (this.bullets.length > (bullet.bulletIdx + 1)) {
            const curr = this.bullets[bullet.bulletIdx];
            const next = this.bullets[bullet.bulletIdx + 1];
            return next.depth > curr.depth;
        }
        return false;
    }

    setVisibility(bullet: Bullet, visibility: EVisibility) {
        if (visibility === EVisibility.eHide) {
            bullet.isHighlight = false;
        } 
        
        if (!this.isBulletParent(bullet) && (visibility === EVisibility.eFold)) {
            visibility = EVisibility.eNormal
        }

        bullet.visibility = visibility;
        bullet.mustUpdate = true;
    }

    foldNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let bullet = this.getBulletAtLine(lineIdx);
        if (bullet && (bullet.visibility !== EVisibility.eHide)) { // must explicitely unhide to unhide
            this.setVisibility(bullet, EVisibility.eFold);
        }
    }

    unfoldNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let bullet = this.getBulletAtLine(lineIdx);
        if (bullet && (bullet.visibility !== EVisibility.eHide)) { // must explicitely unhide to unhide
            this.setVisibility(bullet, EVisibility.eNormal);
        }
    }

    hideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let bullet = this.getBulletAtLine(lineIdx);
        if (bullet) {
            this.setVisibility(bullet, EVisibility.eHide);
        }
    }

    unhideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let bullet = this.getBulletAtLine(lineIdx);
        if (bullet) {
            this.setVisibility(bullet, EVisibility.eNormal);
        }
    }
    
    foldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eFold);
        });
    }

    unfoldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eNormal);
        });
    }

    hideAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eHide);
        });
    }

    unhideAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eNormal);
        });
    }

    update(callback: any | undefined = undefined) {
        this.updateChildrenVisibility();
        this.writeBullets(() => {
            this.updateEditorFolding(callback);
        });
    }

    updateChildrenVisibility() {
        let currHideDepth = -1;
        let currFoldDepth = -1;
        this.bullets.forEach( bullet => {
            if (bullet.isValid()) {
                // Reset depth trackers if necessary.
                if (bullet.depth <= currHideDepth) currHideDepth = -1;
                if (bullet.depth <= currFoldDepth) currFoldDepth = -1;

                if ((currHideDepth >= 0) && (bullet.depth > currHideDepth)) { // hidden
                    this.setVisibility(bullet, EVisibility.eHide);
                } else if ((currFoldDepth >= 0) && (bullet.depth > currFoldDepth)) { // folded
                    this.setVisibility(bullet, EVisibility.eFoldHidden);
                } else if (bullet.visibility === EVisibility.eHide) { // new hide root
                    currHideDepth = bullet.depth;
                } else if (bullet.visibility === EVisibility.eFold) { // new fold root
                    currFoldDepth = bullet.depth;
                } else if (bullet.visibility === EVisibility.eFoldHidden) { // not hidden anymore, so should not be fold hidden
                    this.setVisibility(bullet, EVisibility.eFold);
                    if (this.isBulletParent(bullet))
                        currFoldDepth = bullet.depth;
                }
            }
        });
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
                        new vscode.Position(bullet.lineIdx, pos),
                        new vscode.Position(bullet.lineIdx, bullet.text.length)
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