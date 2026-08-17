const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\Azhar Shaikh.HSNCU0\\Desktop\\Desktop-web-app\\my-app';
const skipDirs = ['.next', 'node_modules', '.git', 'design-reference'];

const replacements = [
  [ /bg-surface-container(?!est)/g, 'bg-surface-container' ],
  [ /shadow-\[0px_4px_20px_rgba\(0,0,0,0\.04\)\]/g, 'shadow-lg' ],
  [ /text-on-surface/g, 'text-on-surface' ],
  [ /bg-surface-container-lowest(?![\/;])/g, 'bg-surface-container-lowest' ],
  [ /rounded-2xl p-md shadow-lg border border-outline-variant/30/g, 'rounded-2xl p-md shadow-lg border border-outline-variant/30' ],
  [ /rounded-xl shadow-\[0px_4px_20px_rgba\(0,0,0,0\.06\)\]/g, 'rounded-2xl shadow-lg border border-outline-variant/30' ],
];

function walkDir(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!skipDirs.includes(item)) {
        files = files.concat(walkDir(fullPath));
      }
    } else if (item.match(/\.(tsx|ts|jsx|js|css)$/)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walkDir(root);
for (const filepath of files) {
  try {
    let content = fs.readFileSync(filepath, 'utf-8');
    let original = content;
    for (const [pattern, replacement] of replacements) {
      content = content.replace(pattern, replacement);
    }
    if (content !== original) {
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log('Updated:', filepath);
    }
  } catch (e) {
    console.error('Error:', filepath, e.message);
  }
}
