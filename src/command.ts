'use strict';

import * as path from 'path';
import * as fs from 'fs';
import { exec, ExecOptions, execSync } from 'child_process';
import * as constants from './constants';
import * as vscode from 'vscode';
import * as workspaceUtils from './workspaceUtils';
import * as os from 'os';

interface CommandExecOptions {
  cmd: string;
  cwd?: boolean;
}

/**
 * Command class
 */
export class Command {
  rootPath: string;
  rcPath: string;
  direnvPath: string;
  
  constructor(rootPath: string) {
    this.rootPath = rootPath;
    
    // Get configuration settings
    const config = vscode.workspace.getConfiguration('direnv');
    console.log(`Reading configuration from VSCode API`);
    
    // Try to read path from settings directly first
    const vscodePath = path.join(rootPath, '.vscode');
    const settingsFile = path.join(vscodePath, 'settings.json');
    let direnvPath: string | undefined;
    
    // Try reading directly from settings.json
    if (fs.existsSync(settingsFile)) {
      try {
        console.log(`Reading settings from ${settingsFile}`);
        const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        // Note: accessing property with dot notation using bracket syntax
        if (settings["direnv.path"]) {
          direnvPath = settings["direnv.path"];
          console.log(`Found direnv.path in settings.json: ${direnvPath}`);
        }
      } catch (e) {
        console.error(`Error reading settings.json: ${e}`);
      }
    }
    
    // If we couldn't read from file, try the API
    if (!direnvPath) {
      direnvPath = config.get<string>('path');
      console.log(`From VSCode API direnv.path: ${direnvPath || 'Not set'}`);
    }
    
    // If still not found, check for common locations
    if (!direnvPath || !fs.existsSync(direnvPath)) {
      const foundPaths = workspaceUtils.scanForDirenvPaths();
      if (foundPaths.length > 0) {
        direnvPath = foundPaths[0];
        console.log(`Found direnv at: ${direnvPath}`);
      }
    }
    
    this.direnvPath = direnvPath || constants.direnv.cmd;
    console.log(`Using direnv path: ${this.direnvPath}`);
    
    // Get rc path from settings or use default
    const rcPath = config.get<string>('rcpath');
    if (rcPath && typeof rcPath === 'string') {
      this.rcPath = rcPath;
    } else {
      this.rcPath = path.join(rootPath, constants.direnv.rc);
    }
    console.log(`Using rc path: ${this.rcPath}`);
  }
  
  // Check if direnv is installed and accessible
  public checkDirenvInstalled(): boolean {
    try {
      // First check if the path exists directly as a file
      if (fs.existsSync(this.direnvPath) && fs.statSync(this.direnvPath).isFile()) {
        // File exists, try to execute it
        try {
          execSync(`"${this.direnvPath}" --version`, { stdio: 'ignore' });
          return true;
        } catch (e) {
          console.error(`File exists at ${this.direnvPath} but failed to execute`);
          return false;
        }
      }
      
      // If not a direct file path, try using which/where
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${checkCommand} ${this.direnvPath}`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      console.error(`Failed to find direnv at ${this.direnvPath}`);
      return false;
    }
  }
  
  // Private methods
  private exec(options: CommandExecOptions): Thenable<string> {
    // Check if direnv is installed first
    if (!this.checkDirenvInstalled()) {
      return Promise.reject(new Error(`direnv not found. Please install direnv or set the correct path in settings.`));
    }
    
    // Don't quote paths on Unix systems, it causes issues with direnv
    let direnvCmd = process.platform === 'win32' 
      ? `"${this.direnvPath}" ${options.cmd}` 
      : `${this.direnvPath} ${options.cmd}`;
      
    let execOptions: ExecOptions = {};
    
    if (options.cwd == null || options.cwd) {
      execOptions.cwd = this.rootPath;
      // Check if the directory exists
      if (!fs.existsSync(this.rootPath)) {
        return Promise.reject(new Error(`Directory not found: ${this.rootPath}`));
      }
    }
    
    console.log(`Executing command: ${direnvCmd} in directory: ${execOptions.cwd}`);
    
    return new Promise((resolve, reject) => {
      exec(direnvCmd, execOptions, (err, stdout, stderr) => {
        if (err) {
          console.error(`Command execution failed: ${err.message}`);
          console.error(`Stderr: ${stderr}`);
          err.message = stderr || `Failed to execute: ${direnvCmd}`;
          reject(err);
        } else {
          console.log(`Command executed successfully. Output: ${stdout.substring(0, 100)}${stdout.length > 100 ? '...' : ''}`);
          resolve(stdout);
        }
      });
    });
  }
  
  // Public methods
  version = () => this.exec({ cmd: 'version' });

  // Simplified allow command
  allow = () => this.exec({ cmd: 'allow' });

  deny = () => this.exec({ cmd: 'deny' });
  exportJSON = () => this.exec({ cmd: 'export json' }).then((o) => o ? JSON.parse(o) : {});
}
