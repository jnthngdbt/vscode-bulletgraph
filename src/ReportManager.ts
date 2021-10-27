import * as vscode from 'vscode';
import { promises as fsPromises } from 'fs';
var path = require("path");

import { DotFileManager } from './DotFileManager';
import { ScriptManager, Script } from './ScriptManager';
import {  } from './constants'
import {  } from './utils'

export class ReportManager {
    scriptManager = new ScriptManager();

    async generateMarkdownReportFromScripts() {
      await this.scriptManager.renderAndSaveScriptsToSvg();
      const content = this.generateMarkdownReportStringFromScripts(this.scriptManager.scripts);

      const reportFilename = vscode.window.activeTextEditor?.document.fileName + ".md";
      await fsPromises.writeFile(reportFilename, content);
    }

    generateMarkdownReportStringFromScripts(scripts: Array<Script>): string {	
        let str  = "";
        
        for (const script of scripts) {
            str += `# ${script.name} \n`;
            str += `\n`;

            // ![](/bullet/log/2021-10-15%2014-48-44.ScanDataArchitecture.blt.dot.svg)
            const dotFullname = DotFileManager.getDotFilename(script.name);
            const svgFullname = dotFullname + ".svg";
            const svgFilename = path.basename(svgFullname).replace(/\s/g, "%20"); // replaces spaces
            str += `![](${svgFilename})\n`;
            str += `\n`;
        }
    
        return str;
    }
}