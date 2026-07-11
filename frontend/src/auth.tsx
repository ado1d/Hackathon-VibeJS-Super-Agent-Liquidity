import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { post } from './api'
import type { Role, TokenResponse, User } from './types'

interface AuthValue { user: User | null; login: (username: string, password: string) => Promise<void>; logout: () => void; switchRole: (role: Role) => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('user') || 'null'))
  const save = (result: TokenResponse) => { localStorage.setItem('access_token', result.access_token); localStorage.setItem('user', JSON.stringify(result.user)); setUser(result.user) }
  const value = useMemo<AuthValue>(() => ({ user,
    login: async (username, password) => save(await post<TokenResponse>('/auth/login', { username, password })),
    logout: () => { localStorage.removeItem('access_token'); localStorage.removeItem('user'); setUser(null) },
    switchRole: async role => save(await post<TokenResponse>('/auth/switch-role', { role })),
  }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook and provider intentionally share the private context contract.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider missing'); return value }
