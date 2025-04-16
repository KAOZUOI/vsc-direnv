import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
  // Create test instance
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise<void>((resolve, reject) => {
    // Use fs to read test files instead of glob
    fs.readdir(testsRoot, (err, files) => {
      if (err) {
        return reject(err);
      }

      // Filter for test files
      const testFiles = files.filter(file => file.endsWith('.test.js'));
      
      // Add files to test suite
      testFiles.forEach(file => mocha.addFile(path.resolve(testsRoot, file)));

      try {
        // Run tests
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
