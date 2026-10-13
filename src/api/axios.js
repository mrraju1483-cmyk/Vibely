import axios from 'axios'

export const TOKEN_KEY = 'vibely-token'

// VITE_API_URL comes from .env (see .env.example). Falls back to the local dev server.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 15000 })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('vibely:unauthorized'))
    }
    return Promise.reject(err)
  }
)

export const getErrorMessage = (err) =>
  !err.response ? 'Cannot reach the server. Check your connection and try again.' : err.response.data?.message || 'Something went wrong. Please try again.'
export const getFieldErrors = (err) => err.response?.data?.errors || {}
export const getErrorCode = (err) => err.response?.data?.code

export default api
