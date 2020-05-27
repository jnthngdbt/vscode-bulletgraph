import * as vscode from 'vscode';
import { ok } from 'assert';
import { writeFile } from 'fs';

const TAB = "\t"
const COMMENT = "//"
const LABEL_ID_SEP = "//"
const FOCUS = "[*]"

namespace Strings {
    // Trim leading (left) spaces/tabs.
    export function ltrim(str: string): string {
        if (!str) return str;
        return str.replace(/^\s+/g, '');
    }

    export function removeSpecialCharacters(str: string): string {
        return str.replace(/[-=&\/\\#,+()$~%.'":*?<>{}]/g, '');
    }

    export function convertTabsToSpaces(str: string): string {
        const tabSize = vscode.workspace.getConfiguration('editor').tabSize;
        const tabSpaces = " ".repeat(tabSize);
        let re = new RegExp(tabSpaces, "g");
        return str?.replace(re, '\t');
    }

    export function wordWrap(str: string, maxCharsOnLine = 25): string {
        str = str.trim();
    
        // Determine where to cut.
        const nbLines = Math.ceil(str.length / maxCharsOnLine);
        const cutSteps = Math.round(str.length / nbLines);
    
        if (nbLines <= 1)
            return str;
    
        let wrappedStr = "";
        
        // Wrap lines at position where it is possible.
        let currentLineBreak = 1;
        for (let i = 0; i < str.length; ++i) {
            const ch = str[i];
            wrappedStr += ch;
    
            const canCut = (ch == ' ') || (ch == '\t') || (ch == '-') || (ch == '\\') || (ch == '/');
            if (canCut && (i >= currentLineBreak * cutSteps)) {
                wrappedStr += "\\n";
                currentLineBreak++;
            }
        }
    
        return wrappedStr;
    }
}

// Adapted from code snippet generating a uuid.
function randomId(): string {
    return 'id_xxxxxxxx_xxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

enum ENode { eDefault, eProcess, eSubgraph, eSubgraphProcess }
enum EEdge { eHierarchy, eFlow, eLink }

enum ELink { 
    eIn = '<', 
    eOut = '>',
}

enum EBullet {
    eDefault = '-',
    eFlow = '>'
}

type Id = string;

class Node {
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
}

class Edge {
    id: Id;
    type: EEdge;
    constructor(id: Id, type: EEdge) {
        this.id = id;
        this.type = type;
    }
}

class Links {
    inputs: Array<Edge> = [];
    outputs: Array<Edge> = [];
    constructor() { }
}

class Focus { // could use a built-in set
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

type LinksMap = { [key:string]:Links; };

class Bullet {
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
        node.id = randomId() // initialize to random id
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

class DotFileGenerator {
    constructor() {}

    generate(bullet: Bullet): void {	
        let str  = "";
        str += "digraph G { \n";
        str += "\n";
    
        let indent = TAB;

        const root = bullet.hierarchy;
    
        str += indent + "splines = ortho \n";
        str += "\n";
    
        str += indent + "// High level default styles. \n";
        str += indent + "graph [bgcolor = grey10, fontcolor = grey50, fontname=\"arial narrow\"] \n";
        str += indent + "edge [fontname=\"arial narrow\"] \n";
        str += indent + "node [fontname=\"arial narrow\"] \n";
        str += "\n";
    
        str += indent + "// Node style for type SUBGRAPH_DATA. \n";
        str += indent + "node [color=grey30, fontcolor=grey80, fontsize=14, shape=plain] \n";
        str += this.printNodes(root.children, indent, bullet.focus, ENode.eSubgraph);
        str += "\n";
    
        str += indent + "// Node style for type SUBGRAPH_PROCESS. \n";
        str += indent + "node [color=grey30, fontcolor=\"#aaaadd\", fontsize=14, shape=plain] \n";
        str += this.printNodes(root.children, indent, bullet.focus, ENode.eSubgraphProcess);
        str += "\n";
        
        str += indent + "// Node style for type DATA. \n";
        str += indent + "node [color=grey20, fontcolor=grey60, fontsize=14, style=none, shape=box] \n";
        str += this.printNodes(root.children, indent, bullet.focus, ENode.eDefault);
        str += "\n";
    
        str += indent + "// Node style for type PROCESS. \n";
        str += indent + "node [color=grey30, fontcolor=\"#8888bb\", fontsize=14, style=rounded, shape=box] \n";
        str += this.printNodes(root.children, indent, bullet.focus, ENode.eProcess);
        str += "\n";
    
        str += indent + "// Edge style for type FLOW. \n";
        str += indent + "edge [color=grey50, style=straight] \n";
        str += this.printEdges(indent, bullet.links, bullet.focus, EEdge.eFlow);
        str += "\n";
    
        str += indent + "// Edge style for type HIERARCHY. \n";
        str += indent + "edge [color=grey20, style=invis, arrowtail=none, arrowhead=none] \n";
        str += this.printEdges(indent, bullet.links, bullet.focus, EEdge.eHierarchy);
        str += "\n";
    
        str += indent + "// Edge style for type LINK. \n";
        str += indent + "edge [color=\"#aa5555\", style=straight, arrowtail=inv, arrowhead=normal] \n"; // known random bug with dir=both when splines=ortho
        str += this.printEdges(indent, bullet.links, bullet.focus, EEdge.eLink);
        str += "\n";
        
        str += indent + "// Style for undeclared nodes (can help debug if something is wrong). \n";
        str += indent + "node [color=\"#aa3333\", fontcolor=grey10, style=\"rounded,filled\", shape=box] \n";
        str += "\n";
    
        str += indent + "// Subgraph node hierarchy. \n";
        str += indent + "subgraph clusterRoot { \n";
        indent += TAB;
        str += this.printNodesHierarchy(root.children, indent, bullet.focus);
        indent = indent.slice(0, -1);
        str += indent + "} \n";
    
        str += "} \n";
    
        // Write to file.
        const filepath = vscode.workspace.rootPath // could be: path.dirname(vscode.window.activeTextEditor.document.fileName)
        const fullname = filepath + "/generated.dot"
        writeFile(fullname, str, function (err) {
            if (err) return console.log(err);
        });
    }
    
    // Recursively write IDs of either leaves or subgraphs.
    printNodes(children: Array<Node>, indent: string, focus: Focus, type: ENode) {
        if (children.length <= 0) return "";
        
        let str = "";
        children.forEach( node => {
            if ((node.type == type) && focus.isFocus(node.id)) {
                // Determine a font size, depending on dependency size.
                // atan(0.1) ~ 0.1, atan(0.5) ~ 0.45, atan(1) ~ 0.8, atan(10) ~ 1.5 
                const curveFactor = 50; // lower: big numbers damped // higher: more linear, can cause big graphs to have extreme big fonts
                const fontsize = Math.round(14 + Math.atan(node.dependencySize / curveFactor) * curveFactor);
    
                str += indent + node.id;
                if (node.dependencySize)
                    str += ` [fontsize=${fontsize}]`;
                str += ` // ${node.label}`;
                str += "\n";
            }
            str += this.printNodes(node.children, indent, focus, type)
        })
    
        return str
    }
    
    printEdges(indent: string, edges: LinksMap, focus: Focus, type: EEdge) {
        let str = "";
        for (var id of Object.keys(edges)) {
            let nodeOutEdges = edges[id].outputs;
            nodeOutEdges.forEach( edge => {
                const isFocus = focus.isFocus(id) && focus.isFocus(edge.id);
                if ((edge.type === type) && isFocus) {
                    str += indent + id + " -> " + edge.id + "\n";
                }
            })
        }
        return str;
    }

    printNodesHierarchy(children: Array<Node>, indent: string, focus: Focus) {
        if (children.length <= 0) return "";
    
        let str = "";
        children.forEach( node => {
            if (focus.isFocus(node.id)) {
                if (node.children.length >= 1) {
                    let style = "";
                    if (node.type === ENode.eSubgraphProcess) {
                        style = "color = gray30; style = rounded";
                    } else if (node.type === ENode.eSubgraph) {
                        style = "color = gray30; style = none";
                    }
        
                    str += "\n";
                    str += indent + "subgraph cluster" + node.id + " {\n";
                    str += indent + TAB + style + "\n";
                    str += indent + TAB + node.id + " [label=\"" + Strings.wordWrap(node.label) + "\"] // subgraph name \n";
                    str += this.printNodesHierarchy(node.children, indent + TAB, focus);
                    str += indent + "} \n";
                } else {
                    str += indent + node.id + " [label=\"" + Strings.wordWrap(node.label) + "\"]\n";
                }
            }
        })
    
        return str
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => {
            let bullet = new Bullet();
            bullet.parseEditorFile();
            console.log(bullet);

            let dotFileGenerator = new DotFileGenerator();
            dotFileGenerator.generate(bullet);
        })
    );
}

export function deactivate() {}
