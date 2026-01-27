<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-semibold text-gray-800">
          Welcome back
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          Sign in to continue your arrangements
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="login" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">
            Password
          </label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">
            {{ error }}
        </p>

        <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 mt-2 bg-indigo-600 text-white rounded-lg
                    hover:bg-indigo-700 transition disabled:opacity-50"
            >
            {{ loading ? "Signing in…" : "Login" }}
        </button>
      </form>

      <!-- Footer -->
      <p class="text-center text-sm text-gray-500 mt-6">
        New here?
        <router-link
          to="/signup"
          class="text-indigo-600 hover:underline"
        >
          Create an account
        </router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { api } from "@/services/api"
import { useAuthStore } from "@/stores/auth"

const email = ref("")
const password = ref("")
const loading = ref(false)
const error = ref("")

const router = useRouter()
const auth = useAuthStore()

const login = async () => {
  error.value = ""
  loading.value = true

  try {
    const res = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    })

    auth.setAuth({
      token: res.data.accessToken,
      userId: res.data.userId,
    })

    router.push("/dashboard")
  } catch (err: any) {
    error.value =
      err.response?.data?.message ||
      "Something went wrong. Please try again."
  } finally {
    loading.value = false
  }
}
</script>
