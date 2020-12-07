import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { ELink, ERenderingEngine } from './constants'
import { DotFileManager } from './DotFileManager'
import { generateIdFromLineContent } from './NodeIdGenerator'
import { DocumentManager } from './DocumentManager';
import { DocumentManagerNew } from './DocumentManagerNew';
import { ScriptManager } from './ScriptManager';
import { Editor } from './utils';

function render(launchPreview: Boolean) {
    // Parsing the editor file to get the bullet graph structure.
    let bullet = new BulletGraph();
    bullet.parseEditorFile();

    // Simplify the graph, if necessary, by having a maximum depth.
    let depthManager = new DepthManager();
    let depthBullet = depthManager.pruneAndReorganize(bullet);

    // Render a Graphviz dot file.
    let dotFileManager = new DotFileManager();
    dotFileManager.render(depthBullet, ERenderingEngine.eGraphvizInteractive, launchPreview);

    // Save document.
    vscode.window.activeTextEditor?.document.save();
}

export function activate(context: vscode.ExtensionContext) {
    let documentManager = new DocumentManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderPreview', () => render(true))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => render(false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.insertId', () => {
            const text = Editor.getLine(Editor.getActiveLineIdx());
            const id = generateIdFromLineContent(text);
            Editor.insertTextAtActivePosition(id);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.applyScript', () => {
            new ScriptManager().applyScript(Editor.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldNode', () => {
            let doc = new DocumentManagerNew();
            doc.foldNode(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldNode', () => {
            let doc = new DocumentManagerNew();
            doc.unfoldNode(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideNode', () => {
            let doc = new DocumentManagerNew();
            doc.hideNode(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideNode', () => {
            let doc = new DocumentManagerNew();
            doc.unhideNode(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldAll', () => {
            let doc = new DocumentManagerNew();
            doc.foldAll();
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldAll', () => {
            let doc = new DocumentManagerNew();
            doc.unfoldAll();
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideAll', () => {
            let doc = new DocumentManagerNew();
            doc.hideAll();
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideAll', () => {
            let doc = new DocumentManagerNew();
            doc.unhideAll();
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldChildren', () => {
            let doc = new DocumentManagerNew();
            doc.foldChildren(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldChildren', () => {
            let doc = new DocumentManagerNew();
            doc.unfoldChildren(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideChildren', () => {
            let doc = new DocumentManagerNew();
            doc.hideChildren(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideChildren', () => {
            let doc = new DocumentManagerNew();
            doc.unhideChildren(Editor.getActiveLineIdx());
            doc.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            documentManager.revealNode(Editor.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.highlightNode', () => {
            documentManager.highlightNode(Editor.getActiveLineIdx() ?? -1, true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            documentManager.connectNode(Editor.getActiveLineIdx() ?? -1, false);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNodeHierarchy', () => {
            documentManager.connectNode(Editor.getActiveLineIdx() ?? -1, true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateFolding', () => {
            documentManager.updateFolding();
        })
    );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel1', () => { documentManager.foldLevel(1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel2', () => { documentManager.foldLevel(2); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel3', () => { documentManager.foldLevel(3); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel4', () => { documentManager.foldLevel(4); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel5', () => { documentManager.foldLevel(5); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel6', () => { documentManager.foldLevel(6); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goNext', () => { documentManager.goNext(Editor.getActiveLineIdx() ?? -1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goBack', () => { documentManager.goBack(Editor.getActiveLineIdx() ?? -1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goUp', () => { documentManager.goUp(Editor.getActiveLineIdx() ?? -1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goDown', () => { documentManager.goDown(Editor.getActiveLineIdx() ?? -1); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goNextVisible', () => { documentManager.goNextVisible(Editor.getActiveLineIdx() ?? -1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goBackVisible', () => { documentManager.goBackVisible(Editor.getActiveLineIdx() ?? -1); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToLine', () => { documentManager.goToLine(); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkIn', () => { documentManager.addLink(ELink.eIn); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkOut', () => { documentManager.addLink(ELink.eOut); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.insertIdFromOtherLine', () => { documentManager.insertIdFromOtherLine(Editor.getActiveLineIdx() ?? -1); }) );
}

export function deactivate() {}
