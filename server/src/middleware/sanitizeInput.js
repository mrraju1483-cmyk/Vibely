// Removes keys that could be used for MongoDB operator injection ("$ne", "$gt", ...) or prototype pollution
// from req.body, req.query and req.params. Validators then see a plain value (or nothing) and reject it.
const dangerous = (k) => k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype'

function strip(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 10) return
  for (const key of Object.keys(value)) {
    if (dangerous(key)) delete value[key]
    else strip(value[key], depth + 1)
  }
}

export function sanitizeInput(req, res, next) {
  strip(req.body); strip(req.query); strip(req.params)
  next()
}

// API answers are per-user: never let a browser or proxy cache them
export function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store')
  next()
}
