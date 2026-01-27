<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-semibold text-gray-800">
          Create your account
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          A shared space for trust-based arrangements
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="signup" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">
            Name
          </label>
          <input
            v-model="name"
            type="text"
            placeholder="Your name"
            class="w-full px-4 py-2 border rounded-lg
                   focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            class="w-full px-4 py-2 border rounded-lg
                   focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            class="w-full px-4 py-2 border rounded-lg
                   focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
          {{ loading ? "Creating account…" : "Sign up" }}
        </button>
      </form>

      <!-- Footer -->
      <p class="text-center text-sm text-gray-500 mt-6">
        Already have an account?
        <router-link
          to="/login"
          class="text-indigo-600 hover:underline"
        >
          Sign in
        </router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { api } from "@/services/api"

const name = ref("")
const email = ref("")
const password = ref("")
const loading = ref(false)
const error = ref("")

const signup = async () => {
  error.value = ""
  loading.value = true

  try {
    const res = await api.post("/auth/signup", {
      name: name.value,
      email: email.value,
      password: password.value,
    })

    console.log("Signed up:", res.data)
    // later → save token, redirect to dashboard
  } catch (err: any) {
    error.value =
      err.response?.data?.message ||
      "Something went wrong. Please try again."
  } finally {
    loading.value = false
  }
}
</script>
