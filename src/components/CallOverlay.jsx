import { useEffect, useRef } from 'react'
import Avatar from './Avatar.jsx'
import { useCall } from '../context/CallContext.jsx'
import { formatDuration } from '../utils/time.js'

const round = 'flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40'

function Stream({ stream, muted, className, label }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} aria-label={label} className={className} />
}

// Mounted once in the app layout: incoming-call screen, active-call screen, and friendly error/ended states
export default function CallOverlay() {
  const { call, localStream, remoteStream, remoteVideo, muted, cameraOff, seconds, hasCamera, accept, decline, hangUp, toggleMute, toggleCamera, dismiss } = useCall()
  const acceptBtn = useRef(null)
  const ringing = call?.phase === 'ringing'

  useEffect(() => {
    if (!ringing) return
    acceptBtn.current?.focus()
    navigator.vibrate?.([300, 200, 300, 200, 300]) // no ringtone file: phones vibrate instead
  }, [ringing])

  if (!call) return null
  const { peer, type, phase } = call
  const label = type === 'video' ? 'video' : 'voice'

  if (phase === 'ringing') {
    return (
      <div role="alertdialog" aria-modal="true" aria-label={`Incoming ${label} call from ${peer.fullName}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
        <div className="card flex w-full max-w-xs flex-col items-center gap-3 p-6 text-center">
          <Avatar name={peer.fullName} src={peer.profilePhoto} size="h-24 w-24" />
          <p className="text-lg font-bold">{peer.fullName}</p>
          <p className="text-sm text-slate-500" aria-live="assertive">Incoming {label} call...</p>
          <div className="mt-2 flex gap-6">
            <button type="button" className={`${round} bg-red-600`} aria-label="Decline call" onClick={decline}>✖</button>
            <button type="button" ref={acceptBtn} className={`${round} bg-green-600`} aria-label="Accept call" onClick={accept}>{type === 'video' ? '🎥' : '📞'}</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error' || phase === 'ended') {
    return (
      <div role="alertdialog" aria-modal="true" aria-label="Call status" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
        <div className="card w-full max-w-xs space-y-3 p-6 text-center">
          <Avatar name={peer.fullName} src={peer.profilePhoto} size="h-16 w-16" />
          <p className="font-semibold">{peer.fullName}</p>
          <p role={phase === 'error' ? 'alert' : 'status'} className={`text-sm ${phase === 'error' ? 'text-red-500' : 'text-slate-500'}`}>{phase === 'error' ? call.error : call.endMessage}</p>
          <button type="button" className="btn-primary w-full" onClick={dismiss}>Close</button>
        </div>
      </div>
    )
  }

  const status = phase === 'preparing' ? 'Starting...' : phase === 'calling' ? 'Ringing...' : phase === 'connecting' ? 'Connecting...' : formatDuration(seconds)
  const showRemoteVideo = type === 'video' && remoteVideo
  return (
    <div role="dialog" aria-modal="true" aria-label={`${label} call with ${peer.fullName}`} className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white">
      <Stream stream={remoteStream} label={`${peer.fullName}'s video`} className={showRemoteVideo ? 'absolute inset-0 h-full w-full object-cover' : 'sr-only'} />

      {!showRemoteVideo && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Avatar name={peer.fullName} src={peer.profilePhoto} size="h-28 w-28" />
          <p className="text-xl font-bold">{peer.fullName}</p>
        </div>
      )}

      <div className={`${showRemoteVideo ? 'relative' : ''} absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 text-center`}>
        {showRemoteVideo && <p className="font-semibold">{peer.fullName}</p>}
        <p className="text-sm opacity-80" role="status" aria-live="polite">{status}</p>
        {call.notice && <p className="mx-auto mt-2 max-w-sm rounded-lg bg-amber-500/90 px-3 py-1 text-xs text-black">{call.notice}</p>}
      </div>

      {hasCamera && !cameraOff && (
        <Stream stream={localStream} muted label="Your camera" className="absolute right-3 top-20 z-10 h-36 w-24 rounded-xl border border-white/30 bg-black object-cover sm:h-44 sm:w-32" />
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-5 bg-gradient-to-t from-black/70 to-transparent p-6 pb-8">
        <button type="button" className={`${round} ${muted ? 'bg-white text-black' : 'bg-white/20'}`} aria-pressed={muted} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={toggleMute} disabled={!localStream}>{muted ? '🔇' : '🎤'}</button>
        {type === 'video' && (
          <button type="button" className={`${round} ${cameraOff ? 'bg-white text-black' : 'bg-white/20'}`} aria-pressed={cameraOff} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} onClick={toggleCamera} disabled={!hasCamera}>{cameraOff ? '🚫' : '📷'}</button>
        )}
        <button type="button" className={`${round} bg-red-600`} aria-label={phase === 'calling' || phase === 'preparing' ? 'Cancel call' : 'End call'} onClick={() => hangUp()}>📞</button>
      </div>
    </div>
  )
}
