import * as vscode from 'vscode';

import { ELink } from './constants'
import { DotFileManager } from './DotFileManager'
import { generateIdFromLineContent } from './NodeIdGenerator'
import { BulletManager } from './BulletManager';
import { NavigationManager } from './NavigationManager';
import { ScriptManager } from './ScriptManager';
import { Editor } from './utils';
import { ReportManager } from './ReportManager';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderPreview', () => new DotFileManager().renderEditorFile(true, true, false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.renderAndSaveSvg', () => new DotFileManager().renderEditorFile(true, true, true))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateDotFile', () => new DotFileManager().renderEditorFile(true, false, false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.insertId', () => {
            const text = Editor.getLine(Editor.getActiveLineIdx());
            const id = generateIdFromLineContent(text);
            Editor.insertTextAtActivePosition(id);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.applyScript', () => {
            new ScriptManager().applyScript(Editor.getActiveLineIdx());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.applyScriptFromList', () => {
            new ScriptManager().applyScriptFromList();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.exportScriptsToSvgFiles', () => {
            new ScriptManager().renderAndSaveScriptsToSvg();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.generateMarkdown', () => {
            new ReportManager().generateMarkdownReportFromScripts();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldNode', () => {
            let b = new BulletManager();
            b.foldCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldNode', () => {
            let b = new BulletManager();
            b.unfoldCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideNode', () => {
            let b = new BulletManager();
            b.hideCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideNode', () => {
            let b = new BulletManager();
            b.unhideCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldAll', () => {
            let b = new BulletManager();
            b.foldAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldAll', () => {
            let b = new BulletManager();
            b.unfoldAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideAll', () => {
            let b = new BulletManager();
            b.hideAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideAll', () => {
            let b = new BulletManager();
            b.unhideAllCommand();
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.foldChildren', () => {
            let b = new BulletManager();
            b.foldChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unfoldChildren', () => {
            let b = new BulletManager();
            b.unfoldChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.hideChildren', () => {
            let b = new BulletManager();
            b.hideChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.unhideChildren', () => {
            let b = new BulletManager();
            b.unhideChildrenCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.highlightNode', () => {
            let b = new BulletManager();
            b.highlightCommand(b.getActiveBullet(), true);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.spotlightNode', () => {
            let b = new BulletManager();
            b.spotlightCommand(b.getActiveBullet(), false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.revealNode', () => {
            let b = new BulletManager();
            b.revealCommand(b.getActiveBullet(), false);
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNode', () => {
            let b = new BulletManager();
            b.connectCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.networkNode', () => {
            let b = new BulletManager();
            b.networkCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.flowIn', () => {
            let b = new BulletManager();
            b.flowInCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.flowOut', () => {
            let b = new BulletManager();
            b.flowOutCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.connectNodeHierarchy', () => {
            let b = new BulletManager();
            b.connectHierarchyCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.networkNodeHierarchy', () => {
            let b = new BulletManager();
            b.networkHierarchyCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.lessVisible', () => {
            let b = new BulletManager();
            b.lessVisibleCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.moreVisible', () => {
            let b = new BulletManager();
            b.moreVisibleCommand(b.getActiveBullet());
            b.update();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-bulletgraph.updateFolding', () => {
            let b = new BulletManager();
            b.updateEditorFoldingCommand();
        })
    );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToNextSibling', () => { new NavigationManager().goToNextSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToPreviousSibling', () => { new NavigationManager().goToPreviousSibling(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToParent', () => { new NavigationManager().goToParent(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToChildren', () => { new NavigationManager().goToChildren(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goNextVisible', () => { new NavigationManager().goNextVisible(Editor.getActiveLineIdx()); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goBackVisible', () => { new NavigationManager().goBackVisible(Editor.getActiveLineIdx()); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.moveCursorUp', () => { NavigationManager.moveCursorUp(); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.moveCursorDown', () => { NavigationManager.moveCursorDown(); }) );
    
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToLine', () => { new NavigationManager().goToLine(); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.goToConnectionBullet', () => { new NavigationManager().goToConnectionBullet(Editor.getActiveLineIdx()); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkIn', () => { new BulletManager().addLink(ELink.eIn); }) );
    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.addLinkOut', () => { new BulletManager().addLink(ELink.eOut); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.insertIdFromOtherLine', () => { new BulletManager().insertIdFromOtherLine(); }) );

    context.subscriptions.push( vscode.commands.registerCommand('vscode-bulletgraph.cleanupIdsAndLinks', () => { new ScriptManager().cleanupIdsAndLinksCommand(); }) );

    BulletManager.console.show()
}

export function deactivate() {}
