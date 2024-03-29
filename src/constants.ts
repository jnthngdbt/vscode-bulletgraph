export const COMMENT_TOKENS = ["//", '#'];
export const LABEL_ID_SEP = "@@";
export const HIGHLIGHT_TOKEN = "[*]";
export const SCRIPT_LINE_TOKEN = '$';
export const NEW_SCRIPT_CHAR = '[';

export const BASE_FONTSIZE = 30;
export const BASE_ARROWSIZE = 1.5;
export const BASE_PENWIDTH = 2;
export const BASE_EDGE_WEIGHT = 1;
export const FONTSIZE_FACTOR = 2;

export const ENABLE_EDITOR_FOLDING = true;

export type Id = string;

export enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess, eFolded, eProcessFolded, eFlowBreak };
export enum EEdge { eHierarchy, eHierarchySibling, eFlow, eLink, eBiLink, eEqual, eEqualIn, eEqualOut, eEqualFolded };

export enum ELink { 
    eIn = '<', 
    eOut = '>',
    eEqual = '=',
};

export enum EBullet {
    eDefault = '-',
    eFlow = '>',
    eFlowBreak = '^'
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

export enum EConnectDirection {
    eIn,
    eOut,
    eInOut,
    eEqual,
};
