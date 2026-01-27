import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { signupRequestOtp, signupVerify } from "@/api/auth"

type Step = "email" | "verify"

export default function Signup() {
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState("")

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    if (!em) return
    setError("")
    setLoading(true)
    try {
      await signupRequestOtp(em)
      setStep("verify")
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not send verification code.")
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!email.trim()) return
    setError("")
    setResendLoading(true)
    try {
      await signupRequestOtp(email.trim())
      setError("")
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not resend code.")
    } finally {
      setResendLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !otp.trim() || !name.trim() || !password) return
    setError("")
    setLoading(true)
    try {
      const { data } = await signupVerify({
        email: email.trim(),
        otp: otp.trim(),
        name: name.trim(),
        password,
        timezone,
      })
      auth.login(data.userId, data.accessToken)
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Verification failed. Please try again.")
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
            {step === "email"
              ? "We’ll send a verification code to your email"
              : "Enter the code and complete your profile"}
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

        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-60 font-medium"
            >
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="input bg-gray-100"
                aria-readonly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-60 font-medium"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </div>
          </form>
        )}

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
