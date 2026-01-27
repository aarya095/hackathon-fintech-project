import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { logout } from "@/api/auth"
import {
  listFriends,
  listFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  type Friend,
  type FriendRequestItem,
} from "@/api/friends"

export default function Friends() {
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [fRes, rRes] = await Promise.all([
        listFriends(),
        listFriendRequests(),
      ])
      setFriends(fRes.data.friends)
      setRequests(rRes.data.requests)
    } catch {
      setError("Could not load friends.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    auth.logout()
    navigate("/", { replace: true })
  }

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError("")
    setSending(true)
    try {
      await sendFriendRequest(trimmed)
      setEmail("")
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not send request.")
    } finally {
      setSending(false)
    }
  }

  const handleRespond = async (id: string, decision: "accept" | "reject") => {
    setError("")
    setRespondingId(id)
    try {
      await respondToFriendRequest(id, decision)
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not respond.")
    } finally {
      setRespondingId(null)
    }
  }

  const handleRemove = async (userId: string) => {
    setError("")
    setRemovingId(userId)
    try {
      await removeFriend(userId)
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not remove friend.")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-gray-500 hover:text-gray-700"
              aria-label="Back to dashboard"
            >
              ← Dashboard
            </Link>
            <span className="text-lg font-semibold text-teal-700">
              Trust-based lending
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Profile
            </Link>
            <Link
              to="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <p className="text-gray-500 mt-1">
          Add friends to quickly select them when creating arrangements.
        </p>

        {error && (
          <div
            className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="mt-8 card">
          <h2 className="text-lg font-semibold text-gray-900">Add by email</h2>
          <form onSubmit={handleSendRequest} className="mt-4 flex gap-3">
            <input
              type="email"
              className="input flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              disabled={sending}
            />
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={sending}
            >
              {sending ? "Sending…" : "Send request"}
            </button>
          </form>
        </section>

        {requests.length > 0 && (
          <section className="mt-8 card">
            <h2 className="text-lg font-semibold text-gray-900">
              Incoming requests
            </h2>
            <ul className="mt-4 space-y-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="font-medium">{r.from.name}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {r.from.email}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespond(r.id, "accept")}
                      disabled={respondingId === r.id}
                      className="text-sm text-teal-600 hover:underline disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(r.id, "reject")}
                      disabled={respondingId === r.id}
                      className="text-sm text-red-600 hover:underline disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 card">
          <h2 className="text-lg font-semibold text-gray-900">Your friends</h2>
          {loading ? (
            <p className="mt-4 text-gray-500">Loading…</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 text-gray-500">
              No friends yet. Add someone by email above.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{f.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(f.id)}
                    disabled={removingId === f.id}
                    className="text-sm text-red-600 hover:underline disabled:opacity-60"
                  >
                    {removingId === f.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
