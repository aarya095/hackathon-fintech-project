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

export function signupRequestOtp(email: string) {
  return api.post<{ message: string }>(`${P}/auth/signup/request-otp`, {
    email,
  })
}

export function signupVerify(data: {
  email: string
  otp: string
  name: string
  password: string
  timezone?: string
}) {
  return api.post<AuthResponse>(`${P}/auth/signup/verify`, data)
}

export function login(data: LoginInput) {
  return api.post<AuthResponse>(`${P}/auth/login`, data)
}

export function logout() {
  return api.post<{ message: string }>(`${P}/auth/logout`)
}

export function forgotPassword(email: string) {
  return api.post<{ message: string }>(`${P}/auth/forgot-password`, {
    email,
  })
}

export function resetPassword(data: {
  email: string
  otp: string
  newPassword: string
}) {
  return api.post<{ message: string }>(`${P}/auth/reset-password`, data)
}

export type Profile = {
  id: string
  name: string
  email: string
  timezone: string
}

export function getProfile() {
  return api.get<Profile>(`${P}/me`)
}

export function updateProfile(data: { name?: string; timezone?: string }) {
  return api.patch<Profile>(`${P}/me`, data)
}
