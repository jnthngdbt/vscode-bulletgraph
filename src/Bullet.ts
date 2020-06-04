import * as vscode from 'vscode';
import { ok } from 'assert';

import { COMMENT, LABEL_ID_SEP, EBullet, EEdge, ELink, ENode, EVisibility } from './constants'
import { LineManager } from './LineManager'
import { generateRandomId } from './NodeIdGenerator'
import { Strings } from './utils'

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

    isProcess() {
        return (this.type === ENode.eProcess) || (this.type === ENode.eSubgraphProcess);
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

    fill(line: LineManager, links: LinksMap, floorNodeIds: IdSet) {
        this.bullet = line.bullet;

        if (this.bullet === EBullet.eFlow) {
            this.type = ENode.eProcess;
        } else {
            this.type = ENode.eDefault;
        }
    
        this.label = line.label;
    
        // Get node ID. Create one if necessary.
        this.setRandomId() // initialize to random id
        if (line.components.length > 0) {
            line.components.forEach( (linkId: string) => {
                linkId = linkId.trim();
                if (linkId) {
                    let type = linkId[0] as ELink; // first char is the link type (if any)
                    linkId = Strings.removeSpecialCharacters(linkId);
                    
                    if (type === ELink.eOut) {
                        links.addEdge(this.id, linkId, EEdge.eLink)
                    } else if (type === ELink.eIn) {
                        links.addEdge(linkId, this.id, EEdge.eLink)
                    } else { // no link type char, or no at all
                        this.id = linkId // assume it is the current node id
                    }
                }
            })
        }

        if (line.visibility === EVisibility.eFloor)
            floorNodeIds.add(this.id);
    }
}

export class Edge {
    idSrc: Id;
    idDst: Id;
    type: EEdge;
    constructor(idSrc: Id, idDst: Id, type: EEdge) {
        this.idSrc = idSrc;
        this.idDst = idDst;
        this.type = type;
    }
}

export class Links {
    inputs: Array<Edge> = [];
    outputs: Array<Edge> = [];
    constructor() { }
}

export class LinksMap {
    map: { [key:string]:Links; } = {};

    addEdge(idSrc: Id, idDst: Id, type: EEdge) {
        if (!idSrc || !idDst)
            return

        if (!this.map[idSrc]) {
            this.map[idSrc] = new Links();
        }

        if (!this.map[idDst]) {
            this.map[idDst] = new Links();
        }
    
        this.map[idSrc].outputs.push(new Edge(idSrc, idDst, type));
        this.map[idDst].inputs.push(new Edge(idDst, idSrc, type));
    }

    getNodeIds(): string[] {
        return Object.keys(this.map);
    }

    getNodeLinks(nodeId: Id): Links {
        return this.map[nodeId];
    }
}

export class IdSet {
    array: Array<Id> = [];

    add(id: Id): void {
        if (!this.has(id))
            this.array.push(id);
    }
    has(id: Id): boolean {
        return this.array.includes(id);
    }
    isEmpty() {
        return this.array.length <= 0;
    }
    parse(line: string, token: string): void {
        if (line.startsWith(token)) {
            line = line.substr(token.length).trim();
            const ids = line.split(',');
            ids.forEach( id => {
                this.add(id.trim());
            })
        }
    }
}

export class DepthManager {
    nodeRerouteMap: { [key:string]:Id; } = {};
    bullet = new Bullet();

    rerouteNodes(nodeIn: Node, floorNodeIds: IdSet, nodeOut: Node, isFloorReached = false, floorNodeId = "") {
        nodeIn.children.forEach( childIn => {
            let childOut = new Node();
            let isFloorReachedForNext = isFloorReached || floorNodeIds.has(childIn.id);
            let floorNodeIdForNext = (!isFloorReached && isFloorReachedForNext) ? childIn.id : floorNodeId;
            
            if (isFloorReached) {
                this.nodeRerouteMap[childIn.id] = floorNodeId;
            } else {
                this.nodeRerouteMap[childIn.id] = childIn.id; // reroute to itself (no effect)

                // Copy child.
                childOut.bullet = childIn.bullet;
                childOut.dependencySize = childIn.dependencySize;
                childOut.id = childIn.id;
                childOut.label = childIn.label;
                childOut.type = childIn.type;

                if (isFloorReachedForNext) {
                    childOut.type = childOut.isProcess() ? ENode.eProcess : ENode.eDefault;
                }

                nodeOut.children.push(childOut); // add it to ouput hierarchy
            }
            this.rerouteNodes(childIn, floorNodeIds, childOut, isFloorReachedForNext, floorNodeIdForNext);
        });
    }

