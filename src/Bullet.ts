import * as vscode from 'vscode';
import { ok } from 'assert';

import { EBullet, EEdge, ELink, ENode, EVisibility } from './constants'
import { LineManager } from './LineManager'

export type Id = string;

export class Node {
    bullet: EBullet = EBullet.eDefault;
    label: string = "";
    id: Id = "";
    isHighlight = false;
    dependencySize = 0;
    children: Array<Node> = [];

    constructor() { }

    isValid() {
        return this.id.length > 0;
    }

    isLeaf() {
        return this.dependencySize === 0;
    }

    isSubgraph() {
        return this.children.length > 0;
    }

    isProcess() {
        return this.bullet === EBullet.eFlow;
    }

    getType(): ENode {
        if (this.bullet === EBullet.eDefault) {
            if (this.children.length > 0) {
                return ENode.eSubgraph;
            } else if (this.dependencySize > 0) {
                return ENode.eFolded;
            } else {
                return ENode.eDefault;
            }
        } else if (this.bullet === EBullet.eFlow) {
            if (this.children.length > 0) {
                return ENode.eSubgraphProcess;
            } else if (this.dependencySize > 0) {
                return ENode.eProcessFolded;
            } else {
                return ENode.eProcess;
            }
        }
        return ENode.eDefault;
    }

    clear() {
        this.bullet = EBullet.eDefault;
        this.label = "";
        this.id = "";
        this.isHighlight = false;
        this.dependencySize = 0;
        this.children = [];
    }

    fill(line: LineManager, links: LinksMap, floorNodeIds: IdSet, hideNodeIds: IdSet) {
        this.bullet = line.bullet;
        this.label = line.label;
        this.id = line.id;
        this.isHighlight = line.isHighlight;

        line.idsIn.forEach( id => { links.addEdge(id, this.id, EEdge.eLink) });
        line.idsOut.forEach( id => { links.addEdge(this.id, id, EEdge.eLink) });

        switch (line.visibility) {
            case EVisibility.eFloor: floorNodeIds.add(this.id); break;
            case EVisibility.eHide: hideNodeIds.add(this.id); break;
        }
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

    rerouteNodes(nodeIn: Node, floorNodeIds: IdSet, hideNodeIds: IdSet, nodeOut: Node, isFloorReached = false, isHidden = false, floorNodeId = "") {
        nodeIn.children.forEach( childIn => {
            let childOut = new Node();

            let isFloorReachedForNext = isFloorReached || floorNodeIds.has(childIn.id);
            let floorNodeIdForNext = (!isFloorReached && isFloorReachedForNext) ? childIn.id : floorNodeId;

            let isHiddenForNext = isHidden || hideNodeIds.has(childIn.id);
            
            if (isHiddenForNext) { // do not show current child if hiding starts at it
                this.nodeRerouteMap[childIn.id] = "";
            } else if (isFloorReached) { // show current child if floor starts at it
                this.nodeRerouteMap[childIn.id] = floorNodeId;
            } else {
                this.nodeRerouteMap[childIn.id] = childIn.id; // reroute to itself (no effect)

                // Copy child.
                childOut.bullet = childIn.bullet;
                childOut.dependencySize = childIn.dependencySize;
                childOut.id = childIn.id;
                childOut.isHighlight = childIn.isHighlight;
                childOut.label = childIn.label;
                nodeOut.children.push(childOut); // add it to ouput hierarchy
            }
            this.rerouteNodes(childIn, floorNodeIds, hideNodeIds, childOut, isFloorReachedForNext, isHiddenForNext, floorNodeIdForNext);
        });
    }

    rerouteLinks(links: LinksMap) {
        for (var id of links.getNodeIds()) {
            const nodeId = this.nodeRerouteMap[id];
            links.getNodeLinks(id).outputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idDst = this.nodeRerouteMap[edge.idDst];
                    if (nodeId && idDst && (idDst !== nodeId))
                        this.bullet.links.addEdge(nodeId, idDst, edge.type);
                }
            })
            links.getNodeLinks(id).inputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idSrc = this.nodeRerouteMap[edge.idSrc];
                    if (nodeId && idSrc && (idSrc !== nodeId))
                        this.bullet.links.addEdge(idSrc, nodeId, edge.type);
                }
            })
        }
    }

    removeDuplicateLinksInArray(edges : Array<Edge>) {
        const isDuplicate = (edgeIdx = 0): Boolean => {
            for (let i = 0; i < edgeIdx; i++) { // avoid i === edgeIdx, to not test with itself
                if (edges[i].idSrc == edges[edgeIdx].idSrc)
                    if (edges[i].idDst == edges[edgeIdx].idDst)
                        if (edges[i].type === edges[edgeIdx].type)
                            return true;
            }
            return false;
        };

        // Find duplicates and delete them.
        for (let i = edges.length-1; i >= 0; i--) { // go backwards to not be affected by deletes
            if (isDuplicate(i)) {
                edges.splice(i, 1); // delete
            }
        }
    }

    removeDuplicateLinks() {
        let links = this.bullet.links;
        let nodeIds = links.getNodeIds();
        nodeIds.forEach(nodeId => {
            let nodeLinks = links.getNodeLinks(nodeId);
            this.removeDuplicateLinksInArray(nodeLinks.inputs);
            this.removeDuplicateLinksInArray(nodeLinks.outputs);
        });
    }

    pruneAndReorganize(bulletIn: Bullet): Bullet {
        this.bullet.clear();
        this.rerouteNodes(bulletIn.hierarchy, bulletIn.floorNodeIds, bulletIn.hideNodeIds, this.bullet.hierarchy);
        this.rerouteLinks(bulletIn.links);
        this.bullet.createHierarchyEdges(this.bullet.hierarchy);
        this.removeDuplicateLinks();
        
        return this.bullet;
    }
}

export class Bullet {
    line = new LineManager();
    hierarchy = new Node();
    links = new LinksMap();
    floorNodeIds = new IdSet();
    hideNodeIds = new IdSet();

    clear() {
        this.hierarchy = new Node();
        this.links = new LinksMap();
        this.floorNodeIds = new IdSet();
        this.hideNodeIds = new IdSet();
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
    
                    node.fill(this.line, this.links, this.floorNodeIds, this.hideNodeIds);
    
                    // Create flow edges, if applicable
                    if (lastNode.id && (lastNode.bullet === EBullet.eFlow) && (node.bullet === EBullet.eFlow)) {
                        this.links.addEdge(lastNode.id, node.id, EEdge.eFlow);
                    }
                    
                    // Fill hierarchy.
                    if (this.line.label.length > 0) { // this was added to give a way to not connect two subsequent flow nodes, but putting an empty node (no label) betweem
                        const depth = this.line.depth;
                        currentParentForIndent[depth].children.push(node)
                        currentParentForIndent[depth + 1] = node
                    }
    
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
            if (lhs.getType() === rhs.getType()) return 0; // do not change order
            if (lhs.isSubgraph() && !rhs.isSubgraph()) return -1; // we want subgraphs first
            if (rhs.isSubgraph() && !lhs.isSubgraph()) return 1; // we want subgraphs first
            if (!lhs.isLeaf() && rhs.isLeaf()) return -1; // we want subgraphs first
            if (!rhs.isLeaf() && lhs.isLeaf()) return 1; // we want subgraphs first
            return 0;
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
            const isLeaf = !child.isSubgraph();
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