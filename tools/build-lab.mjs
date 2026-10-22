// Builds the public, view-only copy of the M31 star simulator into ../lab/.
// Source: the simulator's flattened working copy in the private M31 project
// (PROTOTYPE/.star-sim, produced by M31's publish_star.py). Only what the browser
// needs is shipped, minified and stripped of every comment; tests, the references
// page and the source files themselves stay private.
//
//   node tools/build-lab.mjs [path/to/.star-sim]
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { minify } from 'terser';
import { minify as minifyHtml } from 'html-minifier-terser';
import { parse } from 'acorn';

// ---- GLSL shaders live inside JS strings, so their comments survive the JS minifier: strip them here.
const GLSL = /(void\s+main|gl_FragColor|gl_Position|precision\s+(high|medium|low)p|uniform\s+\w+|varying\s+\w+|vec[234]\s*\()/;
// walks text pieces of a string/template; returns pieces with // and /* */ comments removed.
// a comment that runs into a ${…} swallows that expression too (it was part of the comment).
function stripPieces(pieces) {
  let mode = 0; // 0 code, 1 line comment, 2 block comment
  const out = [];
  for (const p of pieces) {
    if (p.expr != null) { if (mode === 0) out.push(p); continue; }
    let s = p.text, r = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      const nl = c === '\n' ? 1 : (c === '\\' && n === 'n' ? 2 : 0);   // real newline, or a "\n" escape in raw source
      if (mode === 1) { if (nl) { r += nl === 1 ? '\n' : '\\n'; i += nl - 1; mode = 0; } continue; }
      if (mode === 2) { if (c === '*' && n === '/') { i++; mode = 0; } continue; }
      if (c === '/' && n === '/') { mode = 1; i++; continue; }
      if (c === '/' && n === '*') { mode = 2; i++; continue; }
      r += c;
    }
    out.push({ text: r });
  }
  return out;
}
function stripGlsl(code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
  const edits = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'TemplateLiteral') {
      const whole = n.quasis.map(q => q.value.raw).join('');
      if (GLSL.test(whole)) {
        const pieces = [];
        n.quasis.forEach((q, i) => { pieces.push({ text: q.value.raw }); if (i < n.expressions.length) pieces.push({ expr: code.slice(n.expressions[i].start, n.expressions[i].end) }); });
        const res = stripPieces(pieces), parts = [];
        for (const p of res) {
          if (p.expr != null) { if (parts.length % 2 === 0) parts.push(''); parts.push(p.expr); }
          else { if (parts.length % 2 === 1) parts[parts.length - 1] += p.text; else parts.push(p.text); }
        }
        let s = '`';
        parts.forEach((x, i) => { s += i % 2 ? '${' + x + '}' : x; });
        if (parts.length % 2 === 0) s += '';
        edits.push([n.start, n.end, s + '`']);
        return; // expressions inside are kept verbatim
      }
    }
    if (n.type === 'Literal' && typeof n.value === 'string' && GLSL.test(n.value)) {
      edits.push([n.start, n.end, JSON.stringify(stripPieces([{ text: n.value }])[0].text)]);
      return;
    }
    for (const k in n) { const v = n[k]; if (k === 'type' || k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
  })(ast);
  edits.sort((a, b) => b[0] - a[0]);
  for (const [s, e, r] of edits) code = code.slice(0, s) + r + code.slice(e);
  return { code, n: edits.length };
}

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.argv[2] || join(here, '../../_M31/PROTOTYPE/.star-sim'));
const OUT = resolve(here, '../lab');
if (!existsSync(join(SRC, 'index.html'))) { console.error('no simulator at', SRC); process.exit(1); }
// what to ship: every local <script src> of the page, plus worker scripts they start (new Worker / importScripts), recursively
const JS = [];
const addJs = f => { f = f.replace(/^\.\//, ''); if (!JS.includes(f) && existsSync(join(SRC, f))) { JS.push(f);
  const s = readFileSync(join(SRC, f), 'utf8');
  for (const m of s.matchAll(/(?:new\s+Worker|importScripts)\s*\([^)]*?['"]([\w.\/-]+\.js)['"]/g)) addJs(m[1]); } };
for (const m of readFileSync(join(SRC, 'index.html'), 'utf8').matchAll(/<script[^>]+src="([^"?:]+\.js)/g)) addJs(m[1]);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const hash = createHash('sha1');
let inBytes = 0, outBytes = 0;
for (const f of JS) {
  const raw = readFileSync(join(SRC, f), 'utf8');
  const g = stripGlsl(raw), code = g.code;
  const r = await minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: false }, ecma: 2020 });
  writeFileSync(join(OUT, f), r.code);
  hash.update(r.code); inBytes += raw.length; if (g.n) console.log(`  ${f}: ${g.n} shader strings cleaned`); outBytes += r.code.length;
}
const v = hash.digest('hex').slice(0, 10);

let html = readFileSync(join(SRC, 'index.html'), 'utf8');
html = html.replace(/\?v=[0-9a-f]+/g, '?v=' + v);
// the references page stays private: drop the link to it
html = html.replace(/<a[^>]*href="refs\.html"[^>]*>[\s\S]*?<\/a>/g, '');
html = await minifyHtml(html, { collapseWhitespace: true, conservativeCollapse: true, removeComments: true, minifyCSS: true, minifyJS: { format: { comments: false } } });
writeFileSync(join(OUT, 'index.html'), html);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`lab built: ${JS.length} scripts (${JS.join(', ')}), ${(inBytes / 1024) | 0} KB -> ${(outBytes / 1024) | 0} KB, v=${v}`);
