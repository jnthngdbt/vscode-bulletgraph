import * as vscode from 'vscode';

import { LABEL_ID_SEP, EVisibility, ELink, SCRIPT_LINE_TOKEN, ENABLE_EDITOR_FOLDING, EConnectDirection } from './constants';
import { Editor } from './utils';
import { Bullet } from './Bullet';
import { generateCompactRandomId } from './NodeIdGenerator';

export class DocumentLine {
    text = "";
    index = -1;
}

export class BulletManager {
    bullets: Array<Bullet> = [];
    scriptLines: Array<DocumentLine> = [];
    static console = vscode.window.createOutputChannel("Bullet Commands");

    constructor() {
        const { bulletLines, scriptLines } = this.getLines();
        this.bullets = this.parseBullets(bulletLines);
        this.scriptLines = scriptLines;
    }

    // Extract text lines, without parsing them, classifying them script/bullet.
    getLines() {
        const lines = Editor.getAllLines();
        if (!lines) vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');

        let bulletLines: Array<DocumentLine> = [];
        let scriptLines: Array<DocumentLine> = [];

        let lineIdx = 0;
        lines.forEach( line => {
            const lineTrim = line.trim();
            if (lineTrim.length > 0) { // skip empty line, or only containing tabs/spaces
                let docLine = new DocumentLine();
                docLine.index = lineIdx;
                if (lineTrim[0] === SCRIPT_LINE_TOKEN) {
                    docLine.text = lineTrim;
                    scriptLines.push(docLine);
                } else {
                    docLine.text = line;
                    bulletLines.push(docLine);
                }
            }
            lineIdx++;
        });

        return { bulletLines, scriptLines };
    }

    parseBullets(bulletLines: Array<DocumentLine>): Array<Bullet> {
        let bullets: Array<Bullet> = [];

        bulletLines.forEach( line => {
            let bullet = new Bullet();
            bullet.parse(line.text, line.index);
            bullet.bulletIdx = bullets.length;
            bullets.push(bullet);
        });

        return bullets;
    }

    getActiveBullet(): Bullet | undefined {
        return this.getBulletAtLine(Editor.getActiveLineIdx());
    }

    getBulletAtLine(lineIdx: number | undefined): Bullet | undefined {
        if (lineIdx !== undefined) {
            return this.bullets.find( bullet => { return bullet.lineIdx === lineIdx; });
        }
        return undefined;
    }

    getBulletFromId(id: string): Bullet | undefined {
        return this.bullets.find( bullet => { return bullet.id === id; });
    }

    isParent(bullet: Bullet): Boolean {
        for (let i = bullet.bulletIdx + 1; i < this.bullets.length; i++) {
            if (this.bullets[i].isValid()) { // find first valid bullet (not a comment)
                const next = this.bullets[i];
                return next.depth > bullet.depth;
            }
        }
        return false;
    }

    setVisibility(bullet: Bullet | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        if (!bullet) return;

        if (skipHidden && bullet.visibility === EVisibility.eHide) // must explicitely unhide to unhide
            return;

        if (visibility === EVisibility.eHide)
            bullet.isHighlight = false;
        
        if (!this.isParent(bullet) && (visibility === EVisibility.eFold))
            visibility = EVisibility.eNormal

        bullet.visibility = visibility;
        bullet.mustUpdate = true;
    }

    setChildrenVisibility(parent: Bullet | undefined, visibility: EVisibility, skipHidden: Boolean = false) {
        if (!parent) return;

        let children = this.getChildren(parent);
        children.forEach( child => this.setVisibility(child, visibility, skipHidden) );
    }

    isLineFoldableByEditor(bullet: Bullet | undefined): boolean {
        if (bullet === undefined) return false;
        if (!bullet.isValid()) return false;

        // The direct next line must be indented.
        let next = this.getBulletAtLine(bullet.lineIdx + 1)
        if (!next || !next.isValid()) return false;
        return next.depth > bullet.depth;
    }
    
