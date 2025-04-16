'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Find all .envrc files in the workspace
 */
export async function findEnvrcFiles(): Promise<string[]> {
  const results: string[] = [];
  
  // 1. Check workspace folders through VS Code API
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    for (const folder of workspaceFolders) {
      try {
        const pattern = new vscode.RelativePattern(folder, '**/.envrc');
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
        results.push(...files.map(file => file.fsPath));
      } catch (e) {
        console.error(`Error finding files in workspace folder: ${e}`);
      }
    }
  }
  
  // 2. Check parent directories of the current workspace
  try {
    let currentDir = getBestRootPath();
    // Go up to 3 levels to find .envrc
    for (let i = 0; i < 3; i++) {
      const envrcPath = path.join(currentDir, '.envrc');
      if (fs.existsSync(envrcPath) && !results.includes(envrcPath)) {
        results.push(envrcPath);
      }
      // Go up one level
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Stop if we've reached the root
      currentDir = parentDir;
    }
  } catch (e) {
    console.error(`Error checking parent directories: ${e}`);
  }
  
  // 3. Check current working directory
  try {
    const currentDir = process.cwd();
    const currentDirEnvrc = path.join(currentDir, '.envrc');
    if (fs.existsSync(currentDirEnvrc) && !results.includes(currentDirEnvrc)) {
      results.push(currentDirEnvrc);
    }
  } catch (e) {
    console.error(`Error checking current directory: ${e}`);
  }
  
  // 4. Also check root directory where .vscode is located
  try {
    // This is often where the user actually runs VS Code from
    const rootDir = path.resolve('.');
    const rootEnvrc = path.join(rootDir, '.envrc');
    if (fs.existsSync(rootEnvrc) && !results.includes(rootEnvrc)) {
      results.push(rootEnvrc);
    }
  } catch (e) {
    console.error(`Error checking root directory: ${e}`);
  }
  
  // Log what we found
  console.log(`Found ${results.length} .envrc files:`, results);
  
  return results;
}

/**
 * Get the workspace settings file path
 */
export function getWorkspaceSettingsPath(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
  }
  return undefined;
}

/**
 * Get the user settings file path
 */
export function getUserSettingsPath(): string {
  return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
}

/**
 * Read settings from a JSON file
 */
