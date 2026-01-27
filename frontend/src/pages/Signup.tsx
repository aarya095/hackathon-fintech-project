import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { signup } from "@/api/auth"

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await signup({ name, email, password, timezone })
      navigate("/login", { replace: true })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Sign up failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">
            Create your account
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Start managing arrangements with people you trust
          </p>
        </div>

        {error && (
          <div
            className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              placeholder="e.g. Priya"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-60 font-medium"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-teal-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
