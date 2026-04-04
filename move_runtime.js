const fs = require('fs');
const path = require('path');

const files = [
  'state-machine.ts',
  'per-agent-authority.ts',
  'parallel-runner.ts',
  'types.ts',
  'constants.ts',
  'us-message-engine.ts',
  'kernels/identity.ts',
  'kernels/persistence.ts',
  'kernels/authority.ts',
  'kernels/communications.ts',
  'step-planner.ts',
  'envelope-builder.ts',
  'hash.ts',
  'db.ts'
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
    console.log(`Moved ${file} and created stub.`);
  } else {
    // maybe already moved?
    console.log(`${oldPath} not found.`);
  }
}
