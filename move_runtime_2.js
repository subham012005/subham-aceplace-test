const fs = require('fs');
const path = require('path');

const files = [
  'acelogic-guard.ts',
  'batch-execution-guard.ts',
  'execution-guard-cache.ts',
  'lease-heartbeat.ts',
  'ace-handoff.ts',
  'decomposition.ts',
  'recover-dead-steps.ts',
  'telemetry/emitRuntimeMetric.ts'  // Just this file or the whole folder? Let's just do files.
];

for (const file of files) {
  const oldPath = path.join('src/lib/runtime', file);
  const newPath = path.join('packages/runtime-core/src', file);
  
  if (fs.existsSync(oldPath)) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    
    // Create new file from old
    let content = fs.readFileSync(oldPath, 'utf8');
    fs.writeFileSync(newPath, content);
    
    // Create re-export stub
    const depth = file.split('/').length; 
    let upStr = '../../../';
    if (depth === 2) {
      upStr = '../../../../';
    }
    const relativeTargetStr = `${upStr}packages/runtime-core/src/${file.replace('.ts', '')}`;
    
    const reexportStr = `export * from "${relativeTargetStr}";\n`;
    fs.writeFileSync(oldPath, reexportStr);
    console.log(`Moved ${file} and created stub (relative: ${relativeTargetStr}).`);
  } else {
    console.log(`${oldPath} not found.`);
  }
}
