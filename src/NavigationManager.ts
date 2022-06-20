import * as vscode from 'vscode';

import { BulletManager } from './BulletManager';
import { Bullet } from './Bullet';
import { EVisibility } from './constants';
import { Editor, Strings } from './utils';

export class NavigationManager {
    doc = new BulletManager();

    focus(bullet: Bullet | undefined, at: string = "center") {
        if (!bullet) return;
        const pos = bullet.text.length - Strings.ltrim(bullet.text).length + 2;
        Editor.focusLine(bullet.lineIdx, pos, at);
    }

    focusLine(lineIdx: number, at: string = "center") {
        let bullet = this.doc.getBulletAtLine(lineIdx)
        if (bullet) {
            this.focus(bullet, at);
        } else {
            Editor.focusLine(lineIdx, 0, at);
        }
    }

    goToLine() {
        let onDidAccept = (selected: any) => { 
            if (selected) {
                let lineIdx = selected.bullet ? selected.bullet.lineIdx : selected.index;
                this.focusLine(lineIdx, "center");
            }
        };

        this.doc.showBulletQuickPick(onDidAccept); // can be this.doc.showBulletQuickPick or Editor.showLineQuickPick
    }

    goToConnectionBullet(lineIdx: number | undefined) {
        if (lineIdx === undefined) return;
        let activeBullet = this.doc.getBulletAtLine(lineIdx)
        this.doc.showBulletConnectionQuickPick(activeBullet, (selected: any) => {
            if (selected) {
                this.focus(selected.bullet);
            }
        });
    }

    goToParent(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        const parent = this.doc.getParent(bullet);
        this.focus(parent);
    }

    goToChildren(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        const child = this.doc.getChild(bullet);
        this.focus(child);
    }

    goToNextSibling(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        if (!bullet) return;
        for (let i = bullet.bulletIdx + 1; i < this.doc.bullets.length; i++)
            if (this.hasFoundAndFocusedSibling(this.doc.bullets[i], bullet.depth))
                break;
    }

    goToPreviousSibling(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        if (!bullet) return;
        for (let i = bullet.bulletIdx - 1; i >= 0; i--)
            if (this.hasFoundAndFocusedSibling(this.doc.bullets[i], bullet.depth))
                break;
    }

    hasFoundAndFocusedSibling(bullet: Bullet, depth: Number) {
        if (!bullet.isValid() || (bullet.depth > depth)) return false; // skip comments and children
        if (bullet.depth < depth) return true; // stop when reached parent
        this.focus(bullet);
        return true;
    }

    goNextVisible(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        if (!bullet) return;
        for (let i = bullet.bulletIdx + 1; i < this.doc.bullets.length; i++)
            if (this.hasFoundAndFocusedVisible(this.doc.bullets[i]))
                break;
    }

    goBackVisible(lineIdx: number | undefined) {
        const bullet = this.doc.getBulletAtLine(lineIdx);
        if (!bullet) return;
        for (let i = bullet.bulletIdx - 1; i >= 0; i--)
            if (this.hasFoundAndFocusedVisible(this.doc.bullets[i]))
                break;
    }

    hasFoundAndFocusedVisible(bullet: Bullet) {
        const found = bullet.isValid() && (bullet.visibility === EVisibility.eNormal || bullet.visibility === EVisibility.eFold);
        if (found) {
            this.focus(bullet);
            return true;
        }
        return false;
    }

    static moveCursorUp() {
        vscode.commands.executeCommand("cursorMove", { to: "up", by:'wrappedLine', value:1 });
    }

    static moveCursorDown() {
        vscode.commands.executeCommand("cursorMove", { to: "down", by:'wrappedLine', value:1 });
    }
}