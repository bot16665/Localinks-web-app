const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\Azhar Shaikh.HSNCU0\\Desktop\\Desktop-web-app\\my-app';
const skipDirs = ['.next', 'node_modules', '.git', 'design-reference'];

// Files where bg-surface-container-lowest should become bg-surface-container for cards
const filesToUpdate = [
  'app\\activities\\[postId]\\page.tsx',
  'app\\business\\[id]\\page.tsx',
  'app\\business\\[id]\\promo\\page.tsx',
  'app\\business\\[id]\\edit\\page.tsx',
  'app\\chat\\[chatId]\\page.tsx',
  'app\\profile\\my-posts\\page.tsx',
];

const replacements = [
  // Cards and sections should use bg-surface-container (dark)
  [ /bg-surface-container-lowest p-gutter rounded-xl shadow-lg space-y-sm/g, 'bg-surface-container p-gutter rounded-2xl shadow-lg border border-outline-variant/30 space-y-sm' ],
  [ /bg-surface-container-lowest p-gutter rounded-xl shadow-lg flex gap-gutter items-center/g, 'bg-surface-container p-gutter rounded-2xl shadow-lg border border-outline-variant/30 flex gap-gutter items-center' ],
  [ /bg-surface-container-lowest p-gutter rounded-xl shadow-lg flex gap-4 items-center/g, 'bg-surface-container p-gutter rounded-2xl shadow-lg border border-outline-variant/30 flex gap-4 items-center' ],
  [ /bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden/g, 'bg-surface-container rounded-2xl shadow-lg border border-outline-variant/30 overflow-hidden' ],
  [ /bg-surface-container-lowest rounded-xl shadow-lg p-gutter/g, 'bg-surface-container rounded-2xl shadow-lg border border-outline-variant/30 p-gutter' ],
  [ /bg-surface-container-lowest rounded-xl p-md shadow-lg border border-outline-variant\/30/g, 'bg-surface-container rounded-2xl p-md shadow-lg border border-outline-variant/30' ],
  [ /bg-surface-container-lowest rounded-2xl p-md shadow-lg border border-outline-variant\/30 flex flex-col gap-sm/g, 'bg-surface-container rounded-2xl p-md shadow-lg border border-outline-variant/30 flex flex-col gap-sm' ],
  [ /bg-surface-container-lowest rounded-2xl p-md shadow-lg border border-outline-variant\/30 flex items-center gap-md/g, 'bg-surface-container rounded-2xl p-md shadow-lg border border-outline-variant/30 flex items-center gap-md' ],
  [ /bg-surface-container-lowest rounded-2xl p-container-margin max-w-sm w-full shadow-lg space-y-md/g, 'bg-surface-container rounded-2xl p-container-margin max-w-sm w-full shadow-lg border border-outline-variant/30 space-y-md' ],
  [ /bg-surface-container-lowest rounded-xl shadow-sm/g, 'bg-surface-container rounded-xl shadow-lg border border-outline-variant/30' ],
  [ /bg-surface-container-lowest\/80 backdrop-blur-md flex items-center justify-center shadow-sm text-on-surface hover:opacity-80 transition-opacity/g, 'bg-surface-container/80 backdrop-blur-md flex items-center justify-center shadow-md text-on-surface hover:opacity-80 transition-opacity border border-outline-variant/30' ],
  [ /bg-surface-container-lowest rounded-xl flex items-center px-4 py-2 min-h-\[48px\] focus-within:border-primary\/50 transition-colors border border-outline-variant\/30/g, 'bg-surface-container-lowest rounded-xl flex items-center px-4 py-2 min-h-[48px] focus-within:border-primary/50 transition-colors border border-outline-variant/30' ],
  [ /bg-surface-container-lowest p-container-margin max-w-sm w-full shadow-lg space-y-md/g, 'bg-surface-container p-container-margin max-w-sm w-full shadow-lg border border-outline-variant/30 space-y-md' ],
  [ /bg-surface-container-lowest p-6 shadow-card sm:max-w-xl sm:p-8/g, 'bg-surface-container p-6 shadow-lg border border-outline-variant/30 sm:max-w-xl sm:p-8' ],
  [ /bg-surface-container-lowest rounded-2xl p-container-margin max-w-sm w-full shadow-lg/g, 'bg-surface-container rounded-2xl p-container-margin max-w-sm w-full shadow-lg border border-outline-variant/30' ],
];

for (const relPath of filesToUpdate) {
  const filepath = path.join(root, relPath);
  if (!fs.existsSync(filepath)) continue;
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
