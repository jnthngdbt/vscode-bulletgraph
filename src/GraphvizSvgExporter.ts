import { promises as fsPromises } from 'fs';
import { Uri, window, workspace } from 'vscode';
import { graphviz } from "@hpcc-js/wasm";

export class GraphvizSvgExporter {
    constructor() {

    }

    async export(dotFileUri: Uri, svgFileUri: Uri): Promise<void> {
        let svg = await this.renderSvgString(dotFileUri);
        await fsPromises.writeFile(svgFileUri.fsPath, svg);
    }

    protected async renderSvgString(documentUri: Uri): Promise<string> {
        let doc = await workspace.openTextDocument(documentUri);
        let graphVizText = doc.getText();
        let svg = await graphviz.dot(graphVizText);
        return svg;
    }
}