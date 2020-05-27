import * as vscode from 'vscode';

import { Bullet } from './Bullet'
import { DotFileGenerator } from './DotFileGenerator'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => {
            let bullet = new Bullet();
            bullet.parseEditorFile();
            console.log(bullet);

            let dotFileGenerator = new DotFileGenerator();
            dotFileGenerator.generate(bullet);
        })
    );
}

export function deactivate() {}
