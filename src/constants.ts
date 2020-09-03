export const COMMENT = "//";
export const LABEL_ID_SEP = "//";
export const HIGHLIGHT_TOKEN = "[*]";
export const SCRIPT_LINE_TOKEN = '$';
export const NEW_SCRIPT_CHAR = '[';

export const BASE_FONTSIZE = 30;
export const BASE_ARROWSIZE = 1.5;
export const BASE_PENWIDTH = 2;
export const FONTSIZE_FACTOR = 2;

export enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess, eFolded, eProcessFolded };
export enum EEdge { eHierarchy, eFlow, eLink };

export enum ELink { 
    eIn = '<', 
    eOut = '>',
};

export enum EBullet {
    eDefault = '-',
    eFlow = '>'
};

export enum EVisibility {
    eUndefined = "",
    eNormal = "[]",
    eFloor = "[+]",
    eHide = "[x]",
};

export enum ERenderingEngine {
    eGraphviz,
    eGraphvizInteractive,
};
