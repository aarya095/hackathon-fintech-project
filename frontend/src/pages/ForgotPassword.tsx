import { useState } from "react"
import { Link } from "react-router-dom"
import { forgotPassword } from "@/api/auth"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    if (!em) return
    setError("")
    setLoading(true)
    try {
      await forgotPassword(em)
      setSent(true)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-800">
            Check your email
          </h1>
          <p className="text-gray-600 mt-2">
            We sent a verification code to <strong>{email}</strong>. Use it on
            the next page to reset your password.
          </p>
          <Link
            to="/reset-password"
            state={{ email: email.trim() }}
            className="btn-primary mt-6 inline-block"
          >
            Enter code & reset password
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            <Link to="/login" className="text-teal-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-semibold text-gray-800">
          Forgot password?
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and we’ll send a verification code to reset it.
        </p>

        {error && (
          <div
            className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-teal-600 hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
