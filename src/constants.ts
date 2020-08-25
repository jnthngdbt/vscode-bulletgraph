export const COMMENT = "//";
export const LABEL_ID_SEP = "//";
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
