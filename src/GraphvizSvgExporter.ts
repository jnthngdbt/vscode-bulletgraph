import fs = require('fs');
import { Uri, window, workspace } from 'vscode';
import { graphviz } from "@hpcc-js/wasm";

export class GraphvizSvgExporter {
    constructor() {

    }

    async export(dotFileUri: Uri, svgFileUri: Uri): Promise<void> {
        let svg = await this.renderSvgString(dotFileUri);
        fs.writeFile(svgFileUri.fsPath, svg, 'utf8', err => {
            if (err) {
                window.showErrorMessage("Cannot export to file " + svgFileUri.fsPath);
                console.log(err);
            }
        });
    }

    protected async renderSvgString(documentUri: Uri): Promise<string> {
        let doc = await workspace.openTextDocument(documentUri);
        let graphVizText = doc.getText();
        let svg = await graphviz.dot(graphVizText);
        return svg;
    }
}