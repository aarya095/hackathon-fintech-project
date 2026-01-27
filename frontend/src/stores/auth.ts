import { defineStore } from "pinia"
import { login as loginApi } from "@/services/auth"

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as any,
    loading: false,
    error: "" as string | null,
  }),

  actions: {
    async login(email: string, password: string) {
      this.loading = true
      this.error = null

      try {
        const data = await loginApi({ email, password })
        this.user = data.user
        return true
      } catch (err: any) {
        this.error =
          err.response?.data?.message || "Login failed"
        return false
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.user = null
    },
  },
})
