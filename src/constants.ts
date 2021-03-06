export const COMMENT_TOKENS = ["//", '#'];
export const LABEL_ID_SEP = "@@";
export const HIGHLIGHT_TOKEN = "[*]";
export const SCRIPT_LINE_TOKEN = '$';
export const NEW_SCRIPT_CHAR = '[';

export const BASE_FONTSIZE = 30;
export const BASE_ARROWSIZE = 1.5;
export const BASE_PENWIDTH = 2;
export const FONTSIZE_FACTOR = 2;

export const ENABLE_EDITOR_FOLDING = false;

export type Id = string;

export enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess, eFolded, eProcessFolded, eFlowBreak };
export enum EEdge { eHierarchy, eFlow, eLink, eBiLink };

export enum ELink { 
    eIn = '<', 
    eOut = '>',
};

export enum EBullet {
    eDefault = '-',
    eFlow = '>',
    eFlowBreak = '<'
};

export enum EVisibility {
    eNormal = "",
    eFold = "[+]",
    eFoldHidden = "[-]",
    eHide = "[x]",
};

export enum ERenderingEngine {
    eGraphviz,
    eGraphvizInteractive,
};
