// Static consistency audit (no server, no database, no network needed):  npm run audit:project
//  1. every frontend API call has a matching backend route
//  2. every in-app link / navigate() target has a matching frontend route
//  3. every environment variable the code reads is documented in a .env.example
//  4. every imported package is listed in package.json
// Exit code 1 when something needs attention.
import fs from 'fs'
import path from 'path'
import { builtinModules } from 'module'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SKIP = new Set(['node_modules', '.git', 'dist', 'uploads', '.venv', '__pycache__'])
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
function* walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const rel = path.posix.join(dir, e.name)
    if (e.isDirectory()) yield* walk(rel)
    else yield rel
  }
}
const files = (dir, re) => [...walk(dir)].filter((f) => re.test(f))
const problems = [], notes = []
const bad = (msg) => problems.push(msg)

const norm = (p) => '/' + p.split(/[?#]/)[0].replace(/\$\{[^}]*\}/g, ':p').replace(/:[A-Za-z_]+/g, ':p').split('/').filter(Boolean).join('/')
const same = (a, b) => {
  const x = a.split('/'), y = b.split('/')
  return x.length === y.length && x.every((s, i) => s === y[i] || s === ':p' || y[i] === ':p')
}

// ---- 1. frontend API calls vs backend routes
const app = read('server/src/app.js')
const routeFiles = Object.fromEntries([...app.matchAll(/import (\w+) from '\.\/routes\/(\w+)\.js'/g)].map((m) => [m[1], m[2]]))
const backend = []
for (const line of app.split('\n')) {
  const m = line.match(/app\.use\('(\/api\/[^']*)'.*?(\w+Routes)\)/)
  if (!m || !routeFiles[m[2]]) continue
  const src = read(`server/src/routes/${routeFiles[m[2]]}.js`)
  for (const r of src.matchAll(/\br\.(get|post|put|delete|patch)\(\s*'([^']*)'/g)) backend.push({ method: r[1], path: norm(m[1] + (r[2] === '/' ? '' : r[2])) })
}
for (const m of app.matchAll(/app\.(get|post)\('(\/api\/[^']*)'/g)) backend.push({ method: m[1], path: norm(m[2]) })

const calls = []
for (const f of files('src', /\.(js|jsx)$/)) {
  for (const m of read(f).matchAll(/\bapi\.(get|post|put|delete|patch)\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) calls.push({ f, method: m[1], path: norm('/api' + m[2].slice(1, -1)) })
}
for (const c of calls) if (!backend.some((b) => b.method === c.method && same(b.path, c.path))) bad(`API: ${c.f} calls ${c.method.toUpperCase()} ${c.path} but no backend route matches`)
notes.push(`API: ${calls.length} frontend calls checked against ${backend.length} backend routes`)

// ---- 2. links vs frontend routes
const appJsx = read('src/App.jsx')
const pages = new Set(['/'])
let inAdmin = false
for (const line of appJsx.split('\n')) {
  if (line.includes('<Route path="/admin"')) inAdmin = true
  const m = line.match(/<Route (?:index|path="([^"]*)")/)
  if (!m) continue
  if (/<Route index/.test(line)) { if (inAdmin) pages.add('/admin'); continue }
  if (m[1] === '*') continue
  pages.add(norm(inAdmin && !m[1].startsWith('/') ? `/admin/${m[1]}` : m[1]))
}
let links = 0
for (const f of files('src', /\.jsx?$/)) {
  const src = read(f)
  const found = [
    ...src.matchAll(/\bto=(?:"(\/[^"]*)"|\{`(\/[^`]*)`\}|\{'(\/[^']*)'\})/g),
    ...src.matchAll(/\b(?:navigate|nav)\(\s*(?:'(\/[^']*)'|`(\/[^`]*)`)/g),
    ...src.matchAll(/\[\s*'(\/[a-z][a-z/-]*)'\s*,\s*(?:'[^']*'|\{)/g),
  ]
  for (const m of found) {
    const target = m.slice(1).find(Boolean)
    links++
    if (![...pages].some((p) => same(p, norm(target)))) bad(`LINK: ${f} points to ${target} but no frontend route matches`)
  }
}
notes.push(`LINKS: ${links} link/navigate targets checked against ${pages.size} routes`)

// ---- 3. environment variables vs .env.example
const names = (text) => new Set([...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]))
const compare = (label, used, exampleFile, ignore = []) => {
  const doc = names(read(exampleFile))
  for (const n of used) if (!doc.has(n) && !ignore.includes(n)) bad(`ENV: ${label} reads ${n} but ${exampleFile} does not list it`)
  notes.push(`ENV: ${label}: ${used.size} variables checked against ${exampleFile}`)
}
const usedIn = (dir, re, group = 1) => {
  const set = new Set()
  for (const f of files(dir, /\.(js|jsx|py)$/)) for (const m of read(f).matchAll(re)) set.add(m[group])
  return set
}
const serverUsed = usedIn('server/src', /process\.env\.([A-Z][A-Z0-9_]*)/g)
for (const k of ['MONGODB_URI', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) serverUsed.add(k)
compare('server', serverUsed, 'server/.env.example')
compare('frontend', usedIn('src', /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g), '.env.example')
compare('ai-service', usedIn('ai-service/app', /getenv\("([A-Z][A-Z0-9_]*)"/g), 'ai-service/.env.example')

// ---- 4. imported packages vs package.json
const pkgName = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0])
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
function deps(label, dir, pkgFile, re) {
  const pkg = JSON.parse(read(pkgFile))
  const have = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})])
  const used = new Set()
  for (const f of files(dir, re)) for (const m of read(f).matchAll(/^\s*(?:import|export)\s[^;'"\n]*?\bfrom\s*'([^'./][^']*)'|^\s*import\s+'([^'./][^']*)'/gm)) { const name = m[1] || m[2]; if (!builtins.has(name) && !builtins.has(pkgName(name))) used.add(pkgName(name)) }
  for (const u of used) if (!have.has(u)) bad(`DEPS: ${label} imports "${u}" but ${pkgFile} does not list it`)
  const unused = [...Object.keys(pkg.dependencies || {})].filter((d) => !used.has(d))
  if (unused.length) notes.push(`DEPS: ${label}: listed but not imported in code (may be used by tooling): ${unused.join(', ')}`)
  notes.push(`DEPS: ${label}: ${used.size} imported packages checked`)
}
deps('server', 'server/src', 'server/package.json', /\.js$/)
deps('server scripts', 'server/scripts', 'server/package.json', /\.js$/)
deps('frontend', 'src', 'package.json', /\.jsx?$/)

for (const n of notes) console.log(`[ok]   ${n}`)
for (const p of problems) console.log(`[FAIL] ${p}`)
console.log(problems.length ? `\n${problems.length} problem(s) found.` : '\nNo consistency problems found.')
process.exit(problems.length ? 1 : 0)