    callUnfoldCommand(bullet: Bullet | undefined, completionHandler: any | undefined = undefined) {
        if (bullet === undefined) {
            vscode.commands.executeCommand("editor.unfold").then(() => { 
                if (completionHandler) completionHandler(); });
        } else {
            vscode.commands.executeCommand("editor.unfold", { selectionLines: [bullet.lineIdx] }).then(() => { 
                if (completionHandler) completionHandler(); });
        }
    }

    callFoldCommand(bullet: Bullet | undefined, completionHandler: any | undefined = undefined) {
        if (bullet === undefined) {
            vscode.commands.executeCommand("editor.fold").then(() => { 
                if (completionHandler) completionHandler(); });
        } else {
            vscode.commands.executeCommand("editor.fold", { selectionLines: [bullet.lineIdx] }).then(() => { 
                if (completionHandler) completionHandler(); });
        }
    }

    callFoldCommandIfPossible(bullet: Bullet | undefined, completionHandler: any | undefined = undefined) {
        this.callUnfoldCommand(bullet, () => { // unfold first to avoid unexpected behavior if already folded
            if (this.isLineFoldableByEditor(bullet)) {
                this.callFoldCommand(bullet, completionHandler);
            } else {
                if (completionHandler) completionHandler();
            }
        });
    }

    printConsole(line: string) {
        BulletManager.console.appendLine(line)
    }

    printScriptCommand(command: string) {
        let tab = " ".repeat(vscode.workspace.getConfiguration('editor').tabSize)
        this.printConsole(tab + "$ " + command)
    }

    printScriptNodeCommand(command: string, bullet: Bullet | undefined) {
        if (bullet) {
            let tab = " ".repeat(vscode.workspace.getConfiguration('editor').tabSize)
            this.printConsole(tab + "$ " + command + " " + bullet.id + " // " + bullet.label)
        }
    }

    commonNodeCommandTasks(bullet: Bullet | undefined, name: string) {
        this.setPermanentRandomIdIfNecessary(bullet) // do before print, to print correct node id
        this.printScriptNodeCommand(name, bullet)
    }

    foldCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "foldNode")
        this.fold(bullet)
    }

    unfoldCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "unfoldNode")
        this.unfold(bullet)
    }

    hideCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "hideNode")
        this.hide(bullet)
    }

    unhideCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "unhideNode")
        this.unhide(bullet)
    }
    
    foldAllCommand() {
        this.printScriptCommand("foldAll")
        this.foldAll()
    }

    unfoldAllCommand() {
        this.printScriptCommand("unfoldAll")
        this.unfoldAll()
    }

    hideAllCommand() {
        this.printScriptCommand("hideAll")
        this.hideAll()
    }

    unhideAllCommand() {
        this.printScriptCommand("unhideAll")
        this.unhideAll()
    }

    foldChildrenCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "foldChildren")
        this.foldChildren(bullet)
    }

    unfoldChildrenCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "unfoldChildren")
        this.unfoldChildren(bullet)
    }

    hideChildrenCommand(bullet: Bullet | undefined) {
        this.commonNodeCommandTasks(bullet, "hideChildren")
        this.hideChildren(bullet)
    }

    unhideChildrenCommand(bullet: Bullet | undefined) { // NOTE: also unfolds
        this.commonNodeCommandTasks(bullet, "unhideChildren")
        this.unhideChildren(bullet)
    }

    highlightCommand(bullet: Bullet | undefined, toggle: Boolean = false) {
        this.commonNodeCommandTasks(bullet, "highlightNode")
        this.highlight(bullet, toggle)
    }

    spotlightCommand(bullet: Bullet | undefined, highlight: Boolean = true) {
        this.commonNodeCommandTasks(bullet, "spotlight")
        this.spotlight(bullet, highlight)
    }

    revealCommand(bullet: Bullet | undefined, highlight: Boolean = true) {
        this.commonNodeCommandTasks(bullet, "revealNode")
        this.reveal(bullet, highlight)
    }

    connectCommand(bullet: Bullet | undefined, highlight: Boolean = true, direction: EConnectDirection = EConnectDirection.eInOut, connectParents: Boolean = false) {
        this.commonNodeCommandTasks(bullet, "connectNode")
        this.connect(bullet, highlight, direction, connectParents, false)
    }

    flowInCommand(bullet: Bullet | undefined, highlight: Boolean = true, connectParents: Boolean = false) {
        this.commonNodeCommandTasks(bullet, "flowInNode")
        this.flowIn(bullet, highlight, connectParents)
    }

    flowOutCommand(bullet: Bullet | undefined, highlight: Boolean = true, connectParents: Boolean = false) {
        this.commonNodeCommandTasks(bullet, "flowOutNode")
        this.flowOut(bullet, highlight, connectParents)
    }

    updateEditorFoldingCommand(callback: any | undefined = undefined) {
        this.printScriptCommand("updateFolding")
        this.updateEditorFolding()
    }

    fold(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eFold, true);
    }

    unfold(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eNormal, true);
    }

    hide(bullet: Bullet | undefined) {
        this.setVisibility(bullet, EVisibility.eHide);
    }

    unhide(bullet: Bullet | undefined) {
        this.revealIfHidden(bullet);
    }
    
    foldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eFold, true);
        });
    }

    unfoldAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eNormal, true);
        });
    }

    hideAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eHide);
        });
    }

    unhideAll() {
        this.bullets.forEach( bullet => {
            this.setVisibility(bullet, EVisibility.eNormal);
        });
    }

    foldChildren(bullet: Bullet | undefined) {
        this.setChildrenVisibility(bullet, EVisibility.eFold, true);
    }

    unfoldChildren(bullet: Bullet | undefined) {
        this.revealIfHidden(bullet)
        this.unfold(bullet) // make sure the node is unfolded, otherwise unfolding children won't have any effect
        this.setChildrenVisibility(bullet, EVisibility.eNormal, true);
    }

    hideChildren(bullet: Bullet | undefined) {
        this.setChildrenVisibility(bullet, EVisibility.eHide);
    }

    unhideChildren(bullet: Bullet | undefined) { // NOTE: also unfolds
        this.revealIfHidden(bullet)
        this.setChildrenVisibility(bullet, EVisibility.eNormal);
    }

    highlight(bullet: Bullet | undefined, toggle: Boolean = false) {
        if (bullet) {
            bullet.isHighlight = toggle ? !bullet.isHighlight : true;
            bullet.mustUpdate = true;
        }
    }

    spotlight(bullet: Bullet | undefined, highlight: Boolean = true) {
        this.hideAll()
        this.reveal(bullet, highlight)
    }

    lessVisibleCommand(bullet: Bullet | undefined) {
        if (bullet) {
            switch (bullet.visibility) {
                case EVisibility.eNormal: this.isParent(bullet) ? this.foldCommand(bullet) : this.hideCommand(bullet); break;
                case EVisibility.eFold: this.hideCommand(bullet); break;
                case EVisibility.eFoldHidden: this.hideCommand(bullet); break;
                case EVisibility.eHide: break;
                default: break;
            }
        }
    }

    moreVisibleCommand(bullet: Bullet | undefined) {
        if (bullet) {
            switch (bullet.visibility) {
                case EVisibility.eNormal: if (this.isParent(bullet)) this.unfoldChildrenCommand(bullet); break
                case EVisibility.eFold: this.unfoldCommand(bullet); break;
                case EVisibility.eFoldHidden: this.revealCommand(bullet, false); break;
                case EVisibility.eHide: this.revealCommand(bullet, false); break;
                default: break;
            }
        }
    }

    revealIfHidden(bullet: Bullet | undefined) {
        if (bullet && bullet.visibility === EVisibility.eHide)
            this.reveal(bullet, false);
    }

    reveal(bullet: Bullet | undefined, highlight: Boolean = true) {
        if (!bullet) return;
        if (bullet.isRevealed) return;

        // Make sure all parents are visible.
        let parents = this.getParents(bullet);
        parents.forEach( parent => {
            this.setVisibility(parent, EVisibility.eNormal);
        });

        this.setVisibility(bullet, EVisibility.eFold);
        this.unhideChildren(bullet);

        if (highlight)
            this.highlight(bullet);

        bullet.isRevealed = true;
    }

    connect(bullet: Bullet | undefined, highlight: Boolean = true, direction: EConnectDirection = EConnectDirection.eInOut, connectParents: Boolean = false, deep = false) {
        if (!bullet) return;
        if (bullet.isConnected) return;

        let connectionsFetcher = (bullet: Bullet, direction: EConnectDirection) => {
            if (deep) return this.getConnectionsDeep(bullet, direction)
            else return this.getConnections(bullet, direction)
        }

        let connections = connectionsFetcher(bullet, direction);

        // Add children connections.
        let children = this.getChildren(bullet);
        children.forEach( child => { connections = connections.concat(connectionsFetcher(child, direction)); } );

        // Add parents connections if necessary.
        if (connectParents) {
            let parents = this.getParents(bullet);
            parents.forEach( parent => { connections = connections.concat(connectionsFetcher(parent, direction)); } );
        }

        // Reveal bullet and its connections. Note: possible duplicates, but reveal should skip if already done.
        this.reveal(bullet, false);
        connections.forEach( connection => this.reveal(connection, false) );

        if (highlight)
            this.highlight(bullet);

        bullet.isConnected = true;
    }
    
    flowIn(bullet: Bullet | undefined, highlight: Boolean = true, connectParents: Boolean = false) {
        this.connect(bullet, highlight, EConnectDirection.eIn, connectParents, true)
    }

    flowOut(bullet: Bullet | undefined, highlight: Boolean = true, connectParents: Boolean = false) {
        this.connect(bullet, highlight, EConnectDirection.eOut, connectParents, true)
    }

    updateEditorFolding(callback: any | undefined = undefined) {
        var lineIndices: Array<Number> = []
        var maxDepth = -1
        for (let i = 0; i < this.bullets.length; i += 1) {
            let bullet = this.bullets[i]

            if (maxDepth > 0 && bullet.depth > maxDepth) { // this line will already be folded; skip to avoid weird behavior when folding folded line
                continue
            }

            if (maxDepth > 0 && bullet.depth <= maxDepth) { // new scope, reset flag
                maxDepth = -1
            }

            if ((bullet.visibility == EVisibility.eFold) || (bullet.visibility == EVisibility.eFoldHidden) || (bullet.visibility == EVisibility.eHide)) {
                if (this.isLineFoldableByEditor(bullet)) {
                    lineIndices.push(bullet.lineIdx)
                    maxDepth = bullet.depth
                }
            }
        }

        vscode.commands.executeCommand("editor.unfoldAll").then(() => { 
            // Unfortunately, folding lines that are already folded will fold their parent, giving
            // unexpected results in our case.
            vscode.commands.executeCommand("editor.fold", { selectionLines: lineIndices }).then(
                callback
            )
        })
    }

    getConnections(bullet: Bullet, direction: EConnectDirection): Array<Bullet> {
        let connections: Array<Bullet> = [];

        let pushConnectionFromId = (connectionId: string) => {
            let connection = this.getBulletFromId(connectionId);
            if (connection) connections.push(connection);
        }

        let doIns  = (direction == EConnectDirection.eInOut) || (direction == EConnectDirection.eIn)
        let doOuts = (direction == EConnectDirection.eInOut) || (direction == EConnectDirection.eOut)

        // Added bullets that it directly links.
        if (doIns ) bullet.idsIn.forEach(pushConnectionFromId);
        if (doOuts) bullet.idsOut.forEach(pushConnectionFromId);

        // Add bullets that directly link to it.
        for (let other of this.bullets) {
            if (doOuts && other.idsIn.includes(bullet.id)) connections.push(other);
            if (doIns && other.idsOut.includes(bullet.id)) connections.push(other);
        }

        return connections;
    }

    getConnectionsDeep(bullet: Bullet, direction: EConnectDirection): Array<Bullet> {
        let connectionsIn: Array<Bullet> = [];
        let connectionsOut: Array<Bullet> = [];

        let doIns  = (direction == EConnectDirection.eInOut) || (direction == EConnectDirection.eIn)
        let doOuts = (direction == EConnectDirection.eInOut) || (direction == EConnectDirection.eOut)

        if (doIns) this.getConnectionsRecursive(connectionsIn, bullet, false)
        if (doOuts) this.getConnectionsRecursive(connectionsOut, bullet, true)

        let connections = [...connectionsIn, ...connectionsOut]

        return connections;
    }

    // NOTE: this is ugly. It would maybe be better to call connect recursively instead (or not, better).
    getConnectionsRecursive(connections: Array<Bullet>, bullet: Bullet, outwards: boolean, isFirstPass: boolean = true) {
        let foundInList = connections.find(b => b.lineIdx == bullet.lineIdx)
         if (foundInList) return // already passed through this one, exit to avoid infinite loop

        if (!isFirstPass) connections.push(bullet) // do not add the root to the connections

        let processConnectionFromId = (connectionId: string) => {
            let connection = this.getBulletFromId(connectionId);
            if (connection) this.getConnectionsRecursive(connections, connection, outwards, false)
        }

        if (outwards) bullet.idsOut.forEach(processConnectionFromId);
        else          bullet.idsIn.forEach(processConnectionFromId);

        // Add bullets that directly link to it.
        for (let other of this.bullets) {
            if (outwards && other.idsIn.includes(bullet.id)) this.getConnectionsRecursive(connections, other, outwards, false);
            if (!outwards && other.idsOut.includes(bullet.id)) this.getConnectionsRecursive(connections, other, outwards, false);
        }
    }

    getParents(bullet: Bullet | undefined): Array<Bullet> {
        let parents: Array<Bullet> = [];

        let child = bullet;
        while (child) {
            const parent = this.getParent(child); // eventually undefined
            if (parent)
                parents.push(parent);
            child = parent;
        }

        return parents;
    }

    getParent(bullet: Bullet | undefined): Bullet | undefined {
        if (bullet) {
            for (let i = bullet.bulletIdx - 1; i >= 0; i--) { // backtrack
                const parent = this.bullets[i];
    
                if (!parent.isValid()) // skip comments and invalid lines
                    continue;
    
                if (parent.depth < bullet.depth) // found parent
                    return parent;
            }
        }

        return undefined;
    }

    getChild(parent: Bullet | undefined): Bullet | undefined {
        const children = this.getChildren(parent, true);
        if (children.length > 0)
            return children[0];
        return undefined;
    }

    getChildren(parent: Bullet | undefined, onlyFirst: Boolean = false): Array<Bullet> {
        let children: Array<Bullet> = [];

        if (parent) {
            for (let i = parent.bulletIdx + 1; i < this.bullets.length; i++) {
                let child = this.bullets[i];

                if (!child.isValid()) // skip comments
                    continue;
    
                if (child.depth <= parent.depth) // no more a child
                    break;
    
                children.push(child);

                if (onlyFirst) break;
            }
        }

        return children;
    }

    update(callback: any | undefined = undefined) {
        this.propagateVisibility();
        this.writeBullets(() => {
            if (ENABLE_EDITOR_FOLDING)
                this.updateEditorFolding(callback);
        });
    }

    propagateVisibility() {
        let currHideDepth = -1;
        let currFoldDepth = -1;
        this.bullets.forEach( bullet => {
            if (bullet.isValid()) {
                // Reset depth trackers if necessary.
                if (bullet.depth <= currHideDepth) currHideDepth = -1;
                if (bullet.depth <= currFoldDepth) currFoldDepth = -1;

                if ((currHideDepth >= 0) && (bullet.depth > currHideDepth)) { // hidden
                    this.setVisibility(bullet, EVisibility.eHide);
                } 
                else if ((currFoldDepth >= 0) && (bullet.depth > currFoldDepth)) { // folded
                    this.setVisibility(bullet, EVisibility.eFoldHidden, true);
                } 
                else if (bullet.visibility === EVisibility.eHide) { // new hide root
                    currHideDepth = bullet.depth;
                } 
                else if (bullet.visibility === EVisibility.eFold) { // new fold root
                    currFoldDepth = bullet.depth;
                } 
                else if (bullet.visibility === EVisibility.eFoldHidden) { // not hidden anymore, so should not be fold hidden
                    this.setVisibility(bullet, EVisibility.eFold);
                    if (this.isParent(bullet))
                        currFoldDepth = bullet.depth;
                }
            }
        });
    }

    writeBullets(callback: any | undefined = undefined) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || this.bullets.length <= 0) return;

        editor.edit((editBuilder) => {
            this.bullets.forEach( bullet => {
                if (bullet.isValid() && bullet.mustUpdate) {
                    let newCompString = bullet.generateComponentSectionString();
    
                    let pos = bullet.text.indexOf(LABEL_ID_SEP);
                    if (pos < 0 && newCompString.length === 0) return; // nothing to do
            
                    if (pos < 0) {
                        if (bullet.text[bullet.text.length - 1] !== " ")
                            newCompString = " " + newCompString; // add a space if not already ending with a space
                        pos = bullet.text.length;
                    }
    
                    const range = new vscode.Range(
                        new vscode.Position(bullet.lineIdx, pos),
                        new vscode.Position(bullet.lineIdx, bullet.text.length)
                    );
                    editBuilder.replace(range, newCompString);
                }
            } )
        }).then((success) => {
            if (callback) callback(this.bullets);
        });
    }

    insertIdFromOtherLine() {
        this.getQuickPickLineIdAndCreateOneIfNecessary((id: string) => {
            // If necessary, the id has been set, but not written yet.
            // So first rewrite updated bullets, then write id at active position.
            this.writeBullets(() => { 
                // Skip re-writing the id if the active line was selected.
                let bullet = this.getActiveBullet();
                if (bullet && bullet.id === id) return;

                Editor.insertTextAtActivePosition(id);
             });
        });
    }

    addLink(link: ELink) {
        this.getQuickPickLineIdAndCreateOneIfNecessary((id: string) => {
            let bullet = this.getActiveBullet();
            if (!bullet) return;

            switch (link) {
                case ELink.eIn: bullet.idsIn.push(id); break;
                case ELink.eOut: bullet.idsOut.push(id); break;
                default: break;
            }
            
            bullet.mustUpdate = true;
            this.writeBullets();
        });
    }

    setPermanentRandomIdIfNecessary(bullet: Bullet | undefined) {
        if (bullet && bullet.isRandomId) {
            bullet.id = generateCompactRandomId();
            bullet.isRandomId = false;
            bullet.mustUpdate = true;
        }
    }

    getQuickPickLineIdAndCreateOneIfNecessary(callback: (id: string) => void) {
        Editor.showLineQuickPick((selectedLine: any) => {
            if (selectedLine) {
                let bullet = this.getBulletAtLine(selectedLine.index);
                if (!bullet) return;

                this.setPermanentRandomIdIfNecessary(bullet)
                
                callback(bullet.id);
            }
        });
    }
}