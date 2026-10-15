import { build } from 'esbuild';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fixture = name => resolve(`tests/fixtures/workspace-ui/${name}`);
const aliases = { 'next/link': fixture('link.tsx'), 'next/navigation': fixture('navigation.ts'), '@/app/app/actions': fixture('actions.ts'), '@/lib/rivora/workspace': fixture('workspace.ts'), '@/lib/locale': fixture('locale.ts') };
const output = await build({ entryPoints: ['tests/fixtures/workspace-ui/entry.tsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' }, alias: aliases });
// Render the real server page with a mock data adapter outside Next. No fixture
// route or authorization override is shipped in the product application.
const pageHtml = {};
const { renderToStaticMarkup } = require('react-dom/server');
for (const page of ['orders','products','customers','quotes','inbox']) {
  const serverPage = await build({ plugins: [{ name: 'fixture-actions', setup(builder) { builder.onResolve({ filter: /^\.\/actions$/ }, () => ({ path: fixture('actions.ts') })); } }], entryPoints: [`app/app/${page}/page.tsx`], bundle: true, write: false, format: 'cjs', jsx: 'automatic', platform: 'node', packages: 'external', define: { __FIXTURE_PAGE__: JSON.stringify(page) }, alias: { ...aliases, 'next/link': resolve('tests/fixtures/operations-ui/link.tsx') } });
  const module = {exports: {}};
  new Function('require', 'module', 'exports', serverPage.outputFiles[0].text)(require, module, module.exports);
  pageHtml[page] = renderToStaticMarkup(await module.exports.default({ searchParams: Promise.resolve({}) }));
}
const cssFiles = ['app/globals.css','app/motion.css','app/app/navigation.css','app/app/support-s5.css','app/app/field-focus.css'];
const rawCss = (await Promise.all(cssFiles.map(file => readFile(file, 'utf8')))).join('\n');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const css = (await postcss([tailwind({ base: process.cwd() })]).process(rawCss, { from: resolve('app/globals.css') })).css;
const server = http.createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end('Writes forbidden'); return; }
  if(req.url === '/bundle.js') { res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].text); }
  else if(req.url === '/style.css') { res.setHeader('Content-Type','text/css');res.end(css); }
  else if(req.url.startsWith('/api/')) { res.writeHead(501);res.end('API must be mocked by the test'); }
  else {res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0}button,input,select,textarea{font:inherit}</style><div id="root"></div><script>window.__PAGE_HTML__=${JSON.stringify(pageHtml).replace(/</g,'\\u003c')}</script><script src="/bundle.js"></script></html>`);}
});
server.listen(Number(process.env.WORKSPACE_FIXTURE_PORT || 3102),'127.0.0.1');
