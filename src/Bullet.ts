import * as vscode from 'vscode';
import { ok } from 'assert';

import { generateRandomId } from './NodeIdGenerator'
import { Strings } from './utils'

const COMMENT = "//"
const LABEL_ID_SEP = "//"
const FOCUS = "[*]"

export enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess }
export enum EEdge { eHierarchy, eFlow, eLink }

export enum ELink { 
    eIn = '<', 
    eOut = '>',
}

export enum EBullet {
    eDefault = '-',
    eFlow = '>'
}

export type Id = string;

export class Node {
    bullet: EBullet = EBullet.eDefault;
    type: ENode = ENode.eDefault;
    label: string = "";
    id: Id = "";
    dependencySize = 0;
    children: Array<Node> = [];

    constructor() { }

    isValid() {
        return this.id.length > 0;
    }

    isLeaf() {
        return (this.type === ENode.eDefault) || (this.type === ENode.eProcess);
    }

    clear() {
        this.bullet = EBullet.eDefault;
        this.type = ENode.eDefault;
        this.label = "";
        this.id = "";
        this.children = [];
    }

    // Adapted from code snippet generating a uuid.
    setRandomId(): void {
        this.id = generateRandomId();
    }
}

export class Edge {
    id: Id;
    type: EEdge;
    constructor(id: Id, type: EEdge) {
        this.id = id;
        this.type = type;
    }
}

export class Links {
    inputs: Array<Edge> = [];
    outputs: Array<Edge> = [];
    constructor() { }
}

export class Focus { // could use a built-in set
    ids: Array<Id> = [];

    add(id: Id): void {
        if (!this.has(id))
            this.ids.push(id);
    }
    has(id: Id): boolean {
        return this.ids.includes(id);
    }
    isFocus(id: Id): boolean {
        return (this.ids.length <= 0) || this.has(id);
    }
    parse(line: string): void {
        if (line.startsWith(FOCUS)) {
            line = line.substr(FOCUS.length).trim();
            const ids = line.split(',');
            ids.forEach( id => {
                this.add(id.trim());
            })
        }
    }
}

export type LinksMap = { [key:string]:Links; };

export class Bullet {
    hierarchy: Node = new Node();
    links: LinksMap = {};
    focus: Focus = new Focus();
    
    // Parse the textual hierarchy into nested objects.
    parseEditorFile() {
        let text = vscode.window.activeTextEditor?.document.getText() ?? "";
        
        if (!text) {
            vscode.window.showErrorMessage('Bullet Graph: No editor is active.');
        }

        text = Strings.convertTabsToSpaces(text);
        
        this.hierarchy.clear();
    
        let lastNode = this.hierarchy;
        let currentParentForIndent: { [key:number]:Node; } = {};
        currentParentForIndent[0] = this.hierarchy;
    
        const lines = text.split(/\r?\n/) ?? []; // new lines

        if (!lines) {
            vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');
        }
    
        lines.forEach( line => {
            if (line.trim().length > 0) { // skip empty line, or only containing tabs/spaces
                // Replace " with '.
                line = line.split('"').join("'"); // or line.replace(/"/g, "'")
    
                // Get indentation by counting tabs.
                const lineWithoutIndent = Strings.ltrim(line);
                const nbTabs = line.length - lineWithoutIndent.length;
    
                if (!lineWithoutIndent.startsWith(COMMENT)) {
                    if (lineWithoutIndent.startsWith(FOCUS)) {
                        this.focus.parse(lineWithoutIndent);
                    } else {
                        let node = this.parseNodeEntryLine(lineWithoutIndent);
        
                        // Create flow edges, if applicable
                        if (lastNode.id && (lastNode.bullet === EBullet.eFlow) && (node.bullet === EBullet.eFlow)) {
                            this.addEdge(lastNode.id, node.id, EEdge.eFlow);
                        }
        
                        // Force subgraph type of parent node, since now have child.
                        if (currentParentForIndent[nbTabs].bullet === EBullet.eFlow) {
                            currentParentForIndent[nbTabs].type = ENode.eSubgraphProcess;
                        } else {
                            currentParentForIndent[nbTabs].type = ENode.eSubgraph;
                        }
        
                        // Fill hierarchy.
                        currentParentForIndent[nbTabs].children.push(node)
                        currentParentForIndent[nbTabs + 1] = node
        
                        lastNode = node
                    }
                }
            }
        })

        this.createHierarchyEdges(this.hierarchy);
        this.computeDependencySize(this.hierarchy);
    }