    rerouteLinks(links: LinksMap) {
        for (var id of links.getNodeIds()) {
            const nodeId = this.nodeRerouteMap[id];
            links.getNodeLinks(id).outputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idDst = this.nodeRerouteMap[edge.idDst];
                    if (idDst !== nodeId)
                        this.bullet.links.addEdge(nodeId, idDst, edge.type);
                }
            })
            links.getNodeLinks(id).inputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idSrc = this.nodeRerouteMap[edge.idSrc];
                    if (idSrc !== nodeId)
                        this.bullet.links.addEdge(idSrc, nodeId, edge.type);
                }
            })
        }
    }

    pruneAndReorganize(bulletIn: Bullet): Bullet {
        this.bullet.clear();
        this.rerouteNodes(bulletIn.hierarchy, bulletIn.floorNodeIds, this.bullet.hierarchy);
        this.rerouteLinks(bulletIn.links);
        this.bullet.createHierarchyEdges(this.bullet.hierarchy);
        
        return this.bullet;
    }
}

export class Bullet {
    line = new LineManager();
    hierarchy = new Node();
    links = new LinksMap();
    floorNodeIds = new IdSet();

    clear() {
        this.hierarchy = new Node();
        this.links = new LinksMap();
        this.floorNodeIds = new IdSet();
    }
    
    // Parse the textual hierarchy into nested objects.
    parseEditorFile() {
        let text = vscode.window.activeTextEditor?.document.getText() ?? "";
        
        if (!text) {
            vscode.window.showErrorMessage('Bullet Graph: No editor is active.');
        }
        
        this.clear();
    
        let lastNode = this.hierarchy;
        let currentParentForIndent: { [key:number]:Node; } = {};
        currentParentForIndent[0] = this.hierarchy;
    
        const lines = text.split(/\r?\n/) ?? []; // new lines

        if (!lines) {
            vscode.window.showErrorMessage('Bullet Graph: Could not parse current editor.');
        }
    
        lines.forEach( line => {
            if (line.trim().length > 0) { // skip empty line, or only containing tabs/spaces
                this.line.clear();
                this.line.parse(line);
    
                if (!this.line.isComment) {
                    let node = new Node();
    
                    node.fill(this.line, this.links, this.floorNodeIds);
    
                    // Create flow edges, if applicable
                    if (lastNode.id && (lastNode.bullet === EBullet.eFlow) && (node.bullet === EBullet.eFlow)) {
                        this.links.addEdge(lastNode.id, node.id, EEdge.eFlow);
                    }
    
                    // Force subgraph type of parent node, since now have child.
                    const depth = this.line.depth;
                    if (currentParentForIndent[depth].bullet === EBullet.eFlow) {
                        currentParentForIndent[depth].type = ENode.eSubgraphProcess;
                    } else {
                        currentParentForIndent[depth].type = ENode.eSubgraph;
                    }
    
                    // Fill hierarchy.
                    currentParentForIndent[depth].children.push(node)
                    currentParentForIndent[depth + 1] = node
    
                    lastNode = node
                }
            }
        })

        this.computeDependencySize(this.hierarchy);
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
                    this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                    aFlowChildWasLinked = true;
                }
            } else {
                // Create edge.
                if (!atLeastOneLeafLinked) { // only link parent node to first leaf node
                    this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                } else if (lastLeafNode.isValid()) { // link all leaf nodes together, in chain
                    this.links.addEdge(lastLeafNode.id, child.id, EEdge.eHierarchy);
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
            node.dependencySize += this.computeDependencySize(child) + 1 // +1 to count the child itself
        })
    
        return node.dependencySize
    }
}