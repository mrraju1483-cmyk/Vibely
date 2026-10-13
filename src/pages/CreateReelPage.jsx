import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createReelApi } from '../api/reelApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'
import { checkMediaFile, MAX_BYTES, MAX_REEL_SECONDS, MB } from '../utils/media.js'

export default function CreateReelPage() {
  const nav = useNavigate()
  const input = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [duration, setDuration] = useState(null)
  const [form, setForm] = useState({ caption: '', hashtags: '', location: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [progress, setProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // Read the video's length in the browser so we can warn before uploading (the server checks again)
  useEffect(() => {
    if (!preview) return
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      if (!Number.isFinite(v.duration)) return
      setDuration(Math.round(v.duration * 10) / 10)
      if (v.duration > MAX_REEL_SECONDS) setErrors({ media: `Reels can be at most ${MAX_REEL_SECONDS} seconds. This video is ${Math.round(v.duration)}s.` })
    }
    v.src = preview
    return () => { v.onloadedmetadata = null; v.removeAttribute('src') }
  }, [preview])

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const check = checkMediaFile(f)
    if (check.error) return setErrors({ media: check.error })
    if (check.kind !== 'video') return setErrors({ media: 'Reels must be videos (MP4, MOV or WebM).' })
    setErrors({}); setDuration(null); setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    setServerError('')
    const er = {}
    if (!file) er.media = 'Choose a video first.'
    else if (duration && duration > MAX_REEL_SECONDS) er.media = `Reels can be at most ${MAX_REEL_SECONDS} seconds.`
    if (form.caption.length > 500) er.caption = 'Caption must be 500 characters or fewer.'
    if (form.location.length > 100) er.location = 'Location must be 100 characters or fewer.'
    setErrors(er)
    if (Object.keys(er).length) return
    const fd = new FormData()
    fd.append('media', file)
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    if (duration) fd.append('duration', String(duration))
    setSubmitting(true); setProgress(0)
    try {
      await createReelApi(fd, setProgress)
      nav('/reels')
    } catch (err) {
      setErrors(getFieldErrors(err)); setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-bold">New Reel</h1><Link to="/reels" className="text-sm text-brand-600">Cancel</Link></div>
      <form className="card space-y-4 p-4" onSubmit={submit} noValidate>
        {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />
        {preview ? (
          <div className="mx-auto aspect-[9/16] max-h-[60vh] overflow-hidden rounded-xl bg-black"><video src={preview} controls playsInline className="h-full w-full object-contain" /></div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
            <span aria-hidden="true" className="text-2xl">🎬</span>Choose a short video
          </div>
        )}
        {errors.media && <p role="alert" className="text-xs text-red-500">{errors.media}</p>}
        <button type="button" className="btn-ghost w-full" onClick={() => input.current.click()}>{file ? 'Change video' : 'Choose video'}</button>
        <p className="text-xs text-slate-500">MP4, MOV or WebM, up to {MAX_BYTES.video / MB} MB and {MAX_REEL_SECONDS} seconds.{duration ? ` Selected: ${duration}s.` : ''}</p>

        <div>
          <label htmlFor="reel-caption" className="mb-1 block text-sm font-medium">Caption</label>
          <textarea id="reel-caption" rows="3" className="field" value={form.caption} onChange={set('caption')} />
          <p className={`mt-1 text-xs ${form.caption.length > 500 ? 'text-red-500' : 'text-slate-500'}`}>{form.caption.length}/500 {errors.caption}</p>
        </div>
        <div>
          <label htmlFor="reel-tags" className="mb-1 block text-sm font-medium">Hashtags</label>
          <input id="reel-tags" className="field" placeholder="#dance #vibes" value={form.hashtags} onChange={set('hashtags')} />
        </div>
        <div>
          <label htmlFor="reel-loc" className="mb-1 block text-sm font-medium">Location (optional)</label>
          <input id="reel-loc" className="field" value={form.location} onChange={set('location')} />
          {errors.location && <p role="alert" className="mt-1 text-xs text-red-500">{errors.location}</p>}
        </div>
        {submitting && <div role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress" className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-gradient-to-r from-brand-600 to-pink-500 transition-all" style={{ width: `${progress}%` }} /></div>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? `Uploading ${progress}%` : 'Share reel'}</button>
      </form>
    </div>
  )
}
