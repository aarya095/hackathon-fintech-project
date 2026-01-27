import MockAdapter from "axios-mock-adapter"
import { api } from "@/services/api"

const mock = new MockAdapter(api, { delayResponse: 800 })

mock.onPost("/auth/login").reply((config) => {
  const { email, password } = JSON.parse(config.data)

  if (email === "test@example.com" && password === "password") {
    return [
      200,
      {
        userId: "u_123",
        accessToken: "fake-jwt-token",
        message: "Welcome back 🙂",
      },
    ]
  }

  return [
    401,
    {
      message: "That didn’t look right. Try again?",
    },
  ]
})

// ---- SIGNUP ----
mock.onPost("/auth/signup").reply((config) => {
  const { name, email, password } = JSON.parse(config.data)

  if (!email || !password || !name) {
    return [
      400,
      { message: "Let’s fill in all the fields 🙂" },
    ]
  }

  if (email === "test@example.com") {
    return [
      409,
      { message: "Looks like you already have an account" },
    ]
  }

  return [
    201,
    {
      userId: "u_456",
      accessToken: "fake-jwt-token",
      message: "Account created successfully 🎉",
    },
  ]
})

