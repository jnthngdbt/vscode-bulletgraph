import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { EConnectDirection, ELink, ERenderingEngine } from './constants'
import { DotFileManager } from './DotFileManager'
import { generateIdFromLineContent } from './NodeIdGenerator'
import { BulletManager } from './BulletManager';
import { NavigationManager } from './NavigationManager';
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
        vscode.commands.registerCommand('vscode-bulletgraph.applyScriptFromList', () => {
            new ScriptManager().applyScriptFromList();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldNode', () => {
            let b = new BulletManager();
            b.foldCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldNode', () => {
            let b = new BulletManager();
            b.unfoldCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideNode', () => {
            let b = new BulletManager();
            b.hideCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideNode', () => {
            let b = new BulletManager();
            b.unhideCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldAll', () => {
            let b = new BulletManager();
            b.foldAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldAll', () => {
            let b = new BulletManager();
            b.unfoldAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideAll', () => {
            let b = new BulletManager();
            b.hideAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideAll', () => {
            let b = new BulletManager();
            b.unhideAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldChildren', () => {
            let b = new BulletManager();
            b.foldChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldChildren', () => {
            let b = new BulletManager();
            b.unfoldChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideChildren', () => {
            let b = new BulletManager();
            b.hideChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideChildren', () => {
            let b = new BulletManager();
            b.unhideChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.highlightNode', () => {
            let b = new BulletManager();
            b.highlightCommand(b.getActiveBullet(), true);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.spotlightNode', () => {
            let b = new BulletManager();
            b.spotlightCommand(b.getActiveBullet(), false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            let b = new BulletManager();
            b.revealCommand(b.getActiveBullet(), false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            let b = new BulletManager();
            b.connectCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.networkNode', () => {
            let b = new BulletManager();
            b.networkCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.flowIn', () => {
            let b = new BulletManager();
            b.flowInCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.flowOut', () => {
            let b = new BulletManager();
            b.flowOutCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNodeHierarchy', () => {
            let b = new BulletManager();
            b.connectCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.lessVisible', () => {
            let b = new BulletManager();
            b.lessVisibleCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.moreVisible', () => {
            let b = new BulletManager();
            b.moreVisibleCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateFolding', () => {
            let b = new BulletManager();
            b.updateEditorFoldingCommand();
        })
    );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToNextSibling', () => { new NavigationManager().goToNextSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToPreviousSibling', () => { new NavigationManager().goToPreviousSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToParent', () => { new NavigationManager().goToParent(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToChildren', () => { new NavigationManager().goToChildren(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goNextVisible', () => { new NavigationManager().goNextVisible(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goBackVisible', () => { new NavigationManager().goBackVisible(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.moveCursorUp', () => { NavigationManager.moveCursorUp(); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.moveCursorDown', () => { NavigationManager.moveCursorDown(); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToLine', () => { new NavigationManager().goToLine(); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToConnectionBullet', () => { new NavigationManager().goToConnectionBullet(Editor.getActiveLineIdx()); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkIn', () => { new BulletManager().addLink(ELink.eIn); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkOut', () => { new BulletManager().addLink(ELink.eOut); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.insertIdFromOtherLine', () => { new BulletManager().insertIdFromOtherLine(); }) );

    BulletManager.console.show()
}

export function deactivate() {}
