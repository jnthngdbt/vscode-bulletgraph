import * as vscode from 'vscode';

import { Strings } from './utils'

export function insertNodeIdStringFromLineContent(): void {
    const editor = vscode.window.activeTextEditor;
    const selections = editor?.selections;

    editor?.edit((editBuilder) => {
        selections?.forEach((selection) => {
            const line = selection.active.line
            const text = editor.document.lineAt(line).text
            const character = selection.active.character
            const fullIdStr = `id_${Strings.camelize(text)}`
            const truncIdStr = fullIdStr.slice(0, 30)
            editBuilder.insert(new vscode.Position(line, character), truncIdStr);
        });
    });
}

export function generateRandomId(): string {
    return 'id_xxxxxxxx_xxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}