import * as assert from 'assert';
import * as vscode from 'vscode';
// Use require as a workaround if TypeScript import fails
const sinon = require('sinon');
import { Command } from '../command';

suite('Command Tests', () => {
  test('Command initialization', () => {
    const command = new Command('/test/path');
    assert.strictEqual(command.rootPath, '/test/path');
  });

  test('Custom direnv path', async () => {
    // Mock configuration
    const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigurationStub.returns({
      get: (key: string) => key === 'direnv.path' ? '/custom/path/direnv' : undefined
    } as any);

    const command = new Command('/test/path');
    assert.strictEqual(command.direnvPath, '/custom/path/direnv');
    
    getConfigurationStub.restore();
  });
  
  test('Custom rc path', async () => {
    // Mock configuration
    const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigurationStub.returns({
      get: (key: string) => key === 'direnv.rcpath' ? '/custom/path/.zshrc' : undefined
    } as any);

    const command = new Command('/test/path');
    assert.strictEqual(command.rcPath, '/custom/path/.zshrc');
    
    getConfigurationStub.restore();
  });
});
