import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { ERenderingEngine } from './constants'
import { DotFileManager } from './DotFileManager'
import { insertNodeIdStringFromLineContent } from './NodeIdGenerator'
import { DocumentManager } from './DocumentManager';
import { ScriptManager } from './ScriptManager';

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

function renderScript(launchPreview: Boolean) {
    let script = new ScriptManager();
    script.runScriptIfSpecified( () => {
        render(launchPreview);
    });
}

export function activate(context: vscode.ExtensionContext) {
    let documentManager = new DocumentManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderPreview', () => render(true))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderScriptPreview', () => renderScript(true))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => render(false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateScriptDotFile', () => renderScript(false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.insertId', () => {
            insertNodeIdStringFromLineContent();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldLine', () => {
            documentManager.foldLine(documentManager.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldLine', () => {
            documentManager.unfoldLine(documentManager.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideNode', () => {
            documentManager.hideNode(documentManager.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideNode', () => {
            documentManager.unhideNode(documentManager.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateFolding', () => {
            documentManager.updateFolding();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldAll', () => {
            documentManager.foldAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldAll', () => {
            documentManager.unfoldAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideAll', () => {
            documentManager.hideAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideAll', () => {
            documentManager.unhideAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldChildren', () => {
            documentManager.foldChildren(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldChildren', () => {
            documentManager.unfoldChildren(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideChildren', () => {
            documentManager.hideChildren(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideChildren', () => {
            documentManager.unhideChildren(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateChildren', () => {
            documentManager.updateChildren(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            documentManager.revealNode(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            documentManager.connectNode(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel1', () => { documentManager.foldLevel(1); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel2', () => { documentManager.foldLevel(2); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel3', () => { documentManager.foldLevel(3); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel4', () => { documentManager.foldLevel(4); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel5', () => { documentManager.foldLevel(5); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.foldLevel6', () => { documentManager.foldLevel(6); }) );
}

export function deactivate() {}
