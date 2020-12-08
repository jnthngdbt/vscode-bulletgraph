import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { ELink, ERenderingEngine } from './constants'
import { DotFileManager } from './DotFileManager'
import { generateIdFromLineContent } from './NodeIdGenerator'
import { DocumentManager } from './DocumentManager';
import { BulletManager } from './BulletManager';
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
            let b = new BulletManager();
            b.fold(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldNode', () => {
            let b = new BulletManager();
            b.unfold(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideNode', () => {
            let b = new BulletManager();
            b.hide(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideNode', () => {
            let b = new BulletManager();
            b.unhide(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldAll', () => {
            let b = new BulletManager();
            b.foldAll();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldAll', () => {
            let b = new BulletManager();
            b.unfoldAll();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideAll', () => {
            let b = new BulletManager();
            b.hideAll();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideAll', () => {
            let b = new BulletManager();
            b.unhideAll();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldChildren', () => {
            let b = new BulletManager();
            b.foldChildren(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldChildren', () => {
            let b = new BulletManager();
            b.unfoldChildren(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideChildren', () => {
            let b = new BulletManager();
            b.hideChildren(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideChildren', () => {
            let b = new BulletManager();
            b.unhideChildren(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.highlightNode', () => {
            let b = new BulletManager();
            b.highlight(b.getActiveBullet(), true);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            let b = new BulletManager();
            b.reveal(b.getActiveBullet(), true);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            let b = new BulletManager();
            b.connect(b.getActiveBullet(), true, false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNodeHierarchy', () => {
            let b = new BulletManager();
            b.connect(b.getActiveBullet(), true, true);
            b.update();
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