    parseNodeEntryLine(line: string): Node {
        line = line.trim();

        let node = new Node();

        node.bullet = line[0] as EBullet;

        if (node.bullet === EBullet.eFlow) {
            node.type = ENode.eProcess;
        } else {
            node.type = ENode.eDefault;
        }
    
        // Get node label.
        const withoutBullet = line.substr(1).trim()
        const labelAndId = withoutBullet.split(LABEL_ID_SEP)
        node.label = labelAndId[0].trim()
    
        // Get node ID. Create one if necessary.
        node.setRandomId() // initialize to random id
        if (labelAndId.length > 1) {
            // The string to parse is something like
            //     id_CurrentNode
            //     id_CurrentNode <id_Input1 <id_Input2 >id_Output
            //     <id_Input1 <id_Input2 >id_Output
            const idAndLinks = labelAndId[1].trim().split(' ')
            
            idAndLinks.forEach( linkId => {
                let type = linkId[0] as ELink; // first char is the link type (if any)
                linkId = Strings.removeSpecialCharacters(linkId);
                
                if (type === ELink.eOut) {
                    this.addEdge(node.id, linkId, EEdge.eLink)
                } else if (type === ELink.eIn) {
                    this.addEdge(linkId, node.id, EEdge.eLink)
                } else { // no link type char, or no at all
                    node.id = linkId // assume it is the current node id
                }
            })
        }
    
        return node
    }

    addEdge(idSrc: Id, idDst: Id, type: EEdge) {
        if (!idSrc || !idDst)
            return

        if (!this.links[idSrc]) {
            this.links[idSrc] = new Links();
        }

        if (!this.links[idDst]) {
            this.links[idDst] = new Links();
        }
    
        this.links[idSrc].outputs.push(new Edge(idDst, type));
        this.links[idDst].inputs.push(new Edge(idSrc, type));
    }

    createHierarchyEdges(node: Node) {
        if (node.children.length <= 0) return;
    
        // Reorder children to have all subgraphs first.
        node.children.sort((lhs, rhs) => {
            if (lhs.bullet !== rhs.bullet) return 0; // do not change order
            if (lhs.bullet === EBullet.eFlow) return 0; // do not change order
            if (lhs.type === rhs.type) return 0; // do not change order
            if (lhs.type === ENode.eSubgraphProcess) return -1; // we want subgraphs first
            if (lhs.type === ENode.eSubgraph) return -1; // we want subgraphs first
            return 1 // here a subgraph is on right and not left, so we want to switch
        });
    
        // Create hierarchy edges to children, and recurse.
        let atLeastOneLeafLinked = false;
        let aFlowChildWasLinked = false;
        let lastLeafNode = new Node();
        node.children.forEach( child => {
            if (child.bullet === EBullet.eFlow) {
                if (!aFlowChildWasLinked && (node.bullet !== EBullet.eFlow)) {
                    this.addEdge(node.id, child.id, EEdge.eHierarchy);
                    aFlowChildWasLinked = true;
                }
            } else {
                // Create edge.
                if (!atLeastOneLeafLinked) { // only link parent node to first leaf node
                    this.addEdge(node.id, child.id, EEdge.eHierarchy);
                } else if (lastLeafNode.isValid()) { // link all leaf nodes together, in chain
                    this.addEdge(lastLeafNode.id, child.id, EEdge.eHierarchy);
                }
            }
    
            // Remember last leaf node for chaining.
            const isLeaf = child.isLeaf();
            if (isLeaf) {
                lastLeafNode = child;
            }
            atLeastOneLeafLinked = isLeaf || atLeastOneLeafLinked;
    
            // Recurse.
            this.createHierarchyEdges(child);
        })
    }

    computeDependencySize(node: Node) {
        if (node.children.length <= 0) return 0;
        
        node.dependencySize = 0
        node.children.forEach( child => {
            if (this.focus.isFocus(child.id)) {
                node.dependencySize += this.computeDependencySize(child) + 1 // +1 to count the child itself
            }
        })
    
        return node.dependencySize
    }
}