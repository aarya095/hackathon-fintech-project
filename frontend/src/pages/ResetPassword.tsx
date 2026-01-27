import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { resetPassword, forgotPassword } from "@/api/auth"

export default function ResetPassword() {
  const location = useLocation()
  const stateEmail = (location.state as { email?: string })?.email ?? ""
  const [email, setEmail] = useState(stateEmail)
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleResendOtp = async () => {
    const em = email.trim()
    if (!em) return
    setError("")
    setResendLoading(true)
    try {
      await forgotPassword(em)
      setError("")
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not resend code.")
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    if (!em || !otp.trim() || !newPassword) return
    setError("")
    setLoading(true)
    try {
      await resetPassword({
        email: em,
        otp: otp.trim(),
        newPassword,
      })
      setDone(true)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not reset password. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-800">
            Password reset
          </h1>
          <p className="text-gray-600 mt-2">
            Your password has been updated. You can sign in now.
          </p>
          <Link to="/login" className="btn-primary mt-6 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-semibold text-gray-800">
          Reset password
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the verification code from your email and choose a new password.
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
              className="input"
              placeholder="123456"
              maxLength={6}
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading || loading}
              className="mt-1 text-sm text-teal-600 hover:underline disabled:opacity-60"
            >
              {resendLoading ? "Sending…" : "Resend code"}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Resetting…" : "Reset password"}
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
