import api from "./client"

const P = "/api/v1"

export type SignupInput = {
  name: string
  email: string
  password: string
  timezone?: string
}

export type LoginInput = {
  email: string
  password: string
}

export type AuthResponse = {
  userId: string
  accessToken: string
  message: string
}

export function signup(data: SignupInput) {
  return api.post<AuthResponse>(`${P}/auth/signup`, data)
}

export function login(data: LoginInput) {
  return api.post<AuthResponse>(`${P}/auth/login`, data)
}

export function logout() {
  return api.post<{ message: string }>(`${P}/auth/logout`)
}
