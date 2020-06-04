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

    isActiveLineFoldable(): boolean {
        const activeLineIdx = this.getActiveLineIdx();
        if (!activeLineIdx) return false;

        // Next line.
        this.parseLine(activeLineIdx + 1);
        if (!this.isValid()) return false;
        const nextLineDepth = this.depth;

        // Active line. Do it last so that line state is active line.
        this.parseLine(activeLineIdx);
        if (!this.isValid()) return false;
        const activeLineDepth = this.depth;

        return nextLineDepth > activeLineDepth;
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
                    }
                }
            }
        }
    }

    setVisibilityInDoc(visibilityStr: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
    
        let line = new LineManager();
    
        const lineIdx = line.getActiveLineIdx();
        if (lineIdx === undefined) return;
    
        line.parseActiveLine();
        if (!line.isValid() || line.isComment) return;
    
        editor.edit((editBuilder) => {
            if (line.hasComponents()) {
                let replace = (strIn: string, strOut: string) => {
                    const pos = line.line.indexOf(strIn);
                    const range = new vscode.Range(
                        new vscode.Position(lineIdx, pos),
                        new vscode.Position(lineIdx, pos + strIn.length)
                    );
                    editBuilder.replace(range, strOut);
                };
    
                switch (line.visibility) {
                    case EVisibility.eFloor:
                    case EVisibility.eNormal:
                        replace(line.visibility, visibilityStr);
                        break;
                    case EVisibility.eUndefined:
                        replace(
                            LABEL_ID_SEP + " ", 
                            LABEL_ID_SEP + " " + visibilityStr + " ");
                        break;
                }
            } else {
                editBuilder.insert(new vscode.Position(lineIdx, line.line.length), 
                    " " + LABEL_ID_SEP + " " + visibilityStr);
            }
        });
    }
    
    foldLine() {
        this.setVisibilityInDoc(EVisibility.eFloor);
    
        let lineManager = new LineManager();
        if (lineManager.isActiveLineFoldable()) {
            vscode.commands.executeCommand("editor.fold");
        }
    }
    
    unfoldLine() {
        this.setVisibilityInDoc(EVisibility.eNormal);
        vscode.commands.executeCommand("editor.unfold");
    }
}