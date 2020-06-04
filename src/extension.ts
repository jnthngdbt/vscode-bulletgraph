import * as vscode from 'vscode';

import { Bullet, DepthManager } from './Bullet'
import { DotFileManager } from './DotFileManager'
import { LineManager } from './LineManager'
import { insertNodeIdStringFromLineContent } from './NodeIdGenerator'

export function activate(context: vscode.ExtensionContext) {
    let lineManager = new LineManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderPreview', () => {
            // Parsing the editor file to get the bullet graph structure.
            let bullet = new Bullet();
            bullet.parseEditorFile();

            // Simplify the graph, if necessary, by having a maximum depth.
            let depthManager = new DepthManager();
            let depthBullet = depthManager.pruneAndReorganize(bullet);

            // Render a Graphviz dot file.
            let dotFileManager = new DotFileManager();
            dotFileManager.render(depthBullet);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.insertId', () => {
            insertNodeIdStringFromLineContent();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldLine', () => {
            lineManager.foldLine();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldLine', () => {
            lineManager.unfoldLine();
        })
    );
}

export function deactivate() {}
