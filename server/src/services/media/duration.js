// Reads the duration (seconds) of an MP4/MOV file from its 'mvhd' header box. Returns null when unknown (e.g. WebM).
export const MAX_REEL_SECONDS = 90

export function getVideoDuration(buf, ext) {
  if (ext !== 'mp4' && ext !== 'mov') return null
  const i = buf.indexOf('mvhd')
  if (i < 0 || i + 32 > buf.length) return null
  const version = buf[i + 4]
  let timescale, duration
  if (version === 0) {
    timescale = buf.readUInt32BE(i + 16)
    duration = buf.readUInt32BE(i + 20)
  } else if (version === 1) {
    timescale = buf.readUInt32BE(i + 24)
    duration = Number(buf.readBigUInt64BE(i + 28))
  } else return null
  if (!timescale || !Number.isFinite(duration)) return null
  const seconds = duration / timescale
  return seconds > 0 && seconds < 86400 ? Math.round(seconds * 10) / 10 : null
}
