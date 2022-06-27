import * as vscode from 'vscode';
import { Id, EBullet, EEdge, ENode, EVisibility } from './constants'
import { BulletManager } from './BulletManager'
import { Bullet } from './Bullet'

export class Node {
    bulletType: EBullet = EBullet.eDefault;
    label: string = "";
    id: Id = "";
    isHighlight = false;
    dependencySize = 0;
    children: Array<Node> = [];

    constructor() { }

    isValid() {
        return this.id.length > 0;
    }

    isLeaf() { // has no children (visible or not)
        return this.dependencySize === 0;
    }

    isSubgraph() { // has visible children
        return this.children.length > 0;
    }

    isFolded() { // has children, but not visible
        return !this.isLeaf() && !this.isSubgraph();
    }

    isFlow() {
        return this.bulletType === EBullet.eFlow;
    }

    isFlowBreak() {
        return this.bulletType === EBullet.eFlowBreak;
    }

    isFlowOrFlowBreak() {
        return this.isFlow() || this.isFlowBreak()
    }

    getType(): ENode {
        if (this.bulletType === EBullet.eDefault) {
            if (this.children.length > 0) {
                return ENode.eSubgraph;
            } else if (this.dependencySize > 0) {
                return ENode.eFolded;
            } else {
                return ENode.eDefault;
            }
        } else if (this.bulletType === EBullet.eFlow || this.bulletType === EBullet.eFlowBreak) {
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
        this.bulletType = EBullet.eDefault;
        this.label = "";
        this.id = "";
        this.isHighlight = false;
        this.dependencySize = 0;
        this.children = [];
    }

    copyFrom(other: Node) {
        this.bulletType = other.bulletType;
        this.label = other.label;
        this.id = other.id;
        this.isHighlight = other.isHighlight;
        this.dependencySize = other.dependencySize;
        this.children = other.children;
    }

    fill(bullet: Bullet, links: LinksMap, foldNodeIds: IdSet, hideNodeIds: IdSet) {
        this.bulletType = bullet.bulletType;
        this.label = bullet.label;
        this.id = bullet.id;
        this.isHighlight = bullet.isHighlight;

        bullet.idsIn.forEach( id => { links.addEdge(id, this.id, EEdge.eLink) });
        bullet.idsOut.forEach( id => { links.addEdge(this.id, id, EEdge.eLink) });
        bullet.idsEqual.forEach( id => { links.addEdge(this.id, id, EEdge.eEqual) });

        switch (bullet.visibility) {
            case EVisibility.eFold: foldNodeIds.add(this.id); break;
            case EVisibility.eHide: hideNodeIds.add(this.id); break;
        }
    }
}

export class Edge {
    idSrc: Id;
    idDst: Id;
    type: EEdge;
    mustRender = true;
    constructor(idSrc: Id, idDst: Id, type: EEdge) {
        this.idSrc = idSrc;
        this.idDst = idDst;
        this.type = type;
        this.mustRender = true;
    }

    isEqual(other: Edge): Boolean {
        if (this.idSrc == other.idSrc)
            if (this.idDst == other.idDst)
                if (this.type === other.type)
                    return true;
        return false;
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

export class BulletGraph {
    hierarchy = new Node();
    links = new LinksMap();
    foldNodeIds = new IdSet();
    hideNodeIds = new IdSet();

    clear() {
        this.hierarchy = new Node();
        this.links = new LinksMap();
        this.foldNodeIds = new IdSet();
        this.hideNodeIds = new IdSet();
    }

    parseEditorFile() {
        let b = new BulletManager();
        this.parse(b.bullets);
    }

    parse(bullets: Array<Bullet>) {
        this.clear();
    
        let currentParentForIndent: { [key:number]:Node; } = {};
        currentParentForIndent[0] = this.hierarchy;
        let lastDepth = -1;
    
        bullets.forEach( bullet => {
            if (!bullet.isComment) {
                let node = new Node();
                node.fill(bullet, this.links, this.foldNodeIds, this.hideNodeIds);

                // Check depth.
                const depth = bullet.depth;
                if (depth > lastDepth && (depth - lastDepth) > 1) {
                    const tabSize = vscode.workspace.getConfiguration('editor').tabSize;
                    vscode.window.showErrorMessage(`Bad indentation at line ${bullet.lineIdx + 1}: you cannot indent by more than one level at a time. If you are using spaces as tabs, check the number of spaces you are using (the current tab setting is ${tabSize} spaces).`);
                }

                // Fill hierarchy.
                currentParentForIndent[depth].children.push(node)
                currentParentForIndent[depth + 1] = node;
                lastDepth = depth;
            }
        })

        this.computeDependencySize(this.hierarchy);
    }

    createHierarchyEdges(node: Node) {
        if (node.children.length <= 0) return;
    
        // Create hierarchy edges to children, and recurse.
        let aFlowChildWasLinked = false;
        let lastLeafChild = new Node();
        node.children.forEach( child => {
            if (child.isFlow()) { 
                if (!node.isFlow() && !aFlowChildWasLinked) { // link subgraph parent to only first process child
                    this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                    aFlowChildWasLinked = true;
                }
            } else if (child.isFlowBreak()) {
                this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
            } else if (child.isSubgraph()) { // connect all subgraph children to parent
                this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
            } else { // no visible children, so considered leaf
                if (lastLeafChild.isValid()) { // link all leaf nodes together, in chain
                    this.links.addEdge(lastLeafChild.id, child.id, EEdge.eHierarchySibling);
                } else { // first leaf node
                    this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                }

                lastLeafChild = child; // remember last leaf node for chaining
            }
    
            // Recurse.
            this.createHierarchyEdges(child);
        })
    }

    createFlowEdges(node: Node, lastNode: Node | undefined = undefined, parent: Node | undefined = undefined) {
        // Create a flow edge between 2 consecutive process nodes (can be parent -> child).
        if (lastNode && node.isFlow() && lastNode.isFlowOrFlowBreak()) {
            this.links.addEdge(lastNode.id, node.id, EEdge.eFlow);
        }

        if (!lastNode) lastNode = new Node();
        lastNode.copyFrom(node);

        if (parent && parent.isFlowOrFlowBreak() && node.isFlowBreak()) {
            this.links.addEdge(parent.id, node.id, EEdge.eFlow);
        }

        if (node.children.length <= 0) return;
    
        node.children.forEach( child => {
            this.createFlowEdges(child, lastNode, node); // recurse
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