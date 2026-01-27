import { create } from "zustand"

type AuthState = {
  userId: string | null
  token: string | null
  login: (userId: string, token: string) => void
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: localStorage.getItem("userId"),
  token: localStorage.getItem("accessToken"),

  login: (userId, token) => {
    localStorage.setItem("userId", userId)
    localStorage.setItem("accessToken", token)
    set({ userId, token })
  },

  logout: () => {
    localStorage.removeItem("userId")
    localStorage.removeItem("accessToken")
    set({ userId: null, token: null })
  },

  hydrate: () => {
    set({
      userId: localStorage.getItem("userId"),
      token: localStorage.getItem("accessToken"),
    })
  },
}))

if (typeof window !== "undefined") {
  window.addEventListener("auth:logout", () => {
    useAuthStore.getState().logout()
  })
}
