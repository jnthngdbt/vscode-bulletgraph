import * as vscode from 'vscode';

import { COMMENT, LABEL_ID_SEP, HIGHLIGHT_TOKEN, EBullet, ELink, EVisibility } from './constants'
import { Strings } from './utils'

import { generateRandomId } from './NodeIdGenerator'

export class LineManager {
    line = "";
    isComment = false;
    depth = -1;
    bullet = EBullet.eDefault;
    label = "";
    visibility = EVisibility.eUndefined;
    isHighlight = false;
    id = "";
    idsIn: Array<string> = [];
    idsOut: Array<string> = [];
    hasComponents = false;
    hasComponentSection = false;

    clear() {
        this.line = "";
        this.isComment = false;
        this.depth = -1;
        this.bullet = EBullet.eDefault;
        this.label = "";
        this.visibility = EVisibility.eUndefined;
        this.isHighlight = false;
        this.id = "";
        this.idsIn = [];
        this.idsOut = [];
        this.hasComponents = false;
        this.hasComponentSection = false;
    }

    isValid(): boolean {
        return !this.isComment && (this.depth >= 0);
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
        if (lineIdx < 0) return;

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

            this.hasComponentSection = split.length > 1;

            this.id = generateRandomId();
        
            if (!this.hasComponentSection) {
                this.hasComponents = false;
            } else {
                let components = split[1].trim().split(' ')

                // Extract visibility, if present.
                for (let i = 0; i < components.length; ++i) {
                    switch (components[i] as EVisibility) {
                        case EVisibility.eNormal: this.visibility = components[i] as EVisibility; break;
                        case EVisibility.eFloor: this.visibility = components[i] as EVisibility; break;
                        case EVisibility.eHide: this.visibility = components[i] as EVisibility; break;
                        default: { // not visibility token
                            if (components[i] === HIGHLIGHT_TOKEN) {
                                this.isHighlight = true;
                            } else { // id (node id or link id)
                                let id = components[i].trim();
                                if (id) {
                                    let type = id[0] as ELink; // first char is the link type (if any)
                                    id = Strings.removeSpecialCharacters(id);
                                    
                                    if (type === ELink.eOut) {
                                        this.idsOut.push(id);
                                    } else if (type === ELink.eIn) {
                                        this.idsIn.push(id);
                                    } else { // no link type char, or no at all
                                        this.id = id // assume it is the current node id
                                    }
                                }
                            }
                        }
                    }
                }

                // True if the component section contains something other than a visibility token.
                let hasVisibility = this.visibility != EVisibility.eUndefined;
                this.hasComponents = (components.length > 1) || !hasVisibility; // being here, we know we have at least 1 component, may be visibility
            }
        }
    }

    setVisibilityInDoc(lineIdx: number | undefined, visibility: EVisibility, selector: any | undefined = undefined, callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if ((lineIdx === undefined) || !editor) return;
    
        let lineManager = new LineManager();
        lineManager.parseLine(lineIdx);

        const isSelectorRespected = (selector === undefined) || selector(lineManager);

        if (!lineManager.isValid() || lineManager.isComment || (lineManager.visibility == visibility) || !isSelectorRespected) {
            if (callback) callback(lineManager);
            return;
        }

        const isVisibilityCompOptional = (visibility == EVisibility.eNormal) || (visibility == EVisibility.eUndefined);
        const hasVisibilityComp = lineManager.visibility !== EVisibility.eUndefined;

        // Possible cases. They should be exclusive, so testing order is not important.
        const mustRemoveComponentSection = lineManager.hasComponentSection && !lineManager.hasComponents && isVisibilityCompOptional;
        const mustCreateComponentSection = !lineManager.hasComponentSection && !isVisibilityCompOptional;
        const mustInsertVisibilityComp = lineManager.hasComponentSection && !hasVisibilityComp && !isVisibilityCompOptional;
        const mustReplaceVisibilityComp = hasVisibilityComp && !isVisibilityCompOptional;
        const mustRemoveVisibilityCompOnly = lineManager.hasComponents && hasVisibilityComp && isVisibilityCompOptional;

        editor.edit((editBuilder) => {
            let replace = (strIn: string, strOut: string) => {
                const pos = lineManager.line.indexOf(strIn);
                const range = new vscode.Range(
                    new vscode.Position(lineIdx, pos),
                    new vscode.Position(lineIdx, pos + strIn.length)
                );
                editBuilder.replace(range, strOut);
            };

            if (mustRemoveComponentSection) {
                let compPos = lineManager.line.indexOf(LABEL_ID_SEP);
                if (compPos > 0) {
                    if (lineManager.line[compPos-1] === " ") compPos--; // remove trailing space if necessary
                    replace(lineManager.line, lineManager.line.substr(0, compPos));
                }
            } else if (mustCreateComponentSection) {
                editBuilder.insert(new vscode.Position(lineIdx, lineManager.line.length), 
                    " " + LABEL_ID_SEP + " " + visibility);
            } else if (mustInsertVisibilityComp) {
                replace(
                    LABEL_ID_SEP, 
                    LABEL_ID_SEP + " " + visibility)
            } else if (mustReplaceVisibilityComp) {
                replace(lineManager.visibility, visibility);
            } else if (mustRemoveVisibilityCompOnly) {
                replace(
                    LABEL_ID_SEP + " " + lineManager.visibility + " ",
                    LABEL_ID_SEP + " ");
            }
        }).then((success) => {
            if (callback) callback(lineManager);
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

    hideAll() {
        this.setVisibilityInDocChained(EVisibility.eHide, 0);
        for (let i = this.getLineCount() - 1; i >= 0; --i) {
            this.callFoldCommandIfPossible(i);
        }
    }

    unhideAll() {
        let selector = (lineManager: LineManager) => { return lineManager.visibility === EVisibility.eHide; }; // only unhide hidden nodes
        let completionHandler = () => { this.updateFolding(); };
        this.setVisibilityInDocChained(EVisibility.eNormal, 0, selector, completionHandler);
    }

    revealNode(lineIdx: number) {
        this.parseActiveLine();

        if (this.visibility === EVisibility.eHide) // special case when start line is hidden
            this.setVisibilityInDoc(lineIdx, EVisibility.eNormal, undefined, (lineManager: LineManager) => {
                this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, this.depth);
            });
        else
            this.setVisibilityInDocChainedParentsReverse(EVisibility.eNormal, lineIdx, this.depth);
    }
}