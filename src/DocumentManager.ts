import * as vscode from 'vscode';

import { LABEL_ID_SEP, EVisibility } from './constants'
import { LineManager } from './LineManager';

export class DocumentManager {
    bulletLines: Array<LineManager> = [];

    isLineFoldable(lineIdx: number | undefined): boolean {
        if (lineIdx === undefined) return false;

        // Next line.
        let line = this.parseLine(lineIdx + 1);
        if (!line.isValid()) return false;
        const nextLineDepth = line.depth;

        // Specified line. Do it last so that line state is active line.
        line = this.parseLine(lineIdx);
        if (!line.isValid()) return false;
        const activeLineDepth = line.depth;

        return nextLineDepth > activeLineDepth;
    }

    getLineCount(): number {
        return vscode.window.activeTextEditor?.document.lineCount ?? 0;
    }

    getActiveLineIdx(): number | undefined {
        return vscode.window?.activeTextEditor?.selection?.active.line;
    }

    parseActiveLine(): LineManager {
        return this.parseLine(this.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined): LineManager {
        let line = new LineManager();

        if (lineIdx === undefined) return line;
        if (lineIdx < 0) return line;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return line;

        if (lineIdx >= editor.document.lineCount) return line;

        line.parse(editor.document.lineAt(lineIdx).text);

        return line;
    }

    parseEditorFile() {
        let text = vscode.window.activeTextEditor?.document.getText() ?? "";
        if (!text) vscode.window.showErrorMessage('Bullet Graph: No editor is active.');
        
        this.bulletLines = [];
    
        const lines = text.split(/\r?\n/) ?? []; // new lines
        if (!lines) vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');
    
        lines.forEach( line => {
            if (line.trim().length > 0) { // skip empty line, or only containing tabs/spaces
                let bulletLine = new LineManager();
                bulletLine.parse(line);
                this.bulletLines.push(bulletLine);
            }
        })
    }

    setVisibilityInDoc(lineIdx: number | undefined, visibility: EVisibility, selector: any | undefined = undefined, callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if ((lineIdx === undefined) || !editor) return;
    
        const line = this.parseLine(lineIdx);

        const isSelectorRespected = (selector === undefined) || selector(line);

        if (!line.isValid() || line.isComment || (line.visibility == visibility) || !isSelectorRespected) {
            if (callback) callback(line);
            return;
        }

        const isVisibilityCompOptional = (visibility == EVisibility.eNormal) || (visibility == EVisibility.eUndefined);
        const hasVisibilityComp = line.visibility !== EVisibility.eUndefined;

        // Possible cases. They should be exclusive, so testing order is not important.
        const mustRemoveComponentSection = line.hasComponentSection && !line.hasComponents && isVisibilityCompOptional;
        const mustCreateComponentSection = !line.hasComponentSection && !isVisibilityCompOptional;
        const mustInsertVisibilityComp = line.hasComponentSection && !hasVisibilityComp && !isVisibilityCompOptional;
        const mustReplaceVisibilityComp = hasVisibilityComp && !isVisibilityCompOptional;
        const mustRemoveVisibilityCompOnly = line.hasComponents && hasVisibilityComp && isVisibilityCompOptional;

        editor.edit((editBuilder) => {
            let replace = (strIn: string, strOut: string) => {
                const pos = line.text.indexOf(strIn);
                const range = new vscode.Range(
                    new vscode.Position(lineIdx, pos),
                    new vscode.Position(lineIdx, pos + strIn.length)
                );
                editBuilder.replace(range, strOut);
            };

            if (mustRemoveComponentSection) {
                let compPos = line.text.indexOf(LABEL_ID_SEP);
                if (compPos > 0) {
                    if (line.text[compPos-1] === " ") compPos--; // remove trailing space if necessary
                    replace(line.text, line.text.substr(0, compPos));
                }
            } else if (mustCreateComponentSection) {
                editBuilder.insert(new vscode.Position(lineIdx, line.text.length), 
                    " " + LABEL_ID_SEP + " " + visibility);
            } else if (mustInsertVisibilityComp) {
                replace(
                    LABEL_ID_SEP, 
                    LABEL_ID_SEP + " " + visibility)
            } else if (mustReplaceVisibilityComp) {
                replace(line.visibility, visibility);
            } else if (mustRemoveVisibilityCompOnly) {
                replace(
                    LABEL_ID_SEP + " " + line.visibility + " ",
                    LABEL_ID_SEP + " ");
            }
        }).then((success) => {
            if (callback) callback(line);
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
        if (this.isLineFoldable(lineIdx)) {
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
        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            this.callUnfoldCommand(i);
        }

        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            const line = this.parseLine(i);
            if ([EVisibility.eFloor, EVisibility.eHide].includes(line.visibility))
                this.callFoldCommandIfPossible(i);
        }
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChained(visibility: EVisibility, lineIdx: number, selector: any | undefined = undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx < this.getLineCount()) {
            this.setVisibilityInDoc(lineIdx, visibility, selector, (lineManager: LineManager) => {
                this.setVisibilityInDocChained(visibility, lineIdx + 1, selector, completionHandler);
            });
        } else if (completionHandler !== undefined) {
            completionHandler();
        }
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChainedParentsReverse(visibility: EVisibility, lineIdx: number, maxDepth: number) {
        if (lineIdx >= 0) {
            let selector = (lineManager: LineManager) => {
                return (maxDepth === undefined) || (lineManager.depth < maxDepth);
            };
            let completionHandler = (lineManager: LineManager) => {
                let nextMaxDepth = (lineManager.depth >= 0 && lineManager.depth < maxDepth) ? lineManager.depth : maxDepth;
                this.setVisibilityInDocChainedParentsReverse(visibility, lineIdx - 1, nextMaxDepth);
            };
            this.setVisibilityInDoc(lineIdx, visibility, selector, completionHandler);
        }
    }

    foldAll() {
        this.setVisibilityInDocChained(EVisibility.eFloor, 0);
        // for (let i = this.getLineCount() - 1; i >= 0; --i) {
        //     this.callFoldCommandIfPossible(i);
        // }
    }

    unfoldAll() {
        this.setVisibilityInDocChained(EVisibility.eNormal, 0);
        // for (let i = this.getLineCount() - 1; i >= 0; --i) {
        //     this.callUnfoldCommand(i);
        // }
    }

    hideAll() {
        this.setVisibilityInDocChained(EVisibility.eHide, 0);
        // for (let i = this.getLineCount() - 1; i >= 0; --i) {
        //     this.callFoldCommandIfPossible(i);
        // }
    }

    unhideAll() {
        let selector = (line: LineManager) => { return line.visibility === EVisibility.eHide; }; // only unhide hidden nodes
        let completionHandler = () => { /* this.updateFolding(); */ };
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, completionHandler);
    }

    revealNode(lineIdx: number) {
        const line = this.parseActiveLine();

        if (line.visibility === EVisibility.eHide) // special case when start line is hidden
            this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (lineManager: LineManager) => {
                this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth);
            });
        else
            this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth);
    }
}