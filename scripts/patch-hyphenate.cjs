const fs = require('fs');
const path = require('path');

function patchHyphenate() {
  const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) return;

  function scan(dir, depth = 0) {
    if (depth > 6) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '@react-pdf') {
            const hyphenatePkg = path.join(fullPath, 'hyphenate', 'package.json');
            if (fs.existsSync(hyphenatePkg)) {
              try {
                const content = JSON.parse(fs.readFileSync(hyphenatePkg, 'utf8'));
                if (content.exports && content.exports['./*'] && !content.exports['./*'].default) {
                  content.exports['./*'].default = './lib/*.js';
                  fs.writeFileSync(hyphenatePkg, JSON.stringify(content, null, 2));
                  console.log(`[patch-hyphenate] Successfully patched ${hyphenatePkg}`);
                }
              } catch (e) {
                console.warn(`[patch-hyphenate] Could not patch: ${e.message}`);
              }
            }
          }
          scan(fullPath, depth + 1);
        }
      }
    } catch {
      // directory read error ignored
    }
  }

  scan(pnpmDir);
}

patchHyphenate();
