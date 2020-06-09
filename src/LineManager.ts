import * as vscode from 'vscode';

import { COMMENT, LABEL_ID_SEP, EBullet, EVisibility } from './constants'
import { Strings } from './utils'

export class LineManager {
    line = "";
    isComment = false;
    depth = -1;
    bullet = EBullet.eDefault;
    label = "";
    visibility = EVisibility.eUndefined;
    components: Array<string> = [];

    clear() {
        this.line = "";
        this.isComment = false;
        this.depth = -1;
        this.bullet = EBullet.eDefault;
        this.label = "";
        this.visibility = EVisibility.eUndefined;
        this.components = [];
    }

    isValid(): boolean {
        return !this.isComment && (this.depth >= 0);
    }

    hasComponents(): boolean {
        return this.isValid() && this.line.includes(LABEL_ID_SEP);
    }

    isLineFoldable(lineIdx: number | undefined): boolean {
        if (lineIdx === undefined) return false;

        // Next line.
        this.parseLine(lineIdx + 1);
        if (!this.isValid()) return false;
        const nextLineDepth = this.depth;

        // Specified line. Do it last so that line state is active line.
        this.parseLine(lineIdx);
        if (!this.isValid()) return false;
        const activeLineDepth = this.depth;

        return nextLineDepth > activeLineDepth;
    }

    getLineCount(): number {
        return vscode.window.activeTextEditor?.document.lineCount ?? 0;
    }

    getActiveLineIdx(): number | undefined {
        return vscode.window?.activeTextEditor?.selection?.active.line;
    }

    parseActiveLine() {
        this.parseLine(this.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined) {
        this.clear();

        if (lineIdx === undefined) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        if (lineIdx >= editor.document.lineCount) return;

        this.parse(editor.document.lineAt(lineIdx).text);
    }

    parse(lineIn: string | undefined) {
        this.clear();

        if (!lineIn) return;
        if (lineIn.length <= 0) return;
        if (lineIn.trim().length <= 0) return; // skip empty line, or only containing tabs/spaces

        this.line = lineIn;

        lineIn = Strings.convertTabsToSpaces(lineIn);
        lineIn = lineIn.split('"').join("'"); // replace " with '

        // Get indentation by counting tabs.
        let line = Strings.ltrim(lineIn);
        const depth = lineIn.length - line.length;
    
        this.isComment = line.startsWith(COMMENT);

        if (!this.isComment) {
            this.depth = depth;

            line = line.trim();

            this.bullet = line[0] as EBullet;
            line = line.substr(1).trim() // remove bullet
        
            const split = line.split(LABEL_ID_SEP)
            this.label = split[0].trim()
        
            if (split.length > 1) {
                this.components = split[1].trim().split(' ')

                let manageVisibilityComponent = (i: number) => {
                    this.visibility = this.components[i] as EVisibility;
                    this.components.splice(i, 1); // remove 
                }

                for (let i = 0; i < this.components.length; ++i) {
                    switch (this.components[i] as EVisibility) {
                        case EVisibility.eNormal: manageVisibilityComponent(i); break;
                        case EVisibility.eFloor: manageVisibilityComponent(i); break;
                        case EVisibility.eHide: manageVisibilityComponent(i); break;
                    }
                }
            }
        }
    }

    setVisibilityInDoc(lineIdx: number | undefined, visibilityStr: string, callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if ((lineIdx === undefined) || !editor) return;
    
        let lineManager = new LineManager();
        lineManager.parseLine(lineIdx);
        
        if (!lineManager.isValid() || lineManager.isComment) {
            if (callback) callback();
            return;
        }

        editor.edit((editBuilder) => {
            if (lineManager.hasComponents()) {
                let replace = (strIn: string, strOut: string) => {
                    const pos = lineManager.line.indexOf(strIn);
                    const range = new vscode.Range(
                        new vscode.Position(lineIdx, pos),
                        new vscode.Position(lineIdx, pos + strIn.length)
                    );
                    editBuilder.replace(range, strOut);
                };
    
                switch (lineManager.visibility) {
                    case EVisibility.eFloor:
                    case EVisibility.eNormal:
                    case EVisibility.eHide:
                        replace(lineManager.visibility, visibilityStr);
                        break;
                    case EVisibility.eUndefined:
                        replace(
                            LABEL_ID_SEP + " ", 
                            LABEL_ID_SEP + " " + visibilityStr + " ");
                        break;
                }
            } else {
                editBuilder.insert(new vscode.Position(lineIdx, lineManager.line.length), 
                    " " + LABEL_ID_SEP + " " + visibilityStr);
            }
        }).then((success) => {
            if (callback) callback();
        });
    }

    callUnfoldCommand(lineIdx: number | undefined) {
        if (lineIdx === undefined) {
            vscode.commands.executeCommand("editor.unfold");
        } else {
            vscode.commands.executeCommand("editor.unfold", { selectionLines: [lineIdx] });
        }
    }

    callFoldCommand(lineIdx: number | undefined) {
        if (lineIdx === undefined) {
            vscode.commands.executeCommand("editor.fold");
        } else {
            vscode.commands.executeCommand("editor.fold", { selectionLines: [lineIdx] });
        }
    }

    callFoldCommandIfPossible(lineIdx: number | undefined) {
        this.callUnfoldCommand(lineIdx); // unfold first to avoid unexpected behavior if already folded
        let lineManager = new LineManager();
        if (lineManager.isLineFoldable(lineIdx)) {
            this.callFoldCommand(lineIdx);
        }
    }
    
    foldLine(lineIdx: number | undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eFloor);
        this.callFoldCommandIfPossible(lineIdx);
    }
    
    unfoldLine(lineIdx: number | undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal);
        this.callUnfoldCommand(lineIdx);
    }

    hideNode(lineIdx: number | undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eHide);
        this.callFoldCommandIfPossible(lineIdx);
    }
    
    unhideNode(lineIdx: number | undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal);
        this.callUnfoldCommand(lineIdx);
    }

    updateFolding() {
        let lineManager = new LineManager();

        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            lineManager.callUnfoldCommand(i);
        }

        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            lineManager.clear();
            lineManager.parseLine(i);
            
            if ([EVisibility.eFloor, EVisibility.eHide].includes(lineManager.visibility))
                lineManager.callFoldCommandIfPossible(i);
        }
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChained(visibility: EVisibility, lineIdx: number) {
        if (lineIdx < this.getLineCount()) {
            this.setVisibilityInDoc(lineIdx, visibility, () => {
                this.setVisibilityInDocChained(visibility, lineIdx + 1)
            });
        }
    }

    foldAll() {
        this.setVisibilityInDocChained(EVisibility.eFloor, 0);
        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            this.callFoldCommandIfPossible(i);
        }
    }

    unfoldAll() {
        this.setVisibilityInDocChained(EVisibility.eNormal, 0);
        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            this.callUnfoldCommand(i);
        }
    }
}