import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { login } from "../api/auth"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuthStore()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { data } = await login({ email, password })
      auth.login(data.userId, data.accessToken)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Sign in failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center bg-gray-50">
      <div className="hidden lg:flex lg:w-1/2 h-screen bg-teal-700 items-center justify-center">
        <div className="text-white max-w-md px-12">
          <h1 className="text-3xl font-bold mb-4">Trust-based lending</h1>
          <p className="text-teal-100">
            A gentle, transparent way to manage money between people who trust each
            other. No penalties, no pressure — just clarity and care.
          </p>
        </div>
      </div>

      <div className="flex flex-col w-full lg:w-1/2 items-center justify-center px-6">
        <div className="w-full max-w-md card">
          <h1 className="text-2xl font-semibold text-gray-800">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to continue your arrangements
          </p>

          {error && (
            <div
              className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
              role="alert"
            >
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm">
              <span className="text-gray-700">Email</span>
              <input
                type="email"
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Password</span>
              <input
                type="password"
                className="input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </label>
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-teal-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-4 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <hr className="my-6 border-gray-200" />

          <p className="text-sm text-center text-gray-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-teal-600 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
