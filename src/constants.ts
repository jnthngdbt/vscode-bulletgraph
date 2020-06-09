export const COMMENT = "//";
export const LABEL_ID_SEP = "//";

export enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess };
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
