import * as vscode from 'vscode';

import { Editor, Strings } from './utils'

export function convertToHex(idString: string): string {
    return idString.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function generateCompactRandomId(): string {
    // 4 hex string: 65536 possibilities (0.002%).
    return convertToHex('id_xxxx');
}

export function generateRandomId(): string {
    return convertToHex('id_xxxxxxxx_xxxxxx');
}

export function generateIdFromLineContent(text: string): string {
    const fullIdStr = `id_${Strings.camelize(text)}`
    const truncIdStr = fullIdStr.slice(0, 30)
    return truncIdStr;
}