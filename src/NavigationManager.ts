import * as vscode from 'vscode';

import { BulletManager } from './BulletManager';
import { Bullet } from './Bullet';
import { EVisibility } from './constants';
import { Editor, Strings } from './utils';

export class NavigationManager {
    doc = new BulletManager();

    focus(bullet: Bullet | undefined) {
        if (!bullet) return;
        const pos = bullet.text.length - Strings.ltrim(bullet.text).length + 2;
        this.focusLineIdx(bullet.lineIdx, pos);
    }

    focusLineIdx(lineIdx: number, pos: number) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            var newPosition = new vscode.Position(lineIdx, pos);
            var newSelection = new vscode.Selection(newPosition, newPosition);
            editor.selection = newSelection;
            this.centerEditorOnLine(lineIdx);
        }
    }

    centerEditorOnLine(lineIdx: number | undefined) {
        if (lineIdx === undefined) return;
        vscode.commands.executeCommand("revealLine", { lineNumber: lineIdx, at: "center" });
    }

    goToLine() {
        Editor.showLineQuickPick((selectedLine: any) => {
            if (selectedLine) {
                this.focus(this.doc.getBulletAtLine(selectedLine.index));
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

    // foundAndFocusedVisible(bullet: Bullet) {
    //     const found = bullet.isValid() && (bullet.visibility === EVisibility.eNormal || bullet.visibility === EVisibility.eFold);
    //     if (found) {
    //         this.focus(bullet);
    //         return true;
    //     }
    //     return false;
    // }

    // goNextVisible(lineIdx: number | undefined) {
    //     if (lineIdx === undefined) return;
    //     for (let i = lineIdx + 1; i < Editor.getLineCount(); i++)
    //         if (this.foundAndFocusedVisible(this.parseLine(i)))
    //             break;
    // }

    // goBackVisible(lineIdx: number | undefined) {
    //     if (lineIdx === undefined) return;
    //     for (let i = lineIdx - 1; i >= 0; i--)
    //         if (this.foundAndFocusedVisible(this.parseLine(i)))
    //             break;
    // }
}