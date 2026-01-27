import api from "./client"

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", {
    email,
    password,
  })
  return res.data
}

export async function register(data: {
  name: string
  email: string
  password: string
  timezone: string
}) {
  const res = await api.post("/auth/register", data)
  return res.data
}
