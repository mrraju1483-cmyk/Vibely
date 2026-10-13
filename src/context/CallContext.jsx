import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useChat } from './ChatContext.jsx'
import { callConfigApi } from '../api/callApi.js'
import { formatDuration } from '../utils/time.js'

const CallContext = createContext(null)
const FALLBACK_ICE = [{ urls: 'stun:stun.l.google.com:19302' }]

const mediaError = (e) => new Error(
  e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'Microphone access is blocked. Allow it in your browser settings to make calls.'
    : e?.name === 'NotFoundError' ? 'No microphone was found on this device.'
    : 'Could not start your microphone.')

// Asks for mic (+ camera for video calls). A missing camera falls back to audio only; a missing mic cancels the call.
async function getMedia(type) {
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    throw new Error('Calls are not supported here. Use a modern browser, on HTTPS or localhost.')
  }
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' }), notice: '' }
  } catch (e) {
    if (type !== 'video') throw mediaError(e)
    try { return { stream: await navigator.mediaDevices.getUserMedia({ audio: true }), notice: 'Camera unavailable. Continuing with audio only.' } } catch (e2) { throw mediaError(e2) }
  }
}

const isLive = (c) => c && c.phase !== 'ended' && c.phase !== 'error'

// One call at a time. Signaling goes over the shared Socket.IO connection; audio/video flows peer-to-peer (WebRTC).
export function CallProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { socket } = useChat()
  const [call, setCall] = useState(null) // { id, type, direction, peer, phase, notice, error, endMessage }
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [remoteVideo, setRemoteVideo] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const callRef = useRef(null)
  const pcRef = useRef(null)
  const localRef = useRef(null)
  const pendingRef = useRef([]) // ICE candidates that arrived before the remote description
  const iceRef = useRef(null)
  const attemptRef = useRef(null) // cancels in-flight async steps when the call ends early
  const endTimer = useRef(null)
  callRef.current = call

  const cleanup = useCallback(() => {
    if (pcRef.current) { pcRef.current.onicecandidate = null; pcRef.current.ontrack = null; pcRef.current.onconnectionstatechange = null; pcRef.current.close() }
    pcRef.current = null
    localRef.current?.getTracks().forEach((t) => t.stop()) // turns the camera/mic light off
    localRef.current = null; pendingRef.current = []
    setLocalStream(null); setRemoteStream(null); setRemoteVideo(false); setMuted(false); setCameraOff(false); setSeconds(0)
  }, [])

  const finish = useCallback((message) => {
    attemptRef.current = null
    cleanup()
    setCall((c) => (c ? { ...c, phase: 'ended', endMessage: message } : c))
    clearTimeout(endTimer.current)
    endTimer.current = setTimeout(() => setCall(null), 3000)
  }, [cleanup])

  const emit = useCallback((event, data) => new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: 'You are offline. Check your connection.' })
    socket.timeout(8000).emit(event, data, (err, res) => resolve(err ? { ok: false, error: 'The server did not respond.' } : res))
  }), [socket])

  const hangUp = useCallback(async (message) => {
    const c = callRef.current
    if (!c) return
    if (c.phase === 'ended' || c.phase === 'error') { cleanup(); clearTimeout(endTimer.current); setCall(null); return }
    attemptRef.current = null
    if (!c.id) { cleanup(); setCall(null); return } // still asking for permissions: nothing to tell the server
    const res = await emit('call:end', { callId: c.id }) // the server answers with call:ended for both people
    if (!res.ok) finish(message || 'Call ended')
  }, [cleanup, emit, finish])
  const hangUpRef = useRef(hangUp)
  hangUpRef.current = hangUp

  async function createPeer(stream, callId) {
    if (!iceRef.current) { try { iceRef.current = (await callConfigApi()).iceServers } catch { iceRef.current = FALLBACK_ICE } }
    const pc = new RTCPeerConnection({ iceServers: iceRef.current })
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit('call:signal', { callId, data: { type: 'candidate', candidate: e.candidate.toJSON() } }, () => {}) }
    pc.ontrack = (e) => { setRemoteStream(e.streams[0]); if (e.track.kind === 'video') setRemoteVideo(true) }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCall((c) => (isLive(c) ? { ...c, phase: 'connected' } : c))
      if (pc.connectionState === 'failed') hangUpRef.current('Connection failed')
    }
    pcRef.current = pc
    return pc
  }

  const flushCandidates = async (pc) => { for (const cand of pendingRef.current.splice(0)) await pc.addIceCandidate(cand).catch(() => {}) }

  const startCall = useCallback(async (peer, type) => {
    if (isLive(callRef.current)) return
    clearTimeout(endTimer.current)
    const me = (attemptRef.current = Symbol('call'))
    setCall({ id: null, type, direction: 'outgoing', peer, phase: 'preparing', notice: '', error: '', endMessage: '' })
    let media
    try { media = await getMedia(type) } catch (e) { if (attemptRef.current === me) setCall((c) => (c ? { ...c, phase: 'error', error: e.message } : c)); return }
    if (attemptRef.current !== me) { media.stream.getTracks().forEach((t) => t.stop()); return }
    localRef.current = media.stream; setLocalStream(media.stream)
    const res = await emit('call:start', { receiverId: peer.id, type })
    if (attemptRef.current !== me) { if (res.ok) emit('call:end', { callId: res.callId }); cleanup(); return }
    if (!res.ok) { cleanup(); setCall((c) => (c ? { ...c, phase: 'error', error: res.error } : c)); return }
    setCall((c) => (c ? { ...c, id: res.callId, phase: 'calling', notice: media.notice } : c))
  }, [emit, cleanup])

  const accept = useCallback(async () => {
    const c = callRef.current
    if (!c || c.phase !== 'ringing') return
    const me = (attemptRef.current = Symbol('call'))
    setCall({ ...c, phase: 'preparing' })
    let media
    try { media = await getMedia(c.type) } catch (e) {
      emit('call:reject', { callId: c.id })
      if (attemptRef.current === me) setCall((x) => (x ? { ...x, phase: 'error', error: `${e.message} The call was declined.` } : x))
      return
    }
    if (attemptRef.current !== me) { media.stream.getTracks().forEach((t) => t.stop()); return }
    localRef.current = media.stream; setLocalStream(media.stream)
    await createPeer(media.stream, c.id) // ready before accepting, so the caller's offer can never arrive too early
    if (attemptRef.current !== me) { cleanup(); return }
    const res = await emit('call:accept', { callId: c.id })
    if (!res.ok) { cleanup(); setCall((x) => (x ? { ...x, phase: 'error', error: res.error } : x)); return }
    setCall((x) => (x ? { ...x, phase: 'connecting', notice: media.notice } : x))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, cleanup, socket])

  const decline = useCallback(async () => {
    const c = callRef.current
    if (!c || c.phase !== 'ringing') return
    await emit('call:reject', { callId: c.id })
    clearTimeout(endTimer.current); setCall(null)
  }, [emit])

  // Socket events
  useEffect(() => {
    if (!socket) return
    const onIncoming = ({ call: c }) => {
      if (isLive(callRef.current)) { socket.emit('call:reject', { callId: c.id }, () => {}); return }
      clearTimeout(endTimer.current)
      setCall({ id: c.id, type: c.type, direction: 'incoming', peer: c.caller, phase: 'ringing', notice: '', error: '', endMessage: '' })
    }
    const onAccepted = async ({ callId }) => {
      const c = callRef.current
      if (!c || c.id !== callId) return
      if (c.direction === 'incoming') { if (c.phase === 'ringing') setCall(null); return } // answered on another device of mine
      setCall((x) => (x ? { ...x, phase: 'connecting' } : x))
      try { // the caller makes the offer
        const pc = await createPeer(localRef.current, callId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call:signal', { callId, data: { type: 'offer', sdp: offer.sdp } }, () => {})
      } catch { hangUpRef.current('Could not start the connection') }
    }
    const onSignal = async ({ callId, data }) => {
      const c = callRef.current
      const pc = pcRef.current
      if (!c || c.id !== callId || !data) return
      try {
        if (data.type === 'candidate') {
          if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
          else pendingRef.current.push(data.candidate)
        } else if (!pc) return
        else if (data.type === 'offer') {
          await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
          await flushCandidates(pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('call:signal', { callId, data: { type: 'answer', sdp: answer.sdp } }, () => {})
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
          await flushCandidates(pc)
        }
      } catch { hangUpRef.current('Connection failed') }
    }
    const onEnded = ({ callId, status, reason, duration }) => {
      const c = callRef.current
      if (!c || c.id !== callId) return
      const outgoing = c.direction === 'outgoing'
      const message =
        status === 'completed' ? (reason === 'disconnected' ? 'Call ended (connection lost)' : `Call ended · ${formatDuration(duration)}`)
        : status === 'rejected' ? (outgoing ? 'Call declined' : 'Call ended')
        : status === 'canceled' ? (outgoing ? 'Call canceled' : 'Missed call')
        : outgoing ? 'No answer' : 'Missed call'
      if (c.phase === 'ringing' && !outgoing) { clearTimeout(endTimer.current); setCall(null); return } // caller gave up before I answered
      finish(message)
    }
    const onDisconnect = () => { if (isLive(callRef.current) && callRef.current.phase !== 'ringing') finish('Connection lost') }

    socket.on('call:incoming', onIncoming)
    socket.on('call:accepted', onAccepted)
    socket.on('call:signal', onSignal)
    socket.on('call:ended', onEnded)
    socket.on('disconnect', onDisconnect)
    return () => { socket.off('call:incoming', onIncoming); socket.off('call:accepted', onAccepted); socket.off('call:signal', onSignal); socket.off('call:ended', onEnded); socket.off('disconnect', onDisconnect) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, finish])

  // Call timer
  const connected = call?.phase === 'connected'
  useEffect(() => {
    if (!connected) return
    const t0 = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [connected])

  // Logged out: drop everything
  useEffect(() => { if (!isAuthenticated) { attemptRef.current = null; cleanup(); setCall(null) } }, [isAuthenticated, cleanup])

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMuted(!track.enabled)
  }, [])
  const toggleCamera = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOff(!track.enabled)
  }, [])
  const dismiss = useCallback(() => { clearTimeout(endTimer.current); cleanup(); setCall(null) }, [cleanup])

  const hasCamera = !!localStream && localStream.getVideoTracks().length > 0
  const value = useMemo(() => ({
    call, localStream, remoteStream, remoteVideo, muted, cameraOff, seconds, hasCamera, inCall: isLive(call),
    startCall, accept, decline, hangUp, toggleMute, toggleCamera, dismiss,
  }), [call, localStream, remoteStream, remoteVideo, muted, cameraOff, seconds, hasCamera, startCall, accept, decline, hangUp, toggleMute, toggleCamera, dismiss])
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export const useCall = () => useContext(CallContext)
