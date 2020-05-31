import * as vscode from 'vscode';

const fsPromises = require('fs').promises

import { Bullet, Node, ENode, EEdge, LinksMap } from './Bullet'
import { Strings } from './utils'

const TAB = "\t"

export class DotFileManager {
    constructor() {}

    generate(bullet: Bullet): string {	
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
        str += this.printNodes(root.children, indent, ENode.eSubgraph);
        str += "\n";
    
        str += indent + "// Node style for type SUBGRAPH_PROCESS. \n";
        str += indent + "node [color=grey30, fontcolor=\"#aaaadd\", fontsize=14, shape=plain] \n";
        str += this.printNodes(root.children, indent, ENode.eSubgraphProcess);
        str += "\n";
        
        str += indent + "// Node style for type DATA. \n";
        str += indent + "node [color=grey20, fontcolor=grey60, fontsize=14, style=none, shape=box] \n";
        str += this.printNodes(root.children, indent, ENode.eDefault);
        str += "\n";
    
        str += indent + "// Node style for type PROCESS. \n";
        str += indent + "node [color=grey30, fontcolor=\"#8888bb\", fontsize=14, style=rounded, shape=box] \n";
        str += this.printNodes(root.children, indent, ENode.eProcess);
        str += "\n";
    
        str += indent + "// Edge style for type FLOW. \n";
        str += indent + "edge [color=grey50, style=straight] \n";
        str += this.printEdges(indent, bullet.links, EEdge.eFlow);
        str += "\n";
    
        str += indent + "// Edge style for type HIERARCHY. \n";
        str += indent + "edge [color=grey20, style=invis, arrowtail=none, arrowhead=none] \n";
        str += this.printEdges(indent, bullet.links, EEdge.eHierarchy);
        str += "\n";
    
        str += indent + "// Edge style for type LINK. \n";
        str += indent + "edge [color=\"#aa5555\", style=straight, arrowtail=inv, arrowhead=normal] \n"; // known random bug with dir=both when splines=ortho
        str += this.printEdges(indent, bullet.links, EEdge.eLink);
        str += "\n";
        
        str += indent + "// Style for undeclared nodes (can help debug if something is wrong). \n";
        str += indent + "node [color=\"#aa3333\", fontcolor=grey10, style=\"rounded,filled\", shape=box] \n";
        str += "\n";
    
        str += indent + "// Subgraph node hierarchy. \n";
        str += indent + "subgraph clusterRoot { \n";
        indent += TAB;
        str += this.printNodesHierarchy(root.children, indent);
        indent = indent.slice(0, -1);
        str += indent + "} \n";
    
        str += "} \n";
    
        return str;
    }
    
    // Recursively write IDs of either leaves or subgraphs.
    printNodes(children: Array<Node>, indent: string, type: ENode) {
        if (children.length <= 0) return "";
        
        let str = "";
        children.forEach( node => {
            if (node.type == type) {
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
            str += this.printNodes(node.children, indent, type)
        })
    
        return str
    }
    
    printEdges(indent: string, links: LinksMap, type: EEdge) {
        let str = "";
        for (var id of links.getNodeIds()) {
            let nodeOutEdges = links.getNodeLinks(id).outputs;
            nodeOutEdges.forEach( edge => {
                if (edge.type === type) {
                    str += indent + edge.idSrc + " -> " + edge.idDst + "\n";
                }
            })
        }
        return str;
    }

    printNodesHierarchy(children: Array<Node>, indent: string) {
        if (children.length <= 0) return "";
    
        let str = "";
        children.forEach( node => {
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
                str += this.printNodesHierarchy(node.children, indent + TAB);
                str += indent + "} \n";
            } else {
                str += indent + node.id + " [label=\"" + Strings.wordWrap(node.label) + "\"]\n";
            }
        })
    
        return str
    }

    render(bullet: Bullet) {
        const content = this.generate(bullet);
        const fullname = vscode.window.activeTextEditor?.document.fileName + ".dot";
        fsPromises.writeFile(fullname, content).then( () => this.writeCompletionHandler(fullname, content) );
    }

    writeCompletionHandler(fullname: string, content: string) {
        let callback = (webpanel: any) => this.interactivePreviewWebpanelCallback(webpanel);
        vscode.workspace.openTextDocument(fullname).then( (document) => {
            let args = { document, content, callback };
            vscode.commands.executeCommand("graphviz-interactive-preview.preview.beside", args);
        });
    }

    interactivePreviewWebpanelCallback(webpanel: any) {
        let handler = (message: any) => { this.interactivePreviewMessageHandler(message); }
        webpanel.handleMessage = handler;
    }

    interactivePreviewMessageHandler(message: any) {
        // Click events are corretly catched here, but the message.value.node is,
        // always "this", which seems to be an issue. Could post something on
        // https://github.com/tintinweb/vscode-interactive-graphviz/issues.
        console.log(JSON.stringify(message));

        switch(message.command){
            case 'onClick':
                console.log("Bullet Graph: onClick");
                break;
            case 'onDblClick':
                console.log("Bullet Graph: onDblClick");
                break;
            default:
                console.warn('Unexpected command: ' + message.command);
        }
    }
}