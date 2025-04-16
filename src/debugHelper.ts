'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function registerDebugCommand(context: vscode.ExtensionContext) {
  const debugCommand = vscode.commands.registerCommand('direnv.debug', () => {
    const outputChannel = vscode.window.createOutputChannel('Direnv Debug');
    outputChannel.clear();
    
    // Check workspace settings
    const workspaceRoot = vscode.workspace.rootPath || '';
    outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);
    
    // Check configuration
    const generalConfig = vscode.workspace.getConfiguration();
    const direnvConfig = vscode.workspace.getConfiguration('direnv');
    
    outputChannel.appendLine(`\nConfiguration values:`);
    outputChannel.appendLine(`direnvConfig.get('path'): ${direnvConfig.get('path') || 'Not set'}`);
    outputChannel.appendLine(`generalConfig.get('direnv.path'): ${generalConfig.get('direnv.path') || 'Not set'}`);
    
    // Check config files
    const userConfigPath = path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
    const workspaceConfigPath = path.join(workspaceRoot, '.vscode', 'settings.json');
    
    outputChannel.appendLine(`\nConfiguration files:`);
    if (fs.existsSync(userConfigPath)) {
      outputChannel.appendLine(`User config exists: ${userConfigPath}`);
      try {
        const content = fs.readFileSync(userConfigPath, 'utf8');
        outputChannel.appendLine(`Content: ${content}`);
      } catch (e) {
        outputChannel.appendLine(`Failed to read user config: ${e}`);
      }
    } else {
      outputChannel.appendLine(`User config does not exist: ${userConfigPath}`);
    }
    
    if (fs.existsSync(workspaceConfigPath)) {
      outputChannel.appendLine(`Workspace config exists: ${workspaceConfigPath}`);
      try {
        const content = fs.readFileSync(workspaceConfigPath, 'utf8');
        outputChannel.appendLine(`Content: ${content}`);
      } catch (e) {
        outputChannel.appendLine(`Failed to read workspace config: ${e}`);
      }
    } else {
      outputChannel.appendLine(`Workspace config does not exist: ${workspaceConfigPath}`);
    }
    
    // Check specific direnv path
    const specificPath = "/home/jupyter-yyk/dev/vsc-direnv/.pixi/envs/default/bin/direnv";
    if (fs.existsSync(specificPath)) {
      outputChannel.appendLine(`\nSpecific direnv path exists: ${specificPath}`);
    } else {
      outputChannel.appendLine(`\nSpecific direnv path does not exist: ${specificPath}`);
    }
    
    // Show the output channel
    outputChannel.show();
  });
  
  context.subscriptions.push(debugCommand);
}
