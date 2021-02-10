import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { ELink, ERenderingEngine } from './constants'
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
            b.reveal(b.getActiveBullet(), false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            let b = new BulletManager();
            b.connect(b.getActiveBullet(), false, false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNodeHierarchy', () => {
            let b = new BulletManager();
            b.connect(b.getActiveBullet(), false, true);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateFolding', () => {
            let b = new BulletManager();
            b.updateEditorFolding();
        })
    );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToNextSibling', () => { new NavigationManager().goToNextSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToPreviousSibling', () => { new NavigationManager().goToPreviousSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToParent', () => { new NavigationManager().goToParent(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToChildren', () => { new NavigationManager().goToChildren(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goNextVisible', () => { new NavigationManager().goNextVisible(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goBackVisible', () => { new NavigationManager().goBackVisible(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToLine', () => { new NavigationManager().goToLine(); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkIn', () => { new BulletManager().addLink(ELink.eIn); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkOut', () => { new BulletManager().addLink(ELink.eOut); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.insertIdFromOtherLine', () => { new BulletManager().insertIdFromOtherLine(); }) );
}

export function deactivate() {}
