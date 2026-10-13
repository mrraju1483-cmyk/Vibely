import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createStoryApi } from '../api/storyApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'
import { checkMediaFile } from '../utils/media.js'

export default function CreateStoryModal({ onClose, onCreated }) {
  const { currentUser } = useAuth()
  const photoInput = useRef(null)
  const videoInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState(currentUser?.storyVisibility || 'public')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [progress, setProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const check = checkMediaFile(f)
    if (check.error) return setErrors({ media: check.error })
    setErrors({}); setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    setServerError('')
    if (!file) return setErrors({ media: 'Add a photo or video first.' })
    if (caption.length > 200) return setErrors({ caption: 'Caption must be 200 characters or fewer.' })
    const fd = new FormData()
    fd.append('media', file); fd.append('caption', caption); fd.append('visibility', visibility)
    setSubmitting(true); setProgress(0)
    try {
      await createStoryApi(fd, setProgress)
      await onCreated()
    } catch (err) {
      setErrors(getFieldErrors(err)); setServerError(getErrorMessage(err)); setSubmitting(false)
    }
  }

  const isVideo = file?.type.startsWith('video/')
  return (
    <Modal title="New story" onClose={submitting ? () => {} : onClose}>
      <form onSubmit={submit} noValidate className="space-y-3">
        {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />
        <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pick} tabIndex={-1} aria-hidden="true" />
        {preview ? (
          <div className="overflow-hidden rounded-xl bg-black">
            {isVideo ? <video src={preview} controls playsInline className="max-h-[45vh] w-full" /> : <img src={preview} alt="Story preview" className="max-h-[45vh] w-full object-contain" />}
          </div>
        ) : <div className="flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">Your preview appears here</div>}
        {errors.media && <p role="alert" className="text-xs text-red-500">{errors.media}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => photoInput.current.click()}>Add Photo</button>
          <button type="button" className="btn-ghost flex-1" onClick={() => videoInput.current.click()}>Add Video</button>
        </div>
        <div>
          <label htmlFor="story-caption" className="mb-1 block text-sm font-medium">Caption (optional)</label>
          <input id="story-caption" className="field" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
          {errors.caption && <p role="alert" className="mt-1 text-xs text-red-500">{errors.caption}</p>}
        </div>
        <div>
          <label htmlFor="story-vis" className="mb-1 block text-sm font-medium">Who can see this</label>
          <select id="story-vis" className="field" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Everyone who can view my profile</option>
            <option value="followers">Followers only</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">Stories disappear after 24 hours.</p>
        {submitting && <div role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress" className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-gradient-to-r from-brand-600 to-pink-500" style={{ width: `${progress}%` }} /></div>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? `Uploading ${progress}%` : 'Share story'}</button>
      </form>
    </Modal>
  )
}
