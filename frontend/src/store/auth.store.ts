import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  login: (token: string, user: User) => void;
  register: (token: string, user: User) => void;
  logout: () => void;

  // Обновляем только accessToken, не трогая user и isAuthenticated.
  seedAccessToken: (token: string) => void;

  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setIsInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  login: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true });
  },
  register: (token: string, user: User) => {
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
  },

  seedAccessToken: (token: string) => {
    // Важно: не поднимаем user и не ставим isAuthenticated=true,
    // чтобы типы и логика оставались валидными до успешного /me.
    set({ token });
  },

  setUser: (user: User) => set({ user }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setIsInitialized: (initialized: boolean) => set({ isInitialized: initialized }),
}));
