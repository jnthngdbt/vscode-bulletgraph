import * as vscode from 'vscode';

import { Bullet, DepthManager } from './Bullet'
import { DotFileGenerator } from './DotFileGenerator'
import { insertNodeIdStringFromLineContent } from './NodeIdGenerator'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => {
            let bullet = new Bullet();
            bullet.parseEditorFile();
            console.log(bullet);

            let depthManager = new DepthManager();
            let depthBullet = depthManager.pruneAndReorganize(bullet);
            console.log(depthManager);

            let dotFileGenerator = new DotFileGenerator();
            dotFileGenerator.generate(depthBullet);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.insertId', () => {
            insertNodeIdStringFromLineContent();
        })
    );
}

export function deactivate() {}
