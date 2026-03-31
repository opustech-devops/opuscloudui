import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { cloudstack } from '../api/cloudstack'
import type { SessionUser } from '../types'

interface AuthContextValue {
  user:            SessionUser | null
  isAuthenticated: boolean
  setUser:         (user: SessionUser) => void
  logout:          () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null)
  const navigate = useNavigate()

  // Bootstrap session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('opus_session')
    if (stored) {
      try {
        const u = JSON.parse(stored) as SessionUser
        setUserState(u)
        cloudstack.setSessionKey(u.sessionKey)
      } catch {
        localStorage.removeItem('opus_session')
      }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('opus_session')
    cloudstack.clearSession()
    setUserState(null)
    navigate('/login', { replace: true })
  }, [navigate])

  // Register session-expired handler on the singleton
  useEffect(() => {
    cloudstack.onSessionExpired = logout
    return () => { cloudstack.onSessionExpired = undefined }
  }, [logout])

  const setUser = (u: SessionUser) => {
    setUserState(u)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
