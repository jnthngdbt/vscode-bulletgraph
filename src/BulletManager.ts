import * as vscode from 'vscode';

import { Id, LABEL_ID_SEP, EVisibility, SCRIPT_LINE_TOKEN, ELink, ENABLE_EDITOR_FOLDING } from './constants'
import { Editor, isScriptLine, Strings } from './utils'
import { Bullet } from './Bullet';
import { generateCompactRandomId } from './NodeIdGenerator';

export class DocumentLine {
    text = "";
    index = -1;
}

export class BulletManager {
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

    getActiveBullet(): Bullet | undefined {
        return this.getBulletAtLine(Editor.getActiveLineIdx());
    }

    getBulletAtLine(lineIdx: number | undefined): Bullet | undefined {
        if (lineIdx !== undefined) {
            return this.bullets.find( bullet => { return bullet.lineIdx === lineIdx; });
        }
        return undefined;
    }

    getBulletFromId(id: string): Bullet | undefined {
        return this.bullets.find( bullet => { return bullet.id === id; });
    }

    isParent(bullet: Bullet): Boolean {
        for (let i = bullet.bulletIdx + 1; i < this.bullets.length; i++) {
            if (this.bullets[i].isValid()) { // find first valid bullet (not a comment)
                const next = this.bullets[i];
                return next.depth > bullet.depth;
            }
        }
        return false;
    }

    setVisibility(bullet: Bullet | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        if (!bullet) return;

        if (skipHidden && bullet.visibility === EVisibility.eHide) // must explicitely unhide to unhide
            return;

        if (visibility === EVisibility.eHide)
            bullet.isHighlight = false;
        
        if (!this.isParent(bullet) && (visibility === EVisibility.eFold))
            visibility = EVisibility.eNormal

        bullet.visibility = visibility;
        bullet.mustUpdate = true;
    }

    setChildrenVisibility(parent: Bullet | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        if (!parent) return;

        let children = this.getChildren(parent);
        children.forEach( child => this.setVisibility(child, visibility, skipHidden) );
    }

    fold(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eFold, true);
    }

    unfold(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eNormal, true);
    }

    hide(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eHide);
    }

    unhide(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eNormal);
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

    foldChildren(bullet: Bullet | undefined) {
        this.setChildrenVisibility(bullet, EVisibility.eFold, true);
    }

    unfoldChildren(bullet: Bullet | undefined) {
        this.setChildrenVisibility(bullet, EVisibility.eNormal, true);
    }

    hideChildren(bullet: Bullet | undefined) {
        this.setChildrenVisibility(bullet, EVisibility.eHide);
    }

    unhideChildren(bullet: Bullet | undefined) { // NOTE: also unfolds
        if (bullet) {
            if (bullet.visibility === EVisibility.eHide)
                this.setVisibility(bullet, EVisibility.eNormal);
        this.setChildrenVisibility(bullet, EVisibility.eNormal);
    }
    }

    highlight(bullet: Bullet | undefined, toggle: Boolean = false) {
        if (bullet) {
            bullet.isHighlight = toggle ? !bullet.isHighlight : true;
            bullet.mustUpdate = true;
        }
    }

    reveal(bullet: Bullet | undefined, highlight: Boolean = true) {
        if (!bullet) return;
        if (bullet.isRevealed) return;

        // Make sure all parents are visible.
        let parents = this.getParents(bullet);
        parents.forEach( parent => {
            this.setVisibility(parent, EVisibility.eNormal);
        });

        this.setVisibility(bullet, EVisibility.eFold);
        this.unhideChildren(bullet);

        if (highlight)
            this.highlight(bullet);

        bullet.isRevealed = true;
    }

    connect(bullet: Bullet | undefined, highlight: Boolean = true, connectParents: Boolean = false) {
        if (!bullet) return;
        if (bullet.isConnected) return;

        let connections = this.getConnections(bullet);

        // Add children connections.
        let children = this.getChildren(bullet);
        children.forEach( child => { connections = connections.concat(this.getConnections(child)); } );

        // Add parents connections if necessary.
        if (connectParents) {
            let parents = this.getParents(bullet);
            parents.forEach( parent => { connections = connections.concat(this.getConnections(parent)); } );
        }

        // Reveal bullet and its connections. Note: possible duplicates, but reveal should skip if already done.
        this.reveal(bullet, false);
        connections.forEach( connection => this.reveal(connection, false) );

        if (highlight)
            this.highlight(bullet);

        bullet.isConnected = true;
    }

    getConnections(bullet: Bullet): Array<Bullet> {
        let connections: Array<Bullet> = [];

        let pushConnectionFromId = (connectionId: string) => {
            let connection = this.getBulletFromId(connectionId);
            if (connection) connections.push(connection);
        }

        // Added bullets that it directly links.
        bullet.idsIn.forEach(pushConnectionFromId);
        bullet.idsOut.forEach(pushConnectionFromId);

        // Add bullets that directly link to it.
        for (let other of this.bullets) {
            if (other.idsIn.includes(bullet.id)) connections.push(other);
            if (other.idsOut.includes(bullet.id)) connections.push(other);
        }

        return connections;
    }

    getParents(bullet: Bullet | undefined): Array<Bullet> {
        let parents: Array<Bullet> = [];

        let child = bullet;
        while (child) {
            const parent = this.getParent(child); // eventually undefined
            if (parent)
                parents.push(parent);
            child = parent;
        }

        return parents;
    }

    getParent(bullet: Bullet): Bullet | undefined {
        for (let i = bullet.bulletIdx - 1; i >= 0; i--) { // backtrack
            const parent = this.bullets[i];

            if (!parent.isValid()) // skip comments and invalid lines
                continue;

            if (parent.depth < bullet.depth) // found parent
                return parent;
        }

        return undefined;
    }

    getChildren(parent: Bullet | undefined): Array<Bullet> {
        let children: Array<Bullet> = [];

        if (parent) {
            for (let i = parent.bulletIdx + 1; i < this.bullets.length; i++) {
                let child = this.bullets[i];

                if (!child.isValid()) // skip comments
                    continue;
    
                if (child.depth <= parent.depth) // no more a child
                    break;
    
                children.push(child);
            }
        }

        return children;
    }

    update(callback: any | undefined = undefined) {
        this.propagateVisibility();
        this.writeBullets(() => {
            this.updateEditorFolding(callback);
        });
    }

    propagateVisibility() {
        let currHideDepth = -1;
        let currFoldDepth = -1;
        this.bullets.forEach( bullet => {
            if (bullet.isValid()) {
                // Reset depth trackers if necessary.
                if (bullet.depth <= currHideDepth) currHideDepth = -1;
                if (bullet.depth <= currFoldDepth) currFoldDepth = -1;

                if ((currHideDepth >= 0) && (bullet.depth > currHideDepth)) { // hidden
                    this.setVisibility(bullet, EVisibility.eHide);
                } 
                else if ((currFoldDepth >= 0) && (bullet.depth > currFoldDepth)) { // folded
                    this.setVisibility(bullet, EVisibility.eFoldHidden, true);
                } 
                else if (bullet.visibility === EVisibility.eHide) { // new hide root
                    currHideDepth = bullet.depth;
                } 
                else if (bullet.visibility === EVisibility.eFold) { // new fold root
                    currFoldDepth = bullet.depth;
                } 
                else if (bullet.visibility === EVisibility.eFoldHidden) { // not hidden anymore, so should not be fold hidden
                    this.setVisibility(bullet, EVisibility.eFold);
                    if (this.isParent(bullet))
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