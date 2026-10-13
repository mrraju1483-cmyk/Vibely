import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { TOKEN_KEY } from '../api/axios.js'
import { loginApi, registerApi, logoutApi, meApi } from '../api/authApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) { setCurrentUser(null); return null }
    try {
      const { user } = await meApi()
      setCurrentUser(user)
      return user
    } catch (err) {
      if (err.response?.status === 401) localStorage.removeItem(TOKEN_KEY)
      setCurrentUser(null)
      return null
    }
  }, [])

  // On app start: validate any saved session
  useEffect(() => { refreshUser().finally(() => setLoading(false)) }, [refreshUser])

  // Token rejected by the API anywhere in the app -> clear state
  useEffect(() => {
    const onUnauthorized = () => setCurrentUser(null)
    window.addEventListener('vibely:unauthorized', onUnauthorized)
    return () => window.removeEventListener('vibely:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user } = await loginApi(credentials)
    localStorage.setItem(TOKEN_KEY, token)
    setCurrentUser(user)
    return user
  }, [])

  const register = useCallback((data) => registerApi(data), [])

  const logout = useCallback(async () => {
    try { await logoutApi() } catch { /* token is discarded either way */ }
    localStorage.removeItem(TOKEN_KEY)
    setCurrentUser(null)
  }, [])

  const value = useMemo(
    () => ({ currentUser, isAuthenticated: !!currentUser, loading, login, register, logout, refreshUser }),
    [currentUser, loading, login, register, logout, refreshUser]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
