import crypto from 'crypto'
import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'

// Cloudinary via its REST API (signed uploads, secret stays on the server). Not yet tested against a real account.
const sign = (params) => {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  return crypto.createHash('sha1').update(str + env.cloudinary.apiSecret).digest('hex')
}
const configured = () => {
  const c = env.cloudinary
  if (!c.cloudName || !c.apiKey || !c.apiSecret) throw new ApiError(500, 'Media storage is not configured')
  return c
}

export async function upload(file, { mediaType }) {
  const c = configured()
  const timestamp = Math.floor(Date.now() / 1000)
  const resource = mediaType === 'file' ? 'raw' : mediaType // PDFs are 'raw' uploads
  const params = { folder: 'vibely', timestamp }
  const form = new FormData()
  form.append('file', new Blob([file.buffer]), 'upload')
  form.append('api_key', c.apiKey)
  form.append('timestamp', String(timestamp))
  form.append('folder', 'vibely')
  form.append('signature', sign(params))
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/${resource}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new ApiError(502, 'Media upload failed. Please try again.')
  const data = await res.json()
  return { url: data.secure_url, key: `cld:${resource}:${data.public_id}` }
}

export async function remove(key) {
  const c = configured()
  const [, resource, ...rest] = key.split(':')
  const publicId = rest.join(':')
  const timestamp = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: c.apiKey, signature: sign({ public_id: publicId, timestamp }) })
  await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/${resource}/destroy`, { method: 'POST', body }).catch(() => {})
}
