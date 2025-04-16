import * as vscode from 'vscode';
import * as utils from './utils';
import * as constants from './constants';
import { Command } from './command';
import * as path from 'path';
import * as fs from 'fs';
import * as workspaceUtils from './workspaceUtils';

let oldEnvDiff: Record<string, string> = {};

export function activate(context: vscode.ExtensionContext): void {
  console.log('Direnv extension is now active');

  // Get workspace root path
  const rootPath = workspaceUtils.getBestRootPath();
  
  // Initialize direnv command and watcher
  let command = new Command(rootPath);
  let watcher = vscode.workspace.createFileSystemWatcher(command.rcPath, true);
  
  // Helper functions
  const displayError = (e: any): Thenable<string | undefined> => {
    if (e.message && e.message.includes('not found')) {
      return vscode.window.showErrorMessage(
        `${constants.messages.error(e)} Please install direnv or set the correct path in settings.`, 
        'Configure Path', 'Cancel'
      ).then(selection => {
        if (selection === 'Configure Path') {
          return vscode.commands.executeCommand('workbench.action.openSettings', 'direnv.path');
        }
        return undefined;
      });
    }
    return vscode.window.showErrorMessage(constants.messages.error(e));
  };
    
  // View RC file function
  const view = async (): Promise<any> => {
    // Find the .envrc file
    const envrcPath = command.rcPath;
    return vscode.commands.executeCommand(
      constants.vscode.commands.open, 
      vscode.Uri.file(envrcPath)
    ).then(undefined, displayError);
  };
  
  // Assign environment variables function
  const assignEnvDiff = (options: { showSuccess: boolean }): Thenable<any> => {
    return command.exportJSON()
    .then((envDiff) => {
        Object.keys(envDiff).forEach((key) => {
            if (key.indexOf('DIRENV_') === -1 && oldEnvDiff[key] !== envDiff[key]) {
                oldEnvDiff[key] = process.env[key] || '';
            }
        });
        return utils.assign(process.env, envDiff);
    })
    .then(() => {
        if (options.showSuccess) {
            return vscode.window.showInformationMessage(constants.messages.assign.success);
        }
        return undefined;
    }, (err) => {
        if (err.message.indexOf(`${constants.direnv.rc} is blocked`) !== -1) {
            return vscode.window.showWarningMessage(
                constants.messages.assign.warn,
                constants.vscode.extension.actions.allow,
                constants.vscode.extension.actions.view
            );
        } else {
            return displayError(err);
        }
    })
    .then((option) => {
        if (option === constants.vscode.extension.actions.allow) {
            return allow();
        } else if (option === constants.vscode.extension.actions.view) {
            return view().then(() =>
              vscode.window.showInformationMessage(constants.messages.assign.allow,
                constants.vscode.extension.actions.allow)
            ).then((choice) => {
              if (choice === constants.vscode.extension.actions.allow) {
                return allow();
              }
              return undefined;
            });
        }
        return undefined;
    });
  };
  
  // Allow .envrc file function
  const allow = (): Thenable<any> => {
    return command.allow()  // 执行 direnv allow
    .then(() => assignEnvDiff({ showSuccess: true }),  // 成功后加载变量
    (err) => {
        if (err.message.indexOf(`${constants.direnv.rc} file not found`) !== -1) {  // 文件不存在
            // 用 VS Code 打开文件（会自动创建）
            return vscode.commands.executeCommand(
                constants.vscode.commands.open, 
                vscode.Uri.file(command.rcPath)
            );
        } else {
            return displayError(err);  // 其他错误
        }
    });
  };
  
  // Set up file watchers
  const setupWatchers = (fileWatcher: vscode.FileSystemWatcher): void => {
    fileWatcher.onDidChange(() => vscode.window.showWarningMessage(
      constants.messages.rc.changed,
      constants.vscode.extension.actions.allow
    ).then(option => {
      if (option === constants.vscode.extension.actions.allow) {
        return allow();
      }
      return undefined;
    }));
    
    fileWatcher.onDidDelete(() => vscode.window.showWarningMessage(
      constants.messages.rc.deleted,
      constants.vscode.extension.actions.revert
    ).then(option => {
      if (option === constants.vscode.extension.actions.revert) {
        utils.assign(process.env, oldEnvDiff);
        oldEnvDiff = {};
        vscode.window.showInformationMessage(constants.messages.reverted);
      }
    }));
  };
  
  // Initialize watchers
  setupWatchers(watcher);

  // Register commands
  context.subscriptions.push(vscode.commands.registerCommand('direnv.version', () => {
    command.version()
      .then(v => vscode.window.showInformationMessage(constants.messages.version(v)))
      .then(undefined, displayError);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('direnv.view', view));
  context.subscriptions.push(vscode.commands.registerCommand('direnv.allow', allow));

  // Try to find .envrc files
  workspaceUtils.findEnvrcFiles().then(files => {
    if (files.length > 0) {
      vscode.window.showInformationMessage(
        `Found ${files.length} .envrc file(s). Use "Direnv: Allow RC File" to load.`
      );
    }
  });
}

export function deactivate(): void {}
