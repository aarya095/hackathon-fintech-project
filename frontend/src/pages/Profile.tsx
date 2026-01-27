import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { logout, getProfile, updateProfile, type Profile } from "@/api/auth"

export default function Profile() {
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editName, setEditName] = useState("")
  const [editTimezone, setEditTimezone] = useState("")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await getProfile()
      setProfile(data)
      setEditName(data.name)
      setEditTimezone(data.timezone || "UTC")
    } catch {
      setError("Could not load profile.")
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError("")
    setSaving(true)
    try {
      const { data } = await updateProfile({
        name: editName.trim() || undefined,
        timezone: editTimezone.trim() || undefined,
      })
      setProfile(data)
      setEditing(false)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not update profile.")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Could not load profile.</p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
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
              to="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Dashboard
            </Link>
            <Link
              to="/friends"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Friends
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
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">View and update your account details</p>

        {error && (
          <div
            className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="mt-8 card">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="input bg-gray-100"
                  value={profile.email}
                  disabled
                  aria-readonly
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  className="input"
                  value={editTimezone}
                  onChange={(e) => setEditTimezone(e.target.value)}
                  placeholder="e.g. Asia/Kolkata"
                  disabled={saving}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-0.5 text-gray-900">{profile.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-0.5 text-gray-900">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                  <dd className="mt-0.5 text-gray-900">
                    {profile.timezone || "UTC"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-secondary mt-6"
              >
                Edit profile
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
