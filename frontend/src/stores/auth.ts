import { create } from "zustand"

interface AuthState {
  userId: number | null
  token: string | null
  login: (userId: number, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: Number(localStorage.getItem("userId")) || null,
  token: localStorage.getItem("accessToken"),

  login: (userId, token) => {
    localStorage.setItem("userId", String(userId))
    localStorage.setItem("accessToken", token)
    set({ userId, token })
  },

  logout: () => {
    localStorage.clear()
    set({ userId: null, token: null })
  },
}))
