#!/usr/bin/env node
/**
 * P1.4 — frontend hygiene guard.
 *
 * Fails (exit 1) when apps/web/src contains:
 *   1. raw fetch( outside the request layer (lib/api*.ts) and tests
 *   2. native popups: alert(, confirm(, prompt(, window.alert/confirm/prompt
 *      (dialog.confirm/dialog.prompt from AppDialog are fine — they have a dot)
 *   3. raw error display: err?.message / error.message / e.message rendered or
 *      stored — allowed only with an inline `// hygiene-allow` comment on the
 *      same line (for logic checks, never for display)
 *   4. <button …> with no onClick, no type="submit", and no disabled attr
 *   5. silent catch: empty catch block or .catch(() => {}) with no comment
 *
 * Usage: node scripts/check-frontend-hygiene.mjs [--root apps/web/src]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : 'apps/web/src';

const ALLOW_FETCH = /lib\/api(Client)?\.tsx?$/;
const SKIP = /\.(test|spec|stories)\.[tj]sx?$/;

const violations = [];
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p);
    } else if (/\.[tj]sx?$/.test(name)) {
      files.push(p);
    }
  }
}
walk(root);

const fetchRe = /\bfetch\s*\(/g;
const popupRe = /(?:^|[^.\w$])(alert|confirm|prompt)\s*\(|window\.(alert|confirm|prompt)\s*\(/g;
const errMsgRe = /\b(?:err|error|e)\??\.message\b/g;
const silentCatchRe = /catch\s*(\([^)]*\))?\s*\{\s*\}|\.catch\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*\}\s*\)/g;

for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (SKIP.test(rel)) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  // 1. raw fetch outside the layer
  if (!ALLOW_FETCH.test(rel)) {
    lines.forEach((line, i) => {
      if (fetchRe.test(line)) {
        fetchRe.lastIndex = 0;
        violations.push(`${rel}:${i + 1}  raw fetch( outside lib/api — use api.*`);
      }
      fetchRe.lastIndex = 0;
    });
  }

  lines.forEach((line, i) => {
    // 2. native popups (dialog.* exempt via the [^.] lookbehind)
    popupRe.lastIndex = 0;
    if (popupRe.test(line)) {
      violations.push(`${rel}:${i + 1}  native popup — use AppDialog/toast`);
    }
    popupRe.lastIndex = 0;

    // 3. raw err.message — display or storage; logic needs // hygiene-allow
    errMsgRe.lastIndex = 0;
    if (!ALLOW_FETCH.test(rel) && errMsgRe.test(line) && !line.includes('hygiene-allow')) {
      violations.push(`${rel}:${i + 1}  raw err.message — use apiErrorMessage()/InlineError/toast.error`);
    }
    errMsgRe.lastIndex = 0;

    // 5. silent catch on one line
    silentCatchRe.lastIndex = 0;
    if (silentCatchRe.test(line) && !line.includes('hygiene-allow') && !line.includes('//')) {
      violations.push(`${rel}:${i + 1}  silent catch — handle or comment why`);
    }
    silentCatchRe.lastIndex = 0;
  });

  // Multi-line empty catch blocks: catch (...) {\n  } or only comments
  const catchBlockRe = /catch\s*(\([^)]*\))?\s*\{\s*\n(\s*\/\/[^\n]*)?\s*\n?\s*\}/g;
  let m;
  while ((m = catchBlockRe.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    // A catch containing an explanatory comment is documented, not silent.
    if (!m[0].includes('//')) {
      violations.push(`${rel}:${line}  silent catch block — handle or comment why`);
    }
  }

  // 4. buttons without any action affordance — brace-aware tag scan so
  //    `=>`/`>` inside {…} expressions can't truncate the match.
  {
    let idx = 0;
    while ((idx = src.indexOf('<button', idx)) !== -1) {
      let j = idx + 7, depth = 0, quote = null, end = -1;
      while (j < src.length) {
        const c = src[j];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) { end = j; break; }
        j++;
      }
      if (end === -1) break;
      const tag = src.slice(idx, end + 1);
      const line = src.slice(0, idx).split('\n').length;
      const actionable = /onClick\s*=/.test(tag) || /type\s*=\s*["']submit["']/.test(tag);
      if (!actionable && !tag.includes('...')) {
        violations.push(`${rel}:${line}  <button> with no onClick/submit — dead control?`);
      }
      idx = end + 1;
    }
  }

}

if (violations.length) {
  console.error(`frontend-hygiene: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 200)) console.error('  ' + v);
  if (violations.length > 200) console.error(`  … and ${violations.length - 200} more`);
  process.exit(1);
}
console.log(`frontend-hygiene: clean (${files.length} files scanned)`);
