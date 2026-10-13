export const MB = 1024 * 1024
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
export const MAX_BYTES = { image: 10 * MB, video: 50 * MB }

// Returns { kind } for a usable file or { error } with a friendly message
export function checkMediaFile(file) {
  const kind = file.type.startsWith('video/') ? 'video' : 'image'
  if (!MEDIA_TYPES.includes(file.type)) return { error: 'Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.' }
  if (file.size > MAX_BYTES[kind]) return { error: `${kind === 'image' ? 'Photos' : 'Videos'} must be under ${MAX_BYTES[kind] / MB} MB.` }
  return { kind }
}
export const MAX_REEL_SECONDS = 90

// Chat attachments: images, videos and PDF documents (PDF limit 20 MB)
export function checkChatFile(file) {
  if (file.type === 'application/pdf') return file.size > 20 * MB ? { error: 'Documents must be under 20 MB.' } : { kind: 'file' }
  if (!MEDIA_TYPES.includes(file.type)) return { error: 'You can send images, videos and PDF documents.' }
  return checkMediaFile(file)
}
