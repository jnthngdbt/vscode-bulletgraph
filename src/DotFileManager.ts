import * as vscode from 'vscode';
import * as fs from 'fs';

import { BulletGraph, Node, LinksMap } from './BulletGraph'
import { ENode, EEdge, ERenderingEngine, BASE_ARROWSIZE, BASE_FONTSIZE, BASE_PENWIDTH, FONTSIZE_FACTOR } from './constants'
import { Strings } from './utils'

export class DotFileManager {
    constructor() {}

    generate(bullet: BulletGraph): string {	
        let str  = "";
        str += "digraph G { \n";
        str += "\n";
    
        let indent = Strings.TAB;

        const root = bullet.hierarchy;
    
        str += indent + "splines = ortho \n";
        str += "\n";
    
        str += indent + "// High level default styles. \n";
        str += indent + "graph [bgcolor = grey15, fontcolor = grey50, fontname=\"arial narrow\"] \n";
        str += indent + `edge [fontname=\"arial narrow\", penwidth=${BASE_PENWIDTH}, arrowsize=${BASE_ARROWSIZE}] \n`;
        str += indent + `node [fontname=\"arial narrow\", penwidth=${BASE_PENWIDTH}, style=rounded] \n`;
        str += "\n";
    
        str += indent + "// Node style for type SUBGRAPH_DATA (title only, no box). \n";
        str += indent + `node [fontcolor=grey40, fontsize=${BASE_FONTSIZE}, shape=plain] \n`;
        str += this.printNodes(root.children, indent, ENode.eSubgraph);
        str += "\n";
    
        str += indent + "// Node style for type SUBGRAPH_PROCESS (title only, no box). \n";
        str += indent + `node [fontcolor=\"#8888bb\", fontsize=${BASE_FONTSIZE}, shape=plain] \n`; // #aaaadd/#8888bb
        str += this.printNodes(root.children, indent, ENode.eSubgraphProcess);
        str += "\n";
        
        str += indent + "// Node style for type DATA. \n";
        str += indent + `node [color=grey30, fontcolor=grey70, fontsize=${BASE_FONTSIZE}, shape=box, style=rounded] \n`;
        str += this.printNodes(root.children, indent, ENode.eDefault);
        str += "\n";
    
        str += indent + "// Node style for type PROCESS. \n";
        str += indent + `node [color=\"#555588\", fontcolor=\"#8888bb\", fontsize=${BASE_FONTSIZE}, style=rounded, shape=box] \n`;
        str += this.printNodes(root.children, indent, ENode.eProcess);
        str += "\n";
        
        str += indent + "// Node style for type DATA (folded). \n";
        str += indent + `node [color=grey30, fontcolor=grey80, fontsize=${BASE_FONTSIZE}, style=rounded, shape=box] \n`;
        str += this.printNodes(root.children, indent, ENode.eFolded);
        str += "\n";
    
        str += indent + "// Node style for type PROCESS (folded). \n";
        str += indent + `node [color=\"#555588\", fontcolor=\"#555588\", fontsize=${BASE_FONTSIZE}, style=rounded, shape=box] \n`;
        str += this.printNodes(root.children, indent, ENode.eProcessFolded);
        str += "\n";
    
        str += indent + "// Edge style for type FLOW. \n";
        str += indent + "edge [color=\"#555588\", style=straight] \n";
        str += this.printEdges(indent, bullet.links, EEdge.eFlow);
        str += "\n";
    
        str += indent + "// Edge style for type HIERARCHY. \n";
        str += indent + "edge [color=grey20, style=invis, arrowtail=none, arrowhead=none] \n";
        str += this.printEdges(indent, bullet.links, EEdge.eHierarchy);
        str += "\n";
    
        str += indent + "// Edge style for type LINK. \n";
        str += indent + "edge [color=\"#bb55bb\", style=straight, arrowtail=inv, arrowhead=normal] \n"; // known random bug with dir=both when splines=ortho
        str += this.printEdges(indent, bullet.links, EEdge.eLink);
        str += "\n";

        str += indent + "// Edge style for type BIDIRECTIONAL LINK. \n";
        str += indent + "edge [color=\"#ff77ff\", style=straight, dir=both, arrowtail=normal, arrowhead=normal] \n"; // known random bug with dir=both when splines=ortho
        str += this.printEdges(indent, bullet.links, EEdge.eBiLink);
        str += "\n";
        
        str += indent + "// Style for undeclared nodes (can help debug if something is wrong). \n";
        str += indent + "node [color=\"#aa3333\", fontcolor=grey10, style=\"rounded,filled\", shape=box] \n";
        str += "\n";
    
        str += indent + "// Subgraph node hierarchy. \n";
        str += indent + "subgraph clusterRoot { \n";
        indent += Strings.TAB;
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
            if (node.getType() == type) {
                // Determine a font size, depending on dependency size.
                // atan(0.1) ~ 0.1, atan(0.5) ~ 0.45, atan(1) ~ 0.8, atan(10) ~ 1.5 
                const curveFactor = FONTSIZE_FACTOR; // lower: big numbers damped // higher: more linear, can cause big graphs to have extreme big fonts
                const fontsize = Math.round(BASE_FONTSIZE + Math.atan(node.dependencySize / curveFactor) * curveFactor);
    
                str += indent + node.id;

                let props = [];
                if (node.dependencySize) props.push(`fontsize=${fontsize}`);
                if (node.isHighlight) {
                    props.push(`fillcolor=\"#442244\"`);
                    if (node.isProcess()) props.push(`style = \"rounded,filled\"`);
                    else props.push(`style = filled`);
                }

                if (props.length > 0) {
                    str += " [";
                    for (let i = 0; i < props.length; ++i) {
                        str += props[i];
                        if (i < props.length-1) str += ", ";
                    }
                    str += "]";
                }

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
                if (edge.mustRender && edge.type === type) {
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
            if (node.isSubgraph()) {
                let style = "";

                style += `penwidth = ${BASE_PENWIDTH}; `;

                if (node.isProcess()) {
                    style += `color = \"#555588\"; style = "rounded,filled"; `;
                } else {
                    style += `color = gray30; style = "rounded,filled"; `;
                } 
                
                if (node.isHighlight) {
                    style += `fillcolor = \"#442244\"; `;
                } else {
                    style += `fillcolor = none; `;
                }
    
                str += "\n";
                str += indent + "subgraph cluster" + node.id + " {\n";
                str += indent + Strings.TAB + style + "\n";
                str += indent + Strings.TAB + node.id + " [label=< <B>" + Strings.wordWrap(node.label, "<BR/>") + "</B> >] // subgraph name \n";
                str += this.printNodesHierarchy(node.children, indent + Strings.TAB);
                str += indent + "} \n";
            } else if (!node.isLeaf()) {
                const fontcolor = node.isProcess() ? "\"#8888bb\"" : "gray60"
                str += indent + node.id + " [fontcolor = " + fontcolor + ", label=< <B>" + Strings.wordWrap(node.label, "<BR/>") + "</B> >]\n";
            } else {
                str += indent + node.id + " [label=\"" + Strings.wordWrap(node.label) + "\"]\n";
            }
        })
    
        return str
    }

    render(bullet: BulletGraph, engine: ERenderingEngine) {
        const content = this.generate(bullet);
        const fullname = vscode.window.activeTextEditor?.document.fileName + ".dot";
        fs.writeFile(fullname, content, () => this.writeCompletionHandler(fullname, content, engine));
    }

    writeCompletionHandler(fullname: string, content: string, engine: ERenderingEngine) {
        switch (engine) {
            case ERenderingEngine.eGraphviz:{
                vscode.commands.executeCommand('graphviz.previewToSide', vscode.Uri.file(fullname));
                break;
            }
            case ERenderingEngine.eGraphvizInteractive: {
                let callback = (webpanel: any) => this.interactivePreviewWebpanelCallback(webpanel);
                vscode.workspace.openTextDocument(fullname).then( (document) => {
                    let args = { document, content, callback };
                    vscode.commands.executeCommand("graphviz-interactive-preview.preview.beside", args);
                });
                break;
            }
        }
    }

    interactivePreviewWebpanelCallback(webpanel: any) {
        let handler = (message: any) => { return this.interactivePreviewMessageHandler(message); }
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