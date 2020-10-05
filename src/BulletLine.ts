import { COMMENT_TOKENS, LABEL_ID_SEP, HIGHLIGHT_TOKEN, EBullet, ELink, EVisibility } from './constants'
import { Strings, isScriptLine } from './utils'

import { generateRandomId } from './NodeIdGenerator'

export class BulletLine {
    text = "";
    index = -1;
    isComment = false;
    depth = -1;
    bullet = EBullet.eDefault;
    label = "";
    visibility = EVisibility.eNormal;
    isHighlight = false;
    id = "";
    idsIn: Array<string> = [];
    idsOut: Array<string> = [];
    hasComponents = false;
    hasComponentSection = false;

    clear() {
        this.text = "";
        this.index = -1;
        this.isComment = false;
        this.depth = -1;
        this.bullet = EBullet.eDefault;
        this.label = "";
        this.visibility = EVisibility.eNormal;
        this.isHighlight = false;
        this.id = "";
        this.idsIn = [];
        this.idsOut = [];
        this.hasComponents = false;
        this.hasComponentSection = false;
    }

    isValid(): Boolean {
        return !this.isComment && (this.depth >= 0) && !isScriptLine(this.text);
    }

    parse(lineIn: string | undefined, lineIdx: number) {
        this.clear();

        if (!lineIn) return;
        if (lineIn.length <= 0) return;
        if (lineIn.trim().length <= 0) return; // skip empty line, or only containing tabs/spaces

        this.text = lineIn;
        this.index = lineIdx;

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

            this.bullet = line[0] as EBullet;
            line = line.substr(1).trim() // remove bullet
        
            const split = line.split(LABEL_ID_SEP)
            this.label = Strings.removeInvalidLabelCharacters(split[0].trim());

            this.hasComponentSection = split.length > 1;

            this.id = generateRandomId();
        
            if (!this.hasComponentSection) {
                this.hasComponents = false;
            } else {
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
                                    }
                                }
                            }
                        }
                    }
                }

                // True if the component section contains something other than a visibility token.
                let hasVisibility = this.visibility != EVisibility.eNormal;
                this.hasComponents = (components.length > 1) || !hasVisibility; // being here, we know we have at least 1 component, may be visibility
            }
        }
    }
}