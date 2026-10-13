import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPostApi } from '../api/postApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

const MB = 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
const MAX = { image: 10 * MB, video: 50 * MB }

export default function CreatePostPage() {
  const nav = useNavigate()
  const photoInput = useRef(null)
  const videoInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [form, setForm] = useState({ caption: '', hashtags: '', location: '', visibility: 'public' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [progress, setProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview]) // free the preview when it changes

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const kind = f.type.startsWith('video/') ? 'video' : 'image'
    if (!TYPES.includes(f.type)) return setErrors({ media: 'Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.' })
    if (f.size > MAX[kind]) return setErrors({ media: `${kind === 'image' ? 'Photos' : 'Videos'} must be under ${MAX[kind] / MB} MB.` })
    setErrors({}); setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    setServerError('')
    const er = {}
    if (!file) er.media = 'Add a photo or video first.'
    if (form.caption.length > 2200) er.caption = 'Caption must be 2200 characters or fewer.'
    if (form.location.length > 100) er.location = 'Location must be 100 characters or fewer.'
    setErrors(er)
    if (Object.keys(er).length) return
    const fd = new FormData()
    fd.append('media', file)
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    setSubmitting(true); setProgress(0)
    try {
      await createPostApi(fd, setProgress)
      nav('/home')
    } catch (err) {
      setErrors(getFieldErrors(err)); setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const isVideo = file?.type.startsWith('video/')
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Create Post</h1>
      <form className="card space-y-4 p-4" onSubmit={submit} noValidate>
        {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{serverError}</p>}

        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />
        <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />

        {preview ? (
          <div className="overflow-hidden rounded-xl bg-black">
            {isVideo ? <video src={preview} controls playsInline className="max-h-[60vh] w-full" /> : <img src={preview} alt="Preview of your post" className="max-h-[60vh] w-full object-contain" />}
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
            <span aria-hidden="true" className="text-2xl">🖼️</span>Your preview appears here
          </div>
        )}
        {errors.media && <p role="alert" className="text-xs text-red-500">{errors.media}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => photoInput.current.click()}>{file && !isVideo ? 'Change Photo' : 'Add Photo'}</button>
          <button type="button" className="btn-ghost flex-1" onClick={() => videoInput.current.click()}>{isVideo ? 'Change Video' : 'Add Video'}</button>
        </div>

        <div>
          <label htmlFor="caption" className="mb-1 block text-sm font-medium">Caption</label>
          <textarea id="caption" rows="3" className="field" value={form.caption} onChange={set('caption')} aria-invalid={!!errors.caption} />
          <p className={`mt-1 text-xs ${form.caption.length > 2200 ? 'text-red-500' : 'text-slate-500'}`}>{form.caption.length}/2200 {errors.caption}</p>
        </div>
        <div>
          <label htmlFor="tags" className="mb-1 block text-sm font-medium">Hashtags</label>
          <input id="tags" className="field" placeholder="#vibes #travel" value={form.hashtags} onChange={set('hashtags')} />
          <p className="mt-1 text-xs text-slate-500">Hashtags in your caption are picked up too.</p>
        </div>
        <div>
          <label htmlFor="loc" className="mb-1 block text-sm font-medium">Location</label>
          <input id="loc" className="field" value={form.location} onChange={set('location')} />
          {errors.location && <p role="alert" className="mt-1 text-xs text-red-500">{errors.location}</p>}
        </div>
        <div>
          <label htmlFor="vis" className="mb-1 block text-sm font-medium">Who can see this</label>
          <select id="vis" className="field" value={form.visibility} onChange={set('visibility')}>
            <option value="public">Everyone</option>
            <option value="followers">Followers only</option>
            <option value="private">Only me</option>
          </select>
        </div>

        {submitting && (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress" className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-gradient-to-r from-brand-600 to-pink-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? `Uploading ${progress}%` : 'Create Post'}</button>
      </form>
    </div>
  )
}
