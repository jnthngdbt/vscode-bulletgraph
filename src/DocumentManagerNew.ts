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
        for (let i = bullet.bulletIdx + 1; i < this.bullets.length; i++) {
            if (this.bullets[i].isValid()) { // find first valid bullet (not a comment)
                const next = this.bullets[i];
                return next.depth > bullet.depth;
            }
        }
        return false;
    }

    setVisibilityAtLine(lineIdx: number | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        let bullet = this.getBulletAtLine(lineIdx);
        if (bullet) {
            this.setVisibility(bullet, visibility, skipHidden);
        }
    }

    setVisibility(bullet: Bullet, visibility: EVisibility, skipHidden: Boolean = false) {
        if (skipHidden && bullet.visibility === EVisibility.eHide) { // must explicitely unhide to unhide
            return;
        }

        if (visibility === EVisibility.eHide) {
            bullet.isHighlight = false;
        } 
        
        if (!this.isBulletParent(bullet) && (visibility === EVisibility.eFold)) {
            visibility = EVisibility.eNormal
        }

        bullet.visibility = visibility;
        bullet.mustUpdate = true;
    }

    setChildrenVisibility(lineIdx: number | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        let parent = this.getBulletAtLine(lineIdx);
        if (parent) {
            for (let bulletIdx = parent.bulletIdx + 1; bulletIdx < this.bullets.length; bulletIdx++) {
                let child = this.bullets[bulletIdx];
                if (child.isValid() && child.depth <= parent.depth) // no more a child
                    break;

                this.setVisibility(child, visibility, skipHidden);
            }
        }
    }

    foldNode(lineIdx: number | undefined) {
        this.setVisibilityAtLine(lineIdx, EVisibility.eFold, true);
    }

    unfoldNode(lineIdx: number | undefined) {
        this.setVisibilityAtLine(lineIdx, EVisibility.eNormal, true);
    }

    hideNode(lineIdx: number | undefined) {
        this.setVisibilityAtLine(lineIdx, EVisibility.eHide);
    }

    unhideNode(lineIdx: number | undefined) {
        this.setVisibilityAtLine(lineIdx, EVisibility.eNormal);
    }
    
    foldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eFold, true);
        });
    }

    unfoldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eNormal, true);
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

    foldChildren(lineIdx: number | undefined) {
        this.setChildrenVisibility(lineIdx, EVisibility.eFold, true);
    }

    unfoldChildren(lineIdx: number | undefined) {
        this.setChildrenVisibility(lineIdx, EVisibility.eNormal, true);
    }

    hideChildren(lineIdx: number | undefined) {
        this.setChildrenVisibility(lineIdx, EVisibility.eHide);
    }

    unhideChildren(lineIdx: number | undefined) { // NOTE: also unfolds
        this.setChildrenVisibility(lineIdx, EVisibility.eNormal);
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
                    this.setVisibility(bullet, EVisibility.eFoldHidden, true);
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