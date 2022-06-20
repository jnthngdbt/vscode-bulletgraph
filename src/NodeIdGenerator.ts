import * as vscode from 'vscode';

import { Editor, Strings } from './utils'

export function makeId(length: Number) {
    // 4 chars: 62^4 = 14,776,336
    // 8 chars: 62^8 = 218,340,105,584,896
    var id = "_"
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // 26 + 26 + 10 = 62
    var N = chars.length;
    for ( var i = 0; i < length; i++ ) {
      id += chars.charAt(Math.floor(Math.random() * N));
   }
   return id;
}

export function generateCompactRandomId(): string {
    return makeId(4);
}

export function generateRandomId(): string {
    return makeId(8);
}

export function generateIdFromLineContent(text: string): string {
    const fullIdStr = `id_${Strings.camelize(text)}`
    const truncIdStr = fullIdStr.slice(0, 30)
    return truncIdStr;
}