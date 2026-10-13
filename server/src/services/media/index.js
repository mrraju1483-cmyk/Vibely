import { env } from '../../config/env.js'
import * as local from './localProvider.js'
import * as cloudinary from './cloudinaryProvider.js'

// Single entry point for media. Add a provider here (S3, etc.) without touching the rest of the app.
const providers = { local, cloudinary }
const byName = (name) => providers[name] || local

export const uploadMedia = (file, info) => byName(env.mediaProvider).upload(file, info)
export const deleteMedia = (key) => {
  if (!key) return Promise.resolve()
  return (key.startsWith('cld:') ? cloudinary : local).remove(key)
}