export function readSettingsFromFile(filePath: string): any {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Failed to read settings from ${filePath}: ${e}`);
    }
  }
  return {};
}

/**
 * Get the best available root path
 */
export function getBestRootPath(): string {
  // First try workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  
  // Then try current working directory
  try {
    const cwd = process.cwd();
    if (cwd) return cwd;
  } catch (e) {
    console.error(`Failed to get current working directory: ${e}`);
  }
  
  // Fall back to home directory
  return os.homedir();
}

/**
 * Scan for direnv executables in common locations
 */
export function scanForDirenvPaths(): string[] {
  const results: string[] = [];
  
  // Check common locations for direnv
  const commonLocations = [
    // Linux/macOS common locations
    '/usr/bin/direnv',
    '/usr/local/bin/direnv',
    '/opt/homebrew/bin/direnv',
    path.join(os.homedir(), '.local/bin/direnv'),
    
    // Project-specific locations
    path.join(process.cwd(), '.pixi/envs/default/bin/direnv'),
    path.join(process.cwd(), 'node_modules/.bin/direnv'),
    
    // OS-specific locations
    ...(process.platform === 'darwin' ? 
      ['/opt/homebrew/bin/direnv', '/usr/local/bin/direnv'] : []),
    ...(process.platform === 'win32' ? 
      [path.join(os.homedir(), 'AppData/Local/direnv/direnv.exe')] : [])
  ];
  
  // Check which ones exist
  for (const location of commonLocations) {
    if (fs.existsSync(location)) {
      results.push(location);
    }
  }
  
  // Try to find via PATH
  try {
    const { execSync } = require('child_process');
    const command = process.platform === 'win32' ? 'where direnv' : 'which direnv';
    const pathResult = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    
    if (pathResult && !results.includes(pathResult)) {
      results.push(pathResult);
    }
  } catch (e) {
    // Ignore errors from which/where command
  }
  
  // Also look for paths in environment variables that might contain direnv
  const envPaths = [
    process.env.PATH,
    process.env.Path,
    process.env.path
  ].filter(Boolean); // Filter out undefined values
  
  if (envPaths.length > 0) {
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const direnvName = process.platform === 'win32' ? 'direnv.exe' : 'direnv';
    
    for (const envPath of envPaths) {
      if (envPath) {
        for (const dir of envPath.split(pathSeparator)) {
          const possiblePath = path.join(dir, direnvName);
          if (fs.existsSync(possiblePath) && !results.includes(possiblePath)) {
            results.push(possiblePath);
          }
        }
      }
    }
  }
  
  return results;
}

/**
 * Try to find a valid direnv executable path
 */
export function findDirenvPath(): string | undefined {
  const paths = scanForDirenvPaths();
  return paths.length > 0 ? paths[0] : undefined;
}

/**
 * Update direnv path in all relevant settings files
 */
export async function setDirenvPath(direnvPath: string): Promise<void> {
  console.log(`Setting direnv path to: ${direnvPath}`);
  
  // Try the VS Code API first
  try {
    console.log(`Updating via VS Code API: ConfigurationTarget.Workspace`);
    await vscode.workspace.getConfiguration('direnv').update('path', direnvPath, vscode.ConfigurationTarget.Workspace);
  } catch (e) {
    console.error(`Failed to update via VS Code API: ${e}`);
  }
  
  // Log all possible settings locations
  const userSettingsPath = path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
  console.log(`User settings path: ${userSettingsPath}, exists: ${fs.existsSync(userSettingsPath)}`);
  
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  let workspaceSettingsPath = '';
  if (workspaceFolder) {
    workspaceSettingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
    console.log(`Workspace settings path: ${workspaceSettingsPath}, exists: ${fs.existsSync(workspaceSettingsPath)}`);
  } else {
    console.log(`No workspace folder found`);
    // Try to use current directory
    workspaceSettingsPath = path.join(process.cwd(), '.vscode', 'settings.json');
    console.log(`Using current directory settings path: ${workspaceSettingsPath}, exists: ${fs.existsSync(workspaceSettingsPath)}`);
  }
  
  // Also try directly writing to the workspace settings file as a backup
  try {
    if (workspaceSettingsPath) {
      console.log(`Attempting to directly update workspace settings: ${workspaceSettingsPath}`);
      
      // Create .vscode folder if it doesn't exist
      const vscodePath = path.dirname(workspaceSettingsPath);
      if (!fs.existsSync(vscodePath)) {
        console.log(`Creating .vscode directory: ${vscodePath}`);
        fs.mkdirSync(vscodePath, { recursive: true });
      }
      
      // Read existing settings or create new ones
      let settings: Record<string, any> = {};
      if (fs.existsSync(workspaceSettingsPath)) {
        const content = fs.readFileSync(workspaceSettingsPath, 'utf8');
        console.log(`Read existing settings file content length: ${content.length}`);
        settings = JSON.parse(content);
      }
      
      // Update the direnv path - use correct property name
      settings["direnv.path"] = direnvPath;  // Property name needs to be a string literal
      
      // Write back to the file
      console.log(`Writing updated settings to: ${workspaceSettingsPath}`);
      fs.writeFileSync(workspaceSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Successfully updated direnv.path in workspace settings file`);
    }
  } catch (e) {
    console.error(`Error updating settings file: ${e}`);
  }
  
  // Also try to update the extension's own settings as a last resort
  try {
    // Assuming the extension directory is two levels up from this file
    const extensionSettingsPath = path.join(__dirname, '../../.vscode/settings.json');
    console.log(`Extension settings path: ${extensionSettingsPath}, exists: ${fs.existsSync(extensionSettingsPath)}`);
    
    if (fs.existsSync(extensionSettingsPath)) {
      console.log(`Attempting to update extension settings: ${extensionSettingsPath}`);
      
      const settings: Record<string, any> = JSON.parse(fs.readFileSync(extensionSettingsPath, 'utf8'));
      settings["direnv.path"] = direnvPath;
      fs.writeFileSync(extensionSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Successfully updated direnv.path in extension settings file`);
    }
  } catch (e) {
    console.error(`Error updating extension settings file: ${e}`);
  }
}
