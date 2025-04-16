import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // Extension root directory
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    
    // Test file directory
    const extensionTestsPath = path.resolve(__dirname, './test');

    // Run tests
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
