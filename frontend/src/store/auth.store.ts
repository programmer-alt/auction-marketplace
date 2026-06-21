import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User) => void
  register: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false, // Возвращаем оригинальное значение false
  login: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true })
  },
  register: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false })
  },
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
}))