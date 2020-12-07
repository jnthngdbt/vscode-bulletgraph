import { COMMENT_TOKENS, LABEL_ID_SEP, HIGHLIGHT_TOKEN, EBullet, ELink, EVisibility } from './constants'
import { Editor, Strings, isScriptLine } from './utils'

import { generateRandomId } from './NodeIdGenerator'

export class Bullet {
    text = "";
    lineIdx = -1;
    bulletIdx = -1;
    isComment = false;
    depth = -1;
    bulletType = EBullet.eDefault;
    label = "";
    visibility = EVisibility.eNormal;
    isHighlight = false;
    id = "";
    isRandomId = false;
    idsIn: Array<string> = [];
    idsOut: Array<string> = [];
    hasComponentSection = false;
    mustUpdate = false;

    clear() {
        this.text = "";
        this.lineIdx = -1;
        this.bulletIdx = -1;
        this.isComment = false;
        this.depth = -1;
        this.bulletType = EBullet.eDefault;
        this.label = "";
        this.visibility = EVisibility.eNormal;
        this.isHighlight = false;
        this.id = "";
        this.isRandomId = false;
        this.idsIn = [];
        this.idsOut = [];
        this.hasComponentSection = false;
        this.mustUpdate = false;
    }

    isValid(): Boolean {
        return !this.isComment && (this.depth >= 0) && !isScriptLine(this.text);
    }

    generateComponentSectionString(): string {
        let str = LABEL_ID_SEP;

        if (this.visibility !== EVisibility.eNormal) str = str + " " + this.visibility;
        if (this.isHighlight) str = str + " " + HIGHLIGHT_TOKEN;
        if (this.id.length > 0 && !this.isRandomId) str = str + " " + this.id;

        this.idsIn.forEach( id => { str = str + " " + ELink.eIn + ELink.eIn + id; });
        this.idsOut.forEach( id => { str = str + " " + ELink.eOut + ELink.eOut + id; });

        if (str === LABEL_ID_SEP) // if nothing was added, just do not put components section
            str = "";

        return str;
    }

    parseActiveLine() {
        this.parseLine(Editor.getActiveLineIdx());
    }

    parseLine(lineIdx: number | undefined) {
        if (lineIdx === undefined || lineIdx < 0) return;

        const lineText = Editor.getLine(lineIdx);
        if (lineText === undefined) return;

        this.parse(lineText, lineIdx);
    }

    parse(lineIn: string | undefined, lineIdx: number) {
        this.clear();

        if (!lineIn) return;
        if (lineIn.length <= 0) return;
        if (lineIn.trim().length <= 0) return; // skip empty line, or only containing tabs/spaces

        this.text = lineIn;
        this.lineIdx = lineIdx;

        lineIn = Strings.convertTabsToSpaces(lineIn);
        lineIn = lineIn.split('"').join("'"); // replace " with '

        // Get indentation by counting tabs.
        let line = Strings.ltrim(lineIn);
        const depth = lineIn.length - line.length;
    
        this.isComment = false;
        COMMENT_TOKENS.forEach( token => { this.isComment = this.isComment || line.startsWith(token); });

        if (!this.isComment) {
            this.depth = depth;

            line = line.trim();

            this.bulletType = line[0] as EBullet;
            line = line.substr(1).trim() // remove bullet
        
            const split = line.split(LABEL_ID_SEP)
            this.label = Strings.removeInvalidLabelCharacters(split[0].trim());

            this.hasComponentSection = split.length > 1;

            this.id = generateRandomId();
            this.isRandomId = true;
        
            if (this.hasComponentSection) {
                let components = split[1].trim().split(' ');

                // Extract visibility, if present.
                for (let i = 0; i < components.length; ++i) {
                    switch (components[i] as EVisibility) {
                        case EVisibility.eFold: this.visibility = components[i] as EVisibility; break;
                        case EVisibility.eFoldHidden: this.visibility = components[i] as EVisibility; break;
                        case EVisibility.eHide: this.visibility = components[i] as EVisibility; break;
                        default: { // not visibility token
                            if (components[i] === HIGHLIGHT_TOKEN) {
                                this.isHighlight = true;
                            } else { // id (node id or link id)
                                let id = components[i].trim();
                                if (id) {
                                    let type = id[0] as ELink; // first char is the link type (if any)
                                    id = Strings.removeSpecialCharacters(id);
                                    
                                    if (type === ELink.eOut) {
                                        this.idsOut.push(id);
                                    } else if (type === ELink.eIn) {
                                        this.idsIn.push(id);
                                    } else { // no link type char, or no at all
                                        this.id = id // assume it is the current node id
                                        this.isRandomId = false;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}