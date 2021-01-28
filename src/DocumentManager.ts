import * as vscode from 'vscode';

import { Id, LABEL_ID_SEP, EVisibility, SCRIPT_LINE_TOKEN, ELink, ENABLE_EDITOR_FOLDING } from './constants'
import { Editor, isScriptLine, Strings } from './utils'
import { Bullet } from './Bullet';
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
        let next = this.parseLine(line.lineIdx + 1);
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

    getParentLine(lineIdx: number | undefined): Bullet | undefined {
        if (lineIdx === undefined) return undefined;

        let line = this.parseLine(lineIdx);
        if (!line.isValid()) return undefined;

        for (let i = line.lineIdx - 1; i >= 0; i--) {
            let prev = this.parseLine(i);
            if (prev.isValid() && prev.depth < line.depth) {
                return prev;
            }
        }

        return undefined;
    }

    getLineIdxForId(id: Id, bulletLines: Array<Bullet>): number {
        for (let bulletLine of bulletLines) {
            if (bulletLine.id === id)
                return bulletLine.lineIdx;
        }
        return -1;
    }

    focusLine(line: Bullet) {
        const pos = line.text.length - Strings.ltrim(line.text).length + 2;
        this.focusLineIdx(line.lineIdx, pos);
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

    parseActiveLine(): Bullet {
        return this.parseLine(Editor.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined): Bullet {
        let line = new Bullet();
        if (lineIdx !== undefined)
            line.parse(Editor.getLine(lineIdx), lineIdx);
        return line;
    }

    // Extract text lines, without parsing them, classifying them script/bullet.
    // Does not contain empty lines, but contains comments.
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

    parseBulletsLines(): Array<Bullet> {
        let bulletLines: Array<Bullet> = [];

        this.bulletLines.forEach( line => {
            let bulletLine = new Bullet();
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
    
    foldNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let selector = (line: Bullet) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        this.setVisibilityInDoc(lineIdx, EVisibility.eFold, selector, (line: Bullet) => {
            this.updateChildren(lineIdx, () => { // used to update children visibility
                if (ENABLE_EDITOR_FOLDING)
                    this.callFoldCommandIfPossible(lineIdx, completionHandler);
                else 
                    if (completionHandler) completionHandler();
            });
        });
    }
    
    unfoldNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        let selector = (line: Bullet) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, selector, (line: Bullet) => {
            this.updateChildren(lineIdx, () => { // used to update children visibility
                if (ENABLE_EDITOR_FOLDING)
                    this.callUnfoldCommand(lineIdx, completionHandler);
                else 
                    if (completionHandler) completionHandler();
            });
        });
    }

    hideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eHide, undefined, (line: Bullet) => {
            this.updateChildren(lineIdx, () => { // used to update children visibility
                if (ENABLE_EDITOR_FOLDING)
                    this.callFoldCommandIfPossible(lineIdx, completionHandler);
                else 
                    if (completionHandler) completionHandler();
            });
        });
    }
    
    unhideNode(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (line: Bullet) => {
            this.updateChildren(lineIdx, () => { // used to update children visibility
                if (ENABLE_EDITOR_FOLDING)
                    this.callUnfoldCommand(lineIdx, completionHandler);
                else 
                    if (completionHandler) completionHandler();
            });
        });
    }

    foldAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eFold, 0, undefined, () => {
            if (ENABLE_EDITOR_FOLDING)
                vscode.commands.executeCommand("editor.foldAll").then(() => { if (completionHandler) completionHandler(); });
            else
                if (completionHandler) completionHandler();
            });
    }

    unfoldAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, undefined, () => {
            if (ENABLE_EDITOR_FOLDING)
                vscode.commands.executeCommand("editor.unfoldAll").then(() => { if (completionHandler) completionHandler(); });
            else 
                if (completionHandler) completionHandler();
        });
    }

    hideAll(completionHandler: any | undefined = undefined) {
        this.setVisibilityInDocChained(EVisibility.eHide, 0, undefined, () => {
            if (ENABLE_EDITOR_FOLDING)
                vscode.commands.executeCommand("editor.foldAll").then(() => { if (completionHandler) completionHandler(); });
            else 
                if (completionHandler) completionHandler();
        });
    }

    unhideAll(completionHandler: any | undefined = undefined) {
        let selector = (line: Bullet) => { return line.visibility === EVisibility.eHide; }; // only unhide hidden nodes
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, () => {
            if (ENABLE_EDITOR_FOLDING)
                vscode.commands.executeCommand("editor.unfoldAll").then(() => { if (completionHandler) completionHandler(); });
            else 
                if (completionHandler) completionHandler();
        });
    }
    
    foldChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let selector = (line: Bullet) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        let stopCriteria = (line: Bullet) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDocChained(EVisibility.eFold, nodeBullet.lineIdx + 1, selector, completionHandler, stopCriteria);
    }

    unfoldChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let selector = (line: Bullet) => { return line.visibility !== EVisibility.eHide; }; // must explicitely unhide to unhide
        let stopCriteria = (line: Bullet) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, () => {
            this.setVisibilityInDocChained(EVisibility.eNormal, nodeBullet.lineIdx + 1, selector, completionHandler, stopCriteria);
        });
    }

    hideChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let stopCriteria = (line: Bullet) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        this.setVisibilityInDocChained(EVisibility.eHide, nodeBullet.lineIdx + 1, undefined, completionHandler, stopCriteria);
    }

    unhideChildren(lineIdx: number | undefined, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(lineIdx);
        let stopCriteria = (line: Bullet) => { return line.isValid() && line.depth <= nodeBullet.depth; }; // only children
        let whenDone = (line: Bullet) => { this.updateChildren(lineIdx, completionHandler); }; // used to update children visibility
        this.setVisibilityInDocChained(EVisibility.eNormal, nodeBullet.lineIdx + 1, undefined, whenDone, stopCriteria);
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

    foundAndFocusedSibling(line: Bullet, depth: Number) {
        if (!line.isValid() || (line.depth > depth)) return false; // skip comments and children
        if (line.depth < depth) return true; // reached higher level, stop
        this.focusLine(line);
        return true;
    }

    foundAndFocusedVisible(line: Bullet) {
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
                let line = new Bullet();
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
            let line = new Bullet();
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
            this.updateChildrenChained(line.lineIdx + 1, line.depth, completionHandler);
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

    highlightNode(lineIdx: number, toggle: Boolean, completionHandler: any | undefined = undefined) {
        if (lineIdx === undefined) return;
        const line = this.parseLine(lineIdx);
        line.isHighlight = toggle ? !line.isHighlight : true;
        this.writeComponentSection(line, completionHandler);
    }

    revealNode(lineIdx: number, completionHandler: any | undefined = undefined) {
        let linesToMakeVisible: Array<number> = [];

        let line = this.parseLine(lineIdx);
        let maxDepth = line.depth;
        let firstLine = 0;

        linesToMakeVisible.push(line.lineIdx);

        // Backtrack and node's parents.
        for (let i = lineIdx - 1; i >= 0; i--) {
            line = this.parseLine(i);

            if (!line.isValid()) // skip comments and invalid lines
                continue;

            // Found a parent of current level.
            if (line.depth < maxDepth) {
                linesToMakeVisible.push(line.lineIdx);
                maxDepth = line.depth;
            }

            // Reached highest level. Stop.
            if (line.depth === 0) {
                firstLine = i;
                break;
            }
        }

        // When done setting determined parent nodes (down below), finish by updating node's children.
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

        let selector = (line: Bullet) => { return linesToMakeVisible.includes(line.lineIdx); };
        let stop = (line: Bullet) => { return line.lineIdx >= lineIdx; };

        this.setVisibilityInDocChained(EVisibility.eNormal, firstLine, selector, completionHandlerPlus, stop);
    }

    findLinesLinkedToNode(bullets: Array<Bullet>, nodeBullet: Bullet, lines: Array<number>) {
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
            if (bullet.idsIn.includes(nodeBullet.id)) lines.push(bullet.lineIdx);
            if (bullet.idsOut.includes(nodeBullet.id)) lines.push(bullet.lineIdx);
        }
    }

    connectNode(nodeLineIdx: number, connectHierarchy: Boolean, completionHandler: any | undefined = undefined) {
        const nodeBullet = this.parseLine(nodeLineIdx);
        if (nodeBullet.isValid()) {
            this.extractLines();
            const bullets = this.parseBulletsLines();

            // Find the index of the current node in the bullet list.
            const nodeIdx = bullets.findIndex( bullet => bullet.lineIdx === nodeBullet.lineIdx );
    
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
        let selectorMerged = (line: Bullet) => {
            let resultSelector = true;
            let resultStopCriteria = false;
            if (stopCriteria) resultStopCriteria = stopCriteria(line);
            if (selector) resultSelector = selector(line);
            return resultSelector && !resultStopCriteria;
        };

        if (lineIdx < Editor.getLineCount()) {
            this.setVisibilityInDoc(lineIdx, visibility, selectorMerged, (bullet: Bullet) => {
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

        if (visibility === EVisibility.eHide)
            line.isHighlight = false;

        line.visibility = visibility;
        this.writeComponentSection(line, callback);
    }

    writeComponentSection(line: Bullet, callback: any | undefined = undefined) {
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
                new vscode.Position(line.lineIdx, pos),
                new vscode.Position(line.lineIdx, line.text.length)
            );
            editBuilder.replace(range, newCompString);

        }).then((success) => {
            if (callback) callback(line);
        });
    }
}