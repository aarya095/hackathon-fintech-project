import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { login as loginApi } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()
  const auth = useAuthStore()

  const handleLogin = async () => {
    try {
      const res = await loginApi(email, password)
      auth.login(res.userId, res.accessToken)
      navigate("/dashboard")
    } catch (err: any) {
      alert(err.response?.data?.error || "Login failed")
    }
  }

  return (
    <><div className="min-h-screen flex items-center bg-gray-50">
          {/* Left illustration (hidden on mobile) */}
          <div className="hidden lg:flex lg:w-1/2 h-screen bg-purple-600 items-center justify-center">
              <div className="text-white max-w-md px-12">
                  <h1 className="text-3xl font-bold mb-4">
                      Trust-based lending
                  </h1>
                  <p className="text-purple-100">
                      A gentle, transparent way to manage money
                      between people who trust each other.
                  </p>
              </div>
          </div>

          {/* Right login card */}
          <div className="flex flex-col w-full lg:w-1/2 items-center justify-center px-6">
              <div className="w-full max-w-md">
                  <div className="card">
                      <h1 className="text-2xl font-semibold text-gray-700">
                          Welcome back
                      </h1>

                      <p className="text-sm text-gray-500 mt-1">
                          Sign in to continue your arrangements
                      </p>

                      <form
                          className="mt-6 space-y-4"
                          onSubmit={(e) => {
                              e.preventDefault()
                              handleLogin()
                          } }
                      >
                          <label className="block text-sm">
                              <span className="text-gray-700">Email</span>
                              <input
                                  className="input mt-1"
                                  placeholder="you@email.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)} />
                          </label>

                          <label className="block text-sm">
                              <span className="text-gray-700">Password</span>
                              <input
                                  className="input mt-1"
                                  type="password"
                                  placeholder="••••••••"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)} />
                          </label>

                          <button
                              type="submit"
                              className="btn-primary w-full mt-4"
                          >
                              Log in
                          </button>
                      </form>

                      <hr className="my-6" />

                      <p className="text-sm text-center text-gray-500">
                          Don’t have an account?{" "}
                          <Link
                              to="/signup"
                              className="text-purple-600 hover:underline"
                          >
                              Create one
                          </Link>
                      </p>
                  </div>
              </div>
          </div>
      </div><form
          onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
          } }
      >
              {/* inputs */}
          </form></>
  )
}
