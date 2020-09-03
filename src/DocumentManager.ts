import * as vscode from 'vscode';

import { LABEL_ID_SEP, EVisibility, NEW_SCRIPT_CHAR, SCRIPT_LINE_TOKEN } from './constants'
import { BulletLine } from './BulletLine';

export function isScriptLine(text: string): Boolean {
    return text.trim().startsWith(SCRIPT_LINE_TOKEN);
}

export class DocumentLine {
    text = "";
    index = -1;
}

export class DocumentManager {
    bulletLines: Array<DocumentLine> = [];
    scriptLines: Array<DocumentLine> = [];

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

    parseActiveLine(): BulletLine {
        return this.parseLine(this.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined): BulletLine {
        let line = new BulletLine();

        if (lineIdx === undefined) return line;
        if (lineIdx < 0) return line;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return line;

        if (lineIdx >= editor.document.lineCount) return line;

        line.parse(editor.document.lineAt(lineIdx).text, lineIdx);

        return line;
    }

    extractLines() {
        let text = vscode.window.activeTextEditor?.document.getText() ?? "";
        if (!text) vscode.window.showErrorMessage('Bullet Graph: No editor is active.');
    
        const lines: Array<string> = text.split(/\r?\n/) ?? []; // new lines
        if (!lines) vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');

        let lineIdx = 0;
        lines.forEach( line => {
            const lineTrim = line.trim();
            if (lineTrim.length > 0) { // skip empty line, or only containing tabs/spaces
                let docLine = new DocumentLine();
                docLine.index = lineIdx;
                if (lineTrim[0] === SCRIPT_LINE_TOKEN) {
                    docLine.text = lineTrim;
                    this.scriptLines.push(docLine);
                } else {
                    docLine.text = line;
                    this.bulletLines.push(docLine);
                }
            }
            lineIdx++;
        });
    }

    parseBulletsLines(): Array<BulletLine> {
        let bulletLines: Array<BulletLine> = [];

        this.bulletLines.forEach( line => {
            let bulletLine = new BulletLine();
            bulletLine.parse(line.text, line.index);
            bulletLines.push(bulletLine);
        });

        return bulletLines;
    }

    setVisibilityInDoc(lineIdx: number | undefined, visibility: EVisibility, selector: any | undefined = undefined, callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if ((lineIdx === undefined) || !editor) return;
    
        const line = this.parseLine(lineIdx);

        const isSelectorRespected = (selector === undefined) || selector(line);

        if (isScriptLine(line.text) || !line.isValid() || line.isComment || (line.visibility == visibility) || !isSelectorRespected) {
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

    callUnfoldCommand(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) {
            vscode.commands.executeCommand("editor.unfold").then(() => { 
                if (completionHandler) completionHandler(); });
        } else {
            vscode.commands.executeCommand("editor.unfold", { selectionLines: [lineIdx] }).then(() => { 
                if (completionHandler) completionHandler(); });
        }
    }

    callFoldCommand(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) {
            vscode.commands.executeCommand("editor.fold").then(() => { 
                if (completionHandler) completionHandler(); });
        } else {
            vscode.commands.executeCommand("editor.fold", { selectionLines: [lineIdx] }).then(() => { 
                if (completionHandler) completionHandler(); });
        }
    }

    callFoldCommandIfPossible(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.callUnfoldCommand(lineIdx, () => { // unfold first to avoid unexpected behavior if already folded
            if (this.isLineFoldable(lineIdx)) {
                this.callFoldCommand(lineIdx, completionHandler);
            } else {
                if (completionHandler) completionHandler();
            }
        });
    }
    
    foldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eFloor, undefined, () => {
            this.callFoldCommandIfPossible(lineIdx, completionHandler);
        });
    }
    
    unfoldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, () => {
            this.callUnfoldCommand(lineIdx, completionHandler);
        });
    }

    hideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eHide);
        this.callFoldCommandIfPossible(lineIdx, completionHandler);
    }
    
    unhideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal);
        this.callUnfoldCommand(lineIdx, completionHandler);
    }

    updateFoldingChained(lineIdx: number, completionHandler: any | undefined = undefined) {
        if (lineIdx >= 0) {
            const line = this.parseLine(lineIdx);
            if ([EVisibility.eFloor, EVisibility.eHide].includes(line.visibility) && line.isValid()) {
                this.callFoldCommandIfPossible(lineIdx, () => { 
                    this.updateFoldingChained(lineIdx - 1, completionHandler);
                });
            } else {
                this.updateFoldingChained(lineIdx - 1, completionHandler);
            }
        } else {
            if (completionHandler) completionHandler();
        }
    }

    updateFolding(completionHandler: any | undefined = undefined) {
        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            this.callUnfoldCommand(i);
        }

        this.updateFoldingChained(this.getLineCount(), completionHandler);
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChained(visibility: EVisibility, lineIdx: number, selector: any | undefined = undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx < this.getLineCount()) {
            this.setVisibilityInDoc(lineIdx, visibility, selector, (lineManager: BulletLine) => {
                this.setVisibilityInDocChained(visibility, lineIdx + 1, selector, completionHandler);
            });
        } else if (completionHandler !== undefined) {
            completionHandler();
        }
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChainedParentsReverse(visibility: EVisibility, lineIdx: number, maxDepth: number, completionHandler: any | undefined = undefined) {
        if (lineIdx >= 0) {
            let selector = (lineManager: BulletLine) => {
                return (maxDepth === undefined) || (lineManager.depth < maxDepth);
            };
            let callback = (lineManager: BulletLine) => {
                let nextMaxDepth = (lineManager.depth >= 0 && lineManager.depth < maxDepth) ? lineManager.depth : maxDepth;
                this.setVisibilityInDocChainedParentsReverse(visibility, lineIdx - 1, nextMaxDepth, completionHandler);
            };
            this.setVisibilityInDoc(lineIdx, visibility, selector, callback);
        } else {
            if (completionHandler) completionHandler();
        }
    }

    foldAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eFloor, 0, undefined, completionHandler);
    }

    unfoldAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, undefined, completionHandler);
    }

    hideAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eHide, 0, undefined, completionHandler);
    }

    unhideAll(completionHandler: any | undefined = undefined) {
        let selector = (line: BulletLine) => { return line.visibility === EVisibility.eHide; }; // only unhide hidden nodes
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, completionHandler);
    }

    revealNode(lineIdx: number, completionHandler: any | undefined = undefined) {
        const line = this.parseLine(lineIdx);

        if (line.visibility === EVisibility.eHide) // special case when start line is hidden
            this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (lineManager: BulletLine) => {
                this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth, completionHandler);
            });
        else
            this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth, completionHandler);
    }
}