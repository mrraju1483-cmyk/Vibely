import { io } from 'socket.io-client'
import { TOKEN_KEY } from '../api/axios.js'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || apiUrl.replace(/\/api\/?$/, '')

// The token is read on every (re)connect, so a refreshed login is picked up automatically
export const createSocket = () =>
  io(SOCKET_URL, { auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }), reconnectionDelayMax: 5000 })
