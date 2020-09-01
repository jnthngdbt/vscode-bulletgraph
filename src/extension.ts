import * as vscode from 'vscode';

import { BulletGraph } from './BulletGraph'
import { DepthManager } from './DepthManager'
import { ERenderingEngine } from './constants'
import { DotFileManager } from './DotFileManager'
import { LineManager } from './LineManager'
import { insertNodeIdStringFromLineContent } from './NodeIdGenerator'
import { DocumentManager } from './DocumentManager';

function render() {
    // Parsing the editor file to get the bullet graph structure.
    let bullet = new BulletGraph();
    bullet.parseEditorFile();

    // Simplify the graph, if necessary, by having a maximum depth.
    let depthManager = new DepthManager();
    let depthBullet = depthManager.pruneAndReorganize(bullet);

    // Render a Graphviz dot file.
    let dotFileManager = new DotFileManager();
    dotFileManager.render(depthBullet, ERenderingEngine.eGraphvizInteractive);
}

export function activate(context: vscode.ExtensionContext) {
    let documentManager = new DocumentManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderPreview', render)
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
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            documentManager.revealNode(documentManager.getActiveLineIdx() ?? -1);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
            if (doc.fileName.endsWith(".blt"))
                render();
        })
    )
}

export function deactivate() {}
