import { ApiError } from '../../utils/ApiError.js'

const MB = 1024 * 1024
export const LIMITS = { image: 10 * MB, video: 50 * MB }
const IMAGE_BRANDS = ['heic', 'heix', 'mif1', 'avif', 'avis', 'msf1'] // ftyp brands that are images, not video

// Detect the real file type from its first bytes. The browser-supplied mimetype is NOT trusted.
function sniff(b) {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mediaType: 'image', ext: 'jpg' }
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mediaType: 'image', ext: 'png' }
  if (b.toString('ascii', 0, 4) === 'GIF8') return { mediaType: 'image', ext: 'gif' }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { mediaType: 'image', ext: 'webp' }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mediaType: 'video', ext: 'webm' }
  if (b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12)
    if (IMAGE_BRANDS.includes(brand)) return null
    return { mediaType: 'video', ext: brand === 'qt  ' ? 'mov' : 'mp4' }
  }
  return null
}

export function validateUpload(file) {
  const fail = (m) => { throw new ApiError(400, 'Validation failed', { errors: { media: m } }) }
  if (!file?.buffer) fail('Choose a photo or video')
  const info = sniff(file.buffer)
  if (!info) fail('Unsupported file. Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.')
  if (file.size > LIMITS[info.mediaType]) fail(`${info.mediaType === 'image' ? 'Photos' : 'Videos'} must be under ${LIMITS[info.mediaType] / MB} MB`)
  return info
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', webm: 'video/webm', mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf' }
export const FILE_LIMIT = 20 * MB

// Chat attachments: images, videos and PDF documents. Type comes from the file's bytes, never from the browser.
export function validateChatAttachment(file) {
  const fail = (m) => { throw new ApiError(400, 'Validation failed', { errors: { media: m } }) }
  if (!file?.buffer) fail('No file received')
  let info = sniff(file.buffer)
  if (!info && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') info = { mediaType: 'file', ext: 'pdf' }
  if (!info) fail('Unsupported file. You can send images, videos and PDF documents.')
  const limit = info.mediaType === 'file' ? FILE_LIMIT : LIMITS[info.mediaType]
  if (file.size > limit) fail(`That file is too large (max ${limit / MB} MB)`)
  return { ...info, mime: MIME[info.ext] }
}
