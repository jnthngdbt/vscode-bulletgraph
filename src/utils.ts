import * as vscode from 'vscode';

export namespace Strings {
    // Trim leading (left) spaces/tabs.
    export function ltrim(str: string): string {
        if (!str) return str;
        return str.replace(/^\s+/g, '');
    }

    export function removeSpecialCharacters(str: string): string {
        return str.replace(/[-=&\/\\#,+()$~%.'":*?<>{}]/g, '');
    }

    export function convertTabsToSpaces(str: string): string {
        const tabSize = vscode.workspace.getConfiguration('editor').tabSize;
        const tabSpaces = " ".repeat(tabSize);
        let re = new RegExp(tabSpaces, "g");
        return str?.replace(re, '\t');
    }

    export function wordWrap(str: string, maxCharsOnLine = 25): string {
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
                wrappedStr += "\\n";
                currentLineBreak++;
            }
        }
    
        return wrappedStr;
    }
}
