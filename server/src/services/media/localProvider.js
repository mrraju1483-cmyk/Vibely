import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { env } from '../../config/env.js'

// DEVELOPMENT fallback: files live on local disk in server/uploads
export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads')

export async function upload(file, { ext }) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}` // server-generated name, never the user's
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer, { flag: 'wx' })
  return { url: `${env.publicUrl}/uploads/${name}`, key: `local:${name}` }
}

export async function remove(key) {
  const name = path.basename(key.slice('local:'.length)) // basename blocks path traversal
  await fs.unlink(path.join(UPLOAD_DIR, name)).catch(() => {})
}
