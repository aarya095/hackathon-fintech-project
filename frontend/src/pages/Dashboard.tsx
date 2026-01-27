import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { logout } from "@/api/auth"
import {
  listArrangements,
  createArrangement,
  type ArrangementListItem,
  type CreateArrangementInput,
} from "@/api/arrangements"
import { listFriends, type Friend } from "@/api/friends"

function formatCurrency(amount: number, currency: string) {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`
  return `${currency} ${amount.toLocaleString()}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [list, setList] = useState<ArrangementListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [friends, setFriends] = useState<Friend[]>([])
  const [form, setForm] = useState<CreateArrangementInput>({
    title: "",
    totalAmount: 0,
    currency: "INR",
    borrowerEmail: "",
    expectedBy: "",
    repaymentStyle: "flexible",
    note: "",
  })

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await listArrangements()
      setList(data)
    } catch (e) {
      setError("Could not load arrangements. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (createOpen) {
      listFriends()
        .then((r) => setFriends(r.data.friends))
        .catch(() => setFriends([]))
    }
  }, [createOpen])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    auth.logout()
    navigate("/", { replace: true })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError("")
    setCreateLoading(true)
    try {
      const payload: CreateArrangementInput = {
        ...form,
        totalAmount: Number(form.totalAmount) || 0,
        expectedBy: form.expectedBy || undefined,
        note: form.note || undefined,
      }
      if (!payload.title || !payload.borrowerEmail || payload.totalAmount <= 0) {
        setCreateError("Please fill in title, borrower email, and a positive amount.")
        setCreateLoading(false)
        return
      }
      await createArrangement(payload)
      setCreateOpen(false)
      setForm({
        title: "",
        totalAmount: 0,
        currency: "INR",
        borrowerEmail: "",
        expectedBy: "",
        repaymentStyle: "flexible",
        note: "",
      })
      load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setCreateError(ax.response?.data?.error ?? "Could not create arrangement.")
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-teal-700">
            Trust-based lending
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Profile
            </Link>
            <Link
              to="/friends"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Friends
            </Link>
            <span className="text-sm text-gray-500">Dashboard</span>
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

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Your arrangements</h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary shrink-0"
          >
            New arrangement
          </button>
        </div>

        {error && (
          <div
            className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <div className="mt-12 p-8 rounded-xl bg-white border border-gray-200 text-center">
            <p className="text-gray-600">You don&apos;t have any arrangements yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Create one to lend or borrow with someone you trust.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary mt-6"
            >
              Create your first arrangement
            </button>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {list.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/arrangements/${a.id}`}
                  className="block p-4 rounded-xl bg-white border border-gray-200 hover:border-teal-300 hover:shadow-sm transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-gray-900">{a.title}</h2>
                      <p className="text-sm text-gray-500">
                        You&apos;re the {a.role} · {formatCurrency(a.balanceRemaining, a.currency)} left
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          a.status === "active"
                            ? "bg-teal-100 text-teal-800"
                            : a.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {a.status}
                      </span>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {createOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-title"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <h2 id="create-title" className="text-xl font-semibold text-gray-900">
              New arrangement
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Invite someone by email. They&apos;ll need an account to accept.
            </p>

            {createError && (
              <div
                className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
                role="alert"
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f: CreateArrangementInput) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Laptop help"
                  required
                  disabled={createLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Borrower
                </label>
                {friends.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">Quick select: </span>
                    {friends.map((fr) => (
                      <button
                        key={fr.id}
                        type="button"
                        onClick={() =>
                          setForm((f: CreateArrangementInput) => ({
                            ...f,
                            borrowerEmail: fr.email,
                          }))
                        }
                        className="mr-2 mt-1 px-2 py-1 text-xs rounded bg-teal-100 text-teal-800 hover:bg-teal-200"
                      >
                        {fr.name}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="email"
                  className="input"
                  value={form.borrowerEmail}
                  onChange={(e) =>
                    setForm((f: CreateArrangementInput) => ({
                      ...f,
                      borrowerEmail: e.target.value,
                    }))
                  }
                  placeholder="friend@example.com"
                  required
                  disabled={createLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="input"
                    value={form.totalAmount || ""}
                    onChange={(e) =>
                      setForm((f: CreateArrangementInput) => ({
                        ...f,
                        totalAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                    required
                    disabled={createLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    className="input"
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f: CreateArrangementInput) => ({
                        ...f,
                        currency: e.target.value,
                      }))
                    }
                    disabled={createLoading}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected by (optional)
                </label>
                <input
                  type="date"
                  className="input"
                  value={form.expectedBy}
                  onChange={(e) =>
                    setForm((f: CreateArrangementInput) => ({
                      ...f,
                      expectedBy: e.target.value,
                    }))
                  }
                  disabled={createLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment style
                </label>
                <select
                  className="input"
                  value={form.repaymentStyle}
                  onChange={(e) =>
                    setForm((f: CreateArrangementInput) => ({
                      ...f,
                      repaymentStyle: e.target
                        .value as CreateArrangementInput["repaymentStyle"],
                    }))
                  }
                  disabled={createLoading}
                >
                  <option value="flexible">Flexible</option>
                  <option value="one_time">One-time</option>
                  <option value="installments">Installments</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <textarea
                  className="input min-h-[80px]"
                  value={form.note}
                  onChange={(e) =>
                    setForm((f: CreateArrangementInput) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="e.g. Pay back when comfortable — no pressure 🙂"
                  disabled={createLoading}
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="btn-secondary flex-1"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createLoading}
                >
                  {createLoading ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
