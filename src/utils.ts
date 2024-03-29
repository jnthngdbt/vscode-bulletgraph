import * as vscode from 'vscode';

import { SCRIPT_LINE_TOKEN } from './constants'

export function isScriptLine(text: string): Boolean {
    return text.trim().startsWith(SCRIPT_LINE_TOKEN);
}

export namespace Editor {
    
    export function getLineCount(): number {
        return vscode.window.activeTextEditor?.document.lineCount ?? 0;
    }

    export function getActiveLineIdx(): number | undefined {
        return vscode.window?.activeTextEditor?.selection?.active.line;
    }

    export function getLine(lineIdx: number | undefined): string {
        let line = "";

        if (lineIdx === undefined) return line;
        if (lineIdx < 0) return line;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return line;

        if (lineIdx >= editor.document.lineCount) return line;

        line = editor.document.lineAt(lineIdx).text;

        return line;
    }

    export function getAllLines(): Array<string> {
        let text = vscode.window.activeTextEditor?.document.getText() ?? "";
        if (!text) vscode.window.showErrorMessage('Bullet Graph: No editor is active.');
        return text.split(/\r?\n/) ?? []; // new lines
    }

    export function insertTextAtActivePosition(text: string): void {
        const editor = vscode.window.activeTextEditor;
        const selections = editor?.selections;
    
        editor?.edit((editBuilder) => {
            selections?.forEach((selection) => {
                const line = selection.active.line;
                const character = selection.active.character;
                editBuilder.insert(new vscode.Position(line, character), text);
            });
        });
    }

    export function showLineQuickPick(onDidAccept: any | undefined = undefined, onDidChangeActive: any | undefined = undefined) {
        const strings = Editor.getAllLines();
        if (!strings || strings.length <= 0) return;

        const activeLineIdx = Editor.getActiveLineIdx() ?? 0;
        const quickItems = strings?.map( (label, index) => { return { label, index };}); // can be any object with label property

        showQuickPick(quickItems, activeLineIdx, onDidAccept, onDidChangeActive);
    }

    export function showQuickPick(quickItems: { label: string; index: number; }[], activeIdx: number, onDidAccept: any | undefined = undefined, onDidChangeActive: any | undefined = undefined) {
        let quickPick = vscode.window.createQuickPick();
        quickPick.items = quickItems;
        quickPick.activeItems = [ quickItems[activeIdx] ];
        quickPick.onDidHide(() => quickPick.dispose());        
        quickPick.onDidChangeActive(() => {
            if (onDidChangeActive) onDidChangeActive(quickPick.activeItems[0]);
        });
        quickPick.onDidAccept(() => {
            if (onDidAccept) onDidAccept(quickPick.activeItems[0]);
            quickPick.hide();
        });
        quickPick.show();
    }

    export function focusLine(lineIdx: number, pos: number, at: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            var newPosition = new vscode.Position(lineIdx, pos);
            var newSelection = new vscode.Selection(newPosition, newPosition);
            editor.selection = newSelection;
            centerEditorOnLine(lineIdx, at);
        }
    }

    export function centerEditorOnLine(lineIdx: number | undefined, at: string) {
        if (lineIdx === undefined) return;
        vscode.commands.executeCommand("revealLine", { lineNumber: lineIdx, at: at });
    }
}

export namespace Strings {
    export const TAB = "\t";

    // Trim leading (left) spaces/tabs.
    export function ltrim(str: string): string {
        if (!str) return str;
        return str.replace(/^\s+/g, '');
    }

    export function removeSpecialCharacters(str: string): string {
        return str.replace(/[-=&\/\\#,+()$~%.'":*?<>{}\[\]@]/g, '');
    }

    export function removeInvalidLabelCharacters(str: string): string {
        return str.replace(/[&<>]/g, '');
    }

    export function removeInvalidScriptNameCharacters(str: string): string {
        // Should be valid for a file name.
        return str.replace(/[=&\/\\#,$~'":*?<>{}\[\]@]/g, '');
    }

    export function convertTabsToSpaces(str: string): string {
        const tabSize = vscode.workspace.getConfiguration('editor').tabSize;
        const tabSpaces = " ".repeat(tabSize);
        let re = new RegExp(tabSpaces, "g");
        return str?.replace(re, '\t');
    }

    export function camelize(str: string) {
        str = removeSpecialCharacters(str);
        return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
            if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
            return index === 0 ? match.toLowerCase() : match.toUpperCase();
        });
    }

    export function wordWrap(str: string, newLineChar = "\\n", maxCharsOnLine = 25): string {
        str = str.trim();
    
        // Determine where to cut.
        const nbLines = Math.ceil(str.length / maxCharsOnLine);
        const cutSteps = Math.round(str.length / nbLines);
    
        if (nbLines <= 1)
            return str;
    
        let wrappedStr = "";
        
        // Wrap lines at position where it is possible.
        let currentLineBreak = 1;
        for (let i = 0; i < str.length; ++i) {
            const ch = str[i];
            wrappedStr += ch;
    
            const canCut = (ch == ' ') || (ch == '\t') || (ch == '-') || (ch == '\\') || (ch == '/');
            if (canCut && (i >= currentLineBreak * cutSteps)) {
                wrappedStr += newLineChar;
                currentLineBreak++;
            }
        }
    
        return wrappedStr;
    }
}
