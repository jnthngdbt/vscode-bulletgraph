import { Id, EBullet, EEdge, ENode, EVisibility } from './constants'
import { DocumentManager } from './DocumentManager'
import { BulletLine } from './BulletLine'

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

    isLeaf() { // has no children (visible or not)
        return this.dependencySize === 0;
    }

    isSubgraph() { // has visible children
        return this.children.length > 0;
    }

    isFolded() { // has children, but not visible
        return !this.isLeaf() && !this.isSubgraph();
    }

    isProcess() {
        return this.bullet === EBullet.eFlow;
    }

    isFlowBreak() {
        return this.bullet === EBullet.eFlowBreak;
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
        } else if (this.bullet === EBullet.eFlowBreak) {
            return ENode.eFlowBreak;
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

    copyFrom(other: Node) {
        this.bullet = other.bullet;
        this.label = other.label;
        this.id = other.id;
        this.isHighlight = other.isHighlight;
        this.dependencySize = other.dependencySize;
        this.children = other.children;
    }

    fill(line: BulletLine, links: LinksMap, foldNodeIds: IdSet, hideNodeIds: IdSet) {
        this.bullet = line.bullet;
        this.label = line.label;
        this.id = line.id;
        this.isHighlight = line.isHighlight;

        line.idsIn.forEach( id => { links.addEdge(id, this.id, EEdge.eLink) });
        line.idsOut.forEach( id => { links.addEdge(this.id, id, EEdge.eLink) });

        switch (line.visibility) {
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
        let doc = new DocumentManager();
        doc.extractLines();
        const bulletLines = doc.parseBulletsLines();
        this.parse(bulletLines);
    }

    parse(bulletLines: Array<BulletLine>) {
        this.clear();
    
        let currentParentForIndent: { [key:number]:Node; } = {};
        currentParentForIndent[0] = this.hierarchy;
    
        bulletLines.forEach( line => {
            if (!line.isComment) {
                let node = new Node();
                node.fill(line, this.links, this.foldNodeIds, this.hideNodeIds);

                // Fill hierarchy.
                const depth = line.depth;
                currentParentForIndent[depth].children.push(node)
                currentParentForIndent[depth + 1] = node
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
            if (!child.isFlowBreak()) { // do not link to it
                if (child.isProcess()) { 
                    if (!node.isProcess() && !aFlowChildWasLinked) { // link subgraph parent to only first process child
                        this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                        aFlowChildWasLinked = true;
                    }
                } else if (child.isSubgraph()) { // connect all subgraph children to parent
                    this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                } else { // no visible children, so considered leaf
                    if (lastLeafChild.isValid()) { // link all leaf nodes together, in chain
                        this.links.addEdge(lastLeafChild.id, child.id, EEdge.eHierarchy);
                    } else {
                        this.links.addEdge(node.id, child.id, EEdge.eHierarchy);
                    }
    
                    lastLeafChild = child; // remember last leaf node for chaining
                }
            }
    
            // Recurse.
            this.createHierarchyEdges(child);
        })
    }

    createFlowEdges(node: Node, lastNode: Node | undefined = undefined) {
        // Create a flow edge between 2 consecutive process nodes (can be parent -> child).
        if (lastNode && node.isProcess() && lastNode.isProcess()) {
            this.links.addEdge(lastNode.id, node.id, EEdge.eFlow);
        }

        if (!lastNode) lastNode = new Node();
        lastNode.copyFrom(node);

        if (node.children.length <= 0) return;
    
        node.children.forEach( child => {
            this.createFlowEdges(child, lastNode); // recurse
        })
    }

    reorderNodeChildren(node: Node) {
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

        // Recurse.
        node.children.forEach( child => {
            this.reorderNodeChildren(child);
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