import * as vscode from 'vscode';

import { Id, LABEL_ID_SEP, EVisibility, NEW_SCRIPT_CHAR, SCRIPT_LINE_TOKEN } from './constants'
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

    isLineParent(lineIdx: number | undefined) {
        if (lineIdx === undefined) return false;

        let line = this.parseLine(lineIdx);
        if (!line.isValid()) return false;

        for (let i = lineIdx + 1; i < this.getLineCount(); i++) {
            let next = this.parseLine(i);
            if (next.isValid()) {
                if (next.depth > line.depth)
                    return true;
                else 
                    return false;
            }
        }
   
        return false;
    }

    isLineFoldableByEditor(lineIdx: number | undefined): boolean {
        if (lineIdx === undefined) return false;

        // The direct next line must be indented.
        let line = this.parseLine(lineIdx);
        let next = this.parseLine(line.index + 1);
        if (!next.isValid()) return false;
        if (!line.isValid()) return false;
        return next.depth > line.depth;
    }

    isLineHiddenByFold(lineIdx: number | undefined) {
        let parent = this.getParentLine(lineIdx);
        return parent && (parent.visibility === EVisibility.eFold || (parent.visibility === EVisibility.eFoldHidden));
    }

    isLineHiddenByParentHide(lineIdx: number | undefined) {
        let parent = this.getParentLine(lineIdx);
        return parent && parent.visibility === EVisibility.eHide;
    }

    getParentLine(lineIdx: number | undefined): BulletLine | undefined {
        if (lineIdx === undefined) return undefined;

        let line = this.parseLine(lineIdx);
        if (!line.isValid()) return undefined;

        for (let i = line.index - 1; i >= 0; i--) {
            let prev = this.parseLine(i);
            if (prev.isValid() && prev.depth < line.depth) {
                return prev;
            }
        }

        return undefined;
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

        // If node is hidden, make sure its visibility is hidden.
        if (this.isLineHiddenByParentHide(lineIdx)) {
            visibility = EVisibility.eHide;
        }

        // For a fold hidden node, the only visibility change possible is hide.
        else if (this.isLineHiddenByFold(lineIdx) && (visibility !== EVisibility.eHide)) {
            visibility = EVisibility.eFoldHidden;
        }

        // Do not set fold visibility on a leaf (no child), as useless.
        else if (!this.isLineParent(lineIdx) && (visibility === EVisibility.eFold)) {
            visibility = EVisibility.eNormal;
        }

        const isSelectorRespected = (selector === undefined) || selector(line);

        if (isScriptLine(line.text) || !line.isValid() || line.isComment || (line.visibility == visibility) || !isSelectorRespected) {
            if (callback) callback(line);
            return;
        }

        const isVisibilityCompOptional = visibility === EVisibility.eNormal;
        const hasVisibilityComp = line.visibility !== EVisibility.eNormal;

        // Possible cases. They should be exclusive, so testing order is not important.
        const mustRemoveComponentSection = line.hasComponentSection && !line.hasComponents && isVisibilityCompOptional;
        const mustCreateComponentSection = !line.hasComponentSection && !isVisibilityCompOptional;
        const mustInsertVisibilityComp = line.hasComponentSection && !hasVisibilityComp && !isVisibilityCompOptional;
        const mustReplaceVisibilityComp = hasVisibilityComp && !isVisibilityCompOptional;
        const mustRemoveVisibilityCompOnly = line.hasComponents && hasVisibilityComp && isVisibilityCompOptional;

        editor.edit((editBuilder) => {
            let replace = (strIn: string, strOut: string) => {
                const pos = line.text.indexOf(strIn);
                if (pos >= 0) {
                    const range = new vscode.Range(
                        new vscode.Position(lineIdx, pos),
                        new vscode.Position(lineIdx, pos + strIn.length)
                    );
                    editBuilder.replace(range, strOut);
                }
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
                replace(" " + line.visibility, "");
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
            if (this.isLineFoldableByEditor(lineIdx)) {
                this.callFoldCommand(lineIdx, completionHandler);
            } else {
                if (completionHandler) completionHandler();
            }
        });
    }
    
    foldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eFold, undefined, (line: BulletLine) => {
            this.updateChildren(lineIdx, completionHandler); // used to update children visibility
        });
    }
    
    unfoldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (line: BulletLine) => {
           this.updateChildren(lineIdx, completionHandler); // used to update children visibility
        });
    }

    hideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eHide, undefined, (line: BulletLine) => {
            this.updateChildren(lineIdx, completionHandler); // used to update children visibility
        });
    }
    
    unhideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (line: BulletLine) => {
            this.updateChildren(lineIdx, completionHandler); // used to update children visibility
        });
    }

    updateFoldingChained(lineIdx: number, completionHandler: any | undefined = undefined) {
        if (lineIdx >= 0) {
            const line = this.parseLine(lineIdx);
            if ([EVisibility.eFold, EVisibility.eHide].includes(line.visibility) && line.isValid()) {
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
        for (let i = this.getLineCount() - 1; i >= 0; --i)
            this.callUnfoldCommand(i);

        this.updateFoldingChained(this.getLineCount(), completionHandler);
    }

    // Bleh. Document edit promise must resolve before doing another. Should do this more cleanly.
    setVisibilityInDocChained(visibility: EVisibility, lineIdx: number, selector: any | undefined = undefined, completionHandler: any | undefined = undefined, stopCriteria: any | undefined = undefined) {
        // Merge selector filter and stop criteria into a single selector, to not process line if it passes
        // the selector, but triggers stop criteria.
        let selectorMerged = (line: BulletLine) => {
            let resultSelector = true;
            let resultStopCriteria = false;
            if (stopCriteria) resultStopCriteria = stopCriteria(line);
            if (selector) resultSelector = selector(line);
            return resultSelector && !resultStopCriteria;
        };

        if (lineIdx < this.getLineCount()) {
            this.setVisibilityInDoc(lineIdx, visibility, selectorMerged, (bullet: BulletLine) => {
                if (!stopCriteria || !stopCriteria(bullet))
                        this.setVisibilityInDocChained(visibility, lineIdx + 1, selector, completionHandler, stopCriteria);
                else if (completionHandler !== undefined) {
                    completionHandler();
                }
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
        this.setVisibilityInDocChained(EVisibility.eFold, 0, undefined, completionHandler);
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
    
    foldChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let stopCriteria = (line: BulletLine) => { return line.depth <= nodeBullet.depth; };
        this.setVisibilityInDocChained(EVisibility.eFold, nodeBullet.index + 1, undefined, completionHandler, stopCriteria);
    }
    
    updateChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const line = this.parseLine(lineIdx);
        if (line.isValid())
            this.updateChildrenChained(line.index + 1, line.depth, completionHandler);
    }

    updateChildrenChained(lineIdx: number, minDepth: number, completionHandler: any | undefined = undefined) {
        let call = (visibility: EVisibility) => {
            this.setVisibilityInDoc(lineIdx, visibility, undefined, () => {
                this.updateChildrenChained(lineIdx + 1, minDepth, completionHandler);
            });
        }
        const line = this.parseLine(lineIdx);
        if (line.depth > minDepth && lineIdx < this.getLineCount()) {
            if (this.isLineHiddenByParentHide(lineIdx)) call(EVisibility.eHide);
            else if (this.isLineHiddenByFold(lineIdx)) call(EVisibility.eFoldHidden);
            else if (line.visibility === EVisibility.eFoldHidden) call(EVisibility.eFold);
        } else {
            if (completionHandler !== undefined) completionHandler();
        }
    }

    revealNode(lineIdx: number, completionHandler: any | undefined = undefined) {
        const line = this.parseLine(lineIdx);

        let completionHandlerPlus = () => {
            // Fold children to make sure they are not hidden, to avoid missing underlying interactions.
            // Do it at the end, to make sure the folded node visibility is up to date.
            this.foldChildren(lineIdx, () => {
                if (completionHandler) completionHandler();
            })
        };

        if (line.visibility === EVisibility.eHide) { // special case when start line is hidden
            this.setVisibilityInDoc(lineIdx, EVisibility.eFold, undefined, () => {
                this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth, completionHandlerPlus);
            });
        } else {
            this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, line.depth, completionHandlerPlus);
        }
    }

    foldLevel(level: number, completionHandler: any | undefined = undefined) {
        this.foldAll(() => {
            let selector = (line: BulletLine) => { return line.depth <= level; };
            this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, () => { // unfold
                this.updateFolding(completionHandler);
            });
        });
    }

    getLineIdxForId(id: Id, bulletLines: Array<BulletLine>): number {
        for (let bulletLine of bulletLines) {
            if (bulletLine.id === id)
                return bulletLine.index;
        }
        return -1;
    }

    revealNodeChained(linesToReveal: Array<number>, idx: number, completionHandler: any | undefined = undefined) {
        if (idx < linesToReveal.length) {
            this.revealNode(linesToReveal[idx], () => {
                this.revealNodeChained(linesToReveal, idx + 1, completionHandler);
            })
        } else {
            if (completionHandler) completionHandler();
        }
    }

    findLinesLinkedToNode(bullets: Array<BulletLine>, nodeBullet: BulletLine, lines: Array<number>) {
        let addLinkedNodeLines = (linkedIds: Array<Id>) => {
            for (let id of linkedIds) {
                let idx = this.getLineIdxForId(id, bullets);
                if (idx >= 0) lines.push(idx);
            }
        }

        // Added lines that the node directly link.
        addLinkedNodeLines(nodeBullet.idsIn);
        addLinkedNodeLines(nodeBullet.idsOut);

        // Add
        for (let bullet of bullets) {
            if (bullet.idsIn.includes(nodeBullet.id)) lines.push(bullet.index);
            if (bullet.idsOut.includes(nodeBullet.id)) lines.push(bullet.index);
        }
    }

    connectNode(nodeLineIdx: number, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(nodeLineIdx);
        if (nodeBullet.isValid()) {
            this.extractLines();
            const bullets = this.parseBulletsLines();

            // Find the index of the current node in the bullet list.
            const nodeIdx = bullets.findIndex( bullet => bullet.index === nodeBullet.index );
    
            // Initialize the array of lines on which to call revealNode command.
            let linesToReveal: Array<number> = [];
            linesToReveal.push(nodeLineIdx);

            // Link current node.
            this.findLinesLinkedToNode(bullets, nodeBullet, linesToReveal);

            // Link all children of current node.
            for (let i = nodeIdx; i < bullets.length; i++)
                if (bullets[i].depth > nodeBullet.depth)
                    this.findLinesLinkedToNode(bullets, bullets[i], linesToReveal);
                else if (bullets[i].depth <= nodeBullet.depth)
                    break; // stop when no longer a child

            // Link all parents of current node.
            let maxDepth = nodeBullet.depth;
            for (let i = nodeIdx; i >= 0; i--)
                if (bullets[i].depth < maxDepth) {
                    this.findLinesLinkedToNode(bullets, bullets[i], linesToReveal);
                    maxDepth = bullets[i].depth;
                }

            // Remove duplicates and sort.
            linesToReveal = [...new Set(linesToReveal)];
            linesToReveal.sort();
            
            this.revealNodeChained(linesToReveal, 0, completionHandler);
        } else {
            if (completionHandler) completionHandler();
        }
    }
}