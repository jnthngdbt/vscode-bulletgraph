import * as vscode from 'vscode';

import { Id, LABEL_ID_SEP, EVisibility, SCRIPT_LINE_TOKEN, ELink } from './constants'
import { Editor, isScriptLine, Strings } from './utils'
import { BulletLine } from './BulletLine';
import { generateCompactRandomId } from './NodeIdGenerator';

export class DocumentLine {
    text = "";
    index = -1;
}

export class DocumentManager {
    bulletLines: Array<DocumentLine> = [];
    scriptLines: Array<DocumentLine> = [];

    clear() {
        this.bulletLines = [];
        this.scriptLines = [];
    }

    isLineParent(lineIdx: number | undefined) {
        if (lineIdx === undefined) return false;

        let line = this.parseLine(lineIdx);
        if (!line.isValid()) return false;

        for (let i = lineIdx + 1; i < Editor.getLineCount(); i++) {
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

    getLineIdxForId(id: Id, bulletLines: Array<BulletLine>): number {
        for (let bulletLine of bulletLines) {
            if (bulletLine.id === id)
                return bulletLine.index;
        }
        return -1;
    }

    focusLine(line: BulletLine) {
        const pos = line.text.length - Strings.ltrim(line.text).length + 2;
        this.focusLineIdx(line.index, pos);
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

    parseActiveLine(): BulletLine {
        return this.parseLine(Editor.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined): BulletLine {
        let line = new BulletLine();
        if (lineIdx !== undefined)
            line.parse(Editor.getLine(lineIdx), lineIdx);
        return line;
    }

    // Extract text lines, without parsing them, classifying them script/bullet.
    extractLines() {
        const lines = Editor.getAllLines();
        if (!lines) vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');

        this.clear();

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
        let selector = (line: BulletLine) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        this.setVisibilityInDoc(lineIdx, EVisibility.eFold, selector, (line: BulletLine) => {
            this.updateChildren(lineIdx, completionHandler); // used to update children visibility
        });
    }
    
    unfoldLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let selector = (line: BulletLine) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, selector, (line: BulletLine) => {
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
        let selector = (line: BulletLine) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        let stopCriteria = (line: BulletLine) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDocChained(EVisibility.eFold, nodeBullet.index + 1, selector, completionHandler, stopCriteria);
    }

    unfoldChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let selector = (line: BulletLine) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        let stopCriteria = (line: BulletLine) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, () => {
            this.setVisibilityInDocChained(EVisibility.eNormal, nodeBullet.index + 1, selector, completionHandler, stopCriteria);
        });
    }

    hideChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let stopCriteria = (line: BulletLine) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDocChained(EVisibility.eHide, nodeBullet.index + 1, undefined, completionHandler, stopCriteria);
    }

    unhideChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let stopCriteria = (line: BulletLine) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        let whenDone = (line: BulletLine) => { this.updateChildren(lineIdx, completionHandler); }; // used to update children visibility
        this.setVisibilityInDocChained(EVisibility.eNormal, nodeBullet.index + 1, undefined, whenDone, stopCriteria);
    }

    foldLevel(level: number, completionHandler: any | undefined = undefined) {
        this.foldAll(() => {
            let selector = (line: BulletLine) => { return line.isValid() && line.depth <= level; };
            this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, () => { // unfold
                this.updateFolding(completionHandler);
            });
        });
    }

    goUp(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        let line = this.parseLine(lineIdx);
        const depth = line.depth;
        for (let i = lineIdx - 1; i >= 0; i--) {
            line = this.parseLine(i);
            if (line.isValid() && (line.depth < depth)) {
                this.focusLine(line);
                break;
            }
        }
        if (completionHandler) completionHandler();
    }

    goDown(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        let line = this.parseLine(lineIdx);
        const depth = line.depth;
        for (let i = lineIdx + 1; i < Editor.getLineCount(); i++) {
            line = this.parseLine(i);
            if (line.isValid()) {
                if (line.depth > depth)
                    this.focusLine(line);
                break;
            }
        }
        if (completionHandler) completionHandler();
    }

    goNext(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        let line = this.parseLine(lineIdx);
        for (let i = lineIdx + 1; i < Editor.getLineCount(); i++)
            if (this.foundAndFocusedSibling(this.parseLine(i), line.depth))
                break;
        if (completionHandler) completionHandler();
    }

    goBack(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        let line = this.parseLine(lineIdx);
        for (let i = lineIdx - 1; i >= 0; i--)
            if (this.foundAndFocusedSibling(this.parseLine(i), line.depth))
                break;
        if (completionHandler) completionHandler();
    }

    foundAndFocusedSibling(line: BulletLine, depth: Number) {
        if (!line.isValid() || (line.depth > depth)) return false; // skip comments and children
        if (line.depth < depth) return true; // reached higher level, stop
        this.focusLine(line);
        return true;
    }

    foundAndFocusedVisible(line: BulletLine) {
        const found = line.isValid() && (line.visibility === EVisibility.eNormal || line.visibility === EVisibility.eFold);
        if (found) {
            this.focusLine(line);
            return true;
        }
        return false;
    }

    goNextVisible(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        for (let i = lineIdx + 1; i < Editor.getLineCount(); i++)
            if (this.foundAndFocusedVisible(this.parseLine(i)))
                break;
        if (completionHandler) completionHandler();
    }

    goBackVisible(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        for (let i = lineIdx - 1; i >= 0; i--)
            if (this.foundAndFocusedVisible(this.parseLine(i)))
                break;
        if (completionHandler) completionHandler();
    }

    goToLine(completionHandler: any | undefined = undefined) {
        Editor.showLineQuickPick((selectedLine: any) => {
            if (selectedLine) {
                this.focusLine(this.parseLine(selectedLine.index));
            }
            if (completionHandler) completionHandler();
        });
    }

    getQuickPickLineIdAndCreateOneIfNecessary(callback: (id: string) => void) {
        Editor.showLineQuickPick((selectedLine: any) => {
            if (selectedLine) {
                let line = new BulletLine();
                line.parse(selectedLine.label, selectedLine.index);

                if (line.isRandomId) {
                    line.id = generateCompactRandomId();
                    line.isRandomId = false;
                    this.writeComponentSection(line, () => callback(line.id));
                } else {
                    callback(line.id);
                }
            }
        });
    }

    addLink(link: ELink, completionHandler: any | undefined = undefined) {
        this.getQuickPickLineIdAndCreateOneIfNecessary((id: string) => {
            let line = new BulletLine();
            line.parseActiveLine();

            switch (link) {
                case ELink.eIn: line.idsIn.push(id); break;
                case ELink.eOut: line.idsOut.push(id); break;
                default: break;
            }
            
            this.writeComponentSection(line, completionHandler);
        });
    }

    insertIdFromOtherLine(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.getQuickPickLineIdAndCreateOneIfNecessary((id: string) => {
            Editor.insertTextAtActivePosition(id);
        });
    }

    updateFolding(completionHandler: any | undefined = undefined) {
        for (let i = Editor.getLineCount() - 1; i >= 0; --i)
            this.callUnfoldCommand(i);

        this.updateFoldingChained(Editor.getLineCount(), completionHandler);
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

        if (lineIdx >= Editor.getLineCount()) {
            if (completionHandler !== undefined) completionHandler();
            return;
        }

        const line = this.parseLine(lineIdx);

        if (line.isValid()) {
            if (line.depth > minDepth) { // only consider children
                if (line.visibility === EVisibility.eHide) call(EVisibility.eHide);
                else if (this.isLineHiddenByParentHide(lineIdx)) call(EVisibility.eHide);
                else if (this.isLineHiddenByFold(lineIdx)) call(EVisibility.eFoldHidden);
                else if (line.visibility === EVisibility.eFoldHidden) call(EVisibility.eFold);
                else this.updateChildrenChained(lineIdx + 1, minDepth, completionHandler);
            } else {
                if (completionHandler !== undefined) completionHandler();
            }    
        } else {
            this.updateChildrenChained(lineIdx + 1, minDepth, completionHandler);
        }
    }

    revealNode(lineIdx: number, completionHandler: any | undefined = undefined) {
        let linesToMakeVisible: Array<number> = [];

        let line = this.parseLine(lineIdx);
        let maxDepth = line.depth;
        let firstLine = 0;

        linesToMakeVisible.push(line.index);

        for (let i = lineIdx - 1; i >= 0; i--) {
            line = this.parseLine(i);

            if (!line.isValid())
                continue;

            if (line.depth < maxDepth) {
                linesToMakeVisible.push(line.index);
                maxDepth = line.depth;
            }

            if (line.depth === 0) {
                firstLine = i;
                break;
            }
        }

        let completionHandlerPlus = () => {
            this.setVisibilityInDoc(lineIdx, EVisibility.eFold, undefined, () => {
                // Make sure children are not hidden, to avoid missing underlying interactions.
                // Do it at the end, to make sure the folded node visibility is up to date.
                this.unhideChildren(lineIdx, () => {
                    // Update to be in a valid state.
                    this.updateChildren(firstLine, () => {
                        if (completionHandler) completionHandler();
                    })
                })
            });
        };

        let selector = (line: BulletLine) => { return linesToMakeVisible.includes(line.index); };
        let stop = (line: BulletLine) => { return line.index >= lineIdx; };

        this.setVisibilityInDocChained(EVisibility.eNormal, firstLine, selector, completionHandlerPlus, stop);
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

        // Add lines that directly link to the node.
        for (let bullet of bullets) {
            if (bullet.idsIn.includes(nodeBullet.id)) lines.push(bullet.index);
            if (bullet.idsOut.includes(nodeBullet.id)) lines.push(bullet.index);
        }
    }

    connectNode(nodeLineIdx: number, connectHierarchy: Boolean, completionHandler: any | undefined = undefined) {
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
            for (let i = nodeIdx + 1; i < bullets.length; i++)
                if (bullets[i].isValid())
                    if (bullets[i].depth > nodeBullet.depth)
                        this.findLinesLinkedToNode(bullets, bullets[i], linesToReveal);
                    else if (bullets[i].depth <= nodeBullet.depth)
                        break; // stop when no longer a child

            // Link all parents of current node.
            if (connectHierarchy) {
                let maxDepth = nodeBullet.depth;
                for (let i = nodeIdx; i >= 0; i--)
                    if (bullets[i].isValid())
                        if (bullets[i].depth < maxDepth) {
                            this.findLinesLinkedToNode(bullets, bullets[i], linesToReveal);
                            maxDepth = bullets[i].depth;
                        }
            }

            // Remove duplicates and sort.
            linesToReveal = [...new Set(linesToReveal)];
            linesToReveal.sort();
            
            this.revealNodeChained(linesToReveal, 0, completionHandler);
        } else {
            if (completionHandler) completionHandler();
        }
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

        if (lineIdx < Editor.getLineCount()) {
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
    
    setVisibilityInDoc(lineIdx: number | undefined, visibility: EVisibility, selector: any | undefined = undefined, callback: any | undefined = undefined) {
        if (lineIdx === undefined) return;
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

        line.visibility = visibility;
        this.writeComponentSection(line, callback);
    }

    writeComponentSection(line: BulletLine, callback: any | undefined = undefined) {
        let newCompString = line.generateComponentSectionString();

        let pos = line.text.indexOf(LABEL_ID_SEP);
        if (pos < 0 && newCompString.length === 0) return; // nothing to do

        if (pos < 0) {
            if (line.text[line.text.length - 1] !== " ")
                newCompString = " " + newCompString; // add a space if not already ending with a space
            pos = line.text.length;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        editor.edit((editBuilder) => {
            const range = new vscode.Range(
                new vscode.Position(line.index, pos),
                new vscode.Position(line.index, line.text.length)
            );
            editBuilder.replace(range, newCompString);

        }).then((success) => {
            if (callback) callback(line);
        });
    }
}