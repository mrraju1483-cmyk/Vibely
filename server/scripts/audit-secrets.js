// Static audit of the whole repository: hardcoded secrets, committed .env files, debug logging, missing .gitignore rules.
//   npm run audit:secrets      (exit code 1 when something needs attention)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'uploads', '.venv', '__pycache__', '.pytest_cache'])
const TEXT = /\.(js|jsx|json|py|md|html|css|yml|yaml|txt|env|example)$/i
const SECRET_PATTERNS = [
  [/mongodb(\+srv)?:\/\/[^\s'"`:@]+:[^\s'"`@]+@/i, 'MongoDB connection string with credentials'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API key (sk-...)'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\b(api[_-]?key|secret|password|token|jwt_secret)\b\s*[:=]\s*['"][A-Za-z0-9+/_\-.]{16,}['"]/i, 'hardcoded credential'],
]
const findings = []
const add = (level, file, line, msg) => findings.push({ level, where: `${path.relative(ROOT, file)}${line ? ':' + line : ''}`, msg })

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file)
  const base = path.basename(file)
  if (/^\.env(\..+)?$/.test(base) && !base.endsWith('.example')) add('high', file, 0, 'real .env file present in the project folder (must never be committed or zipped)')
  if (!TEXT.test(base) && !base.startsWith('.env')) continue
  if (base === 'audit-secrets.js' || /(^|\/)(tests?|scripts)\//.test(rel.replace(/\\/g, '/')) && /smoke-test|test_/.test(base)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((text, i) => {
    for (const [rx, label] of SECRET_PATTERNS) if (rx.test(text) && !/example|placeholder|your[-_]/i.test(text)) add('high', file, i + 1, `possible ${label}`)
    const inFrontend = rel.replace(/\\/g, '/').startsWith('src/')
    if (inFrontend && /\bconsole\.(log|debug)\(|\bdebugger\b/.test(text)) add('medium', file, i + 1, 'debug logging in frontend code')
    if (inFrontend && /(AI_SERVICE_KEY|JWT_SECRET|CLOUDINARY_API_SECRET|TURN_SECRET|AI_API_KEY)/.test(text)) add('high', file, i + 1, 'server-side secret name referenced in frontend code')
  })
}

const ignore = fs.existsSync(path.join(ROOT, '.gitignore')) ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : ''
for (const rule of ['.env', 'node_modules', 'uploads']) if (!ignore.split('\n').some((l) => l.trim().replace(/^\//, '') === rule || l.trim() === `${rule}/`)) add('high', path.join(ROOT, '.gitignore'), 0, `.gitignore is missing "${rule}"`)

const serverLogs = []
for (const file of walk(path.join(ROOT, 'server/src'))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((t, i) => { if (/console\.log\(/.test(t)) serverLogs.push(`${path.relative(ROOT, file)}:${i + 1}`) })
}
if (serverLogs.length) add('info', path.join(ROOT, 'server/src'), 0, `${serverLogs.length} console.log call(s) in server code (startup/dev messages): ${serverLogs.join(', ')}`)

const order = { high: 0, medium: 1, info: 2 }
findings.sort((a, b) => order[a.level] - order[b.level])
for (const f of findings) console.log(`[${f.level.toUpperCase()}] ${f.where}  ${f.msg}`)
const serious = findings.filter((f) => f.level !== 'info').length
console.log(serious ? `\n${serious} issue(s) need attention.` : '\nNo hardcoded secrets, committed .env files or frontend debug logs found.')
process.exit(serious ? 1 : 0)
