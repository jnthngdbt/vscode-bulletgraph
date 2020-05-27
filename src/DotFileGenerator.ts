import * as vscode from 'vscode';
import { writeFile } from 'fs';

import { Bullet, Node, ENode, EEdge, Focus, LinksMap } from './Bullet'
import { Strings } from './utils'

const TAB = "\t"

export class DotFileGenerator {
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