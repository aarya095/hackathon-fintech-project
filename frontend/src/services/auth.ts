import { defineStore } from "pinia"
import { ref, computed } from "vue"

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(
    localStorage.getItem("accessToken")
  )
  const userId = ref<string | null>(
    localStorage.getItem("userId")
  )

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(payload: { token: string; userId: string }) {
    token.value = payload.token
    userId.value = payload.userId

    localStorage.setItem("accessToken", payload.token)
    localStorage.setItem("userId", payload.userId)
  }

  function logout() {
    token.value = null
    userId.value = null

    localStorage.removeItem("accessToken")
    localStorage.removeItem("userId")
  }

  return {
    token,
    userId,
    isAuthenticated,
    setAuth,
    logout,
  }
})
