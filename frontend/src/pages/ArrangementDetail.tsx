import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
import { logout } from "@/api/auth"
import {
  getArrangement,
  acceptArrangement,
  getPayments,
  recordPayment,
  confirmPayment,
  rejectPayment,
  getReminders,
  createReminder,
  snoozeReminder,
  getProposals,
  createProposal,
  respondToProposal,
  getActivity,
  getTrustSummary,
  closeArrangement,
  type ArrangementDetail,
  type PaymentItem,
  type ReminderItem,
  type ProposalItem,
  type ActivityItem,
  type TrustSummary,
} from "@/api/arrangements"

function formatCurrency(amount: number, currency: string) {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`
  return `${currency} ${amount.toLocaleString()}`
}

function formatDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export default function ArrangementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const auth = useAuthStore()
  const [arr, setArr] = useState<ArrangementDetail | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [trust, setTrust] = useState<TrustSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [accepting, setAccepting] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNote, setPaymentNote] = useState("")
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reminderCustom, setReminderCustom] = useState("")
  const [creatingReminder, setCreatingReminder] = useState(false)
  const [snoozingId, setSnoozingId] = useState<string | null>(null)
  const [proposalExpected, setProposalExpected] = useState("")
  const [proposalReason, setProposalReason] = useState("")
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [closeMessage, setCloseMessage] = useState("")
  const [closing, setClosing] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    setError("")
    try {
      const [arrRes, payRes, remRes, propRes, actRes, trustRes] = await Promise.all([
        getArrangement(id),
        getPayments(id),
        getReminders(id),
        getProposals(id),
        getActivity(id),
        getTrustSummary(id),
      ])
      setArr(arrRes.data)
      setPayments(payRes.data.payments)
      setReminders(remRes.data.reminders)
      setProposals(propRes.data.proposals)
      setActivity(actRes.data)
      setTrust(trustRes.data)
    } catch (e) {
      setError("Could not load arrangement.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    auth.logout()
    navigate("/", { replace: true })
  }

  type Participant = { userId: string; role: string; name?: string }
  const isLender = Boolean(
    arr?.participants?.some(
      (p: Participant) =>
        p.role === "lender" && String(p.userId) === String(auth.userId)
    )
  )
  const isBorrower = Boolean(
    arr?.participants?.some(
      (p: Participant) =>
        p.role === "borrower" && String(p.userId) === String(auth.userId)
    )
  )
  const canClose = arr && arr.balanceRemaining <= 0 && arr.status === "active"

  const handleAccept = async () => {
    if (!id) return
    setError("")
    setAccepting(true)
    try {
      await acceptArrangement(id)
      await load()
    } catch (e) {
      setError("Could not accept invitation.")
    } finally {
      setAccepting(false)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !paymentAmount || !arr) return
    const amount = parseFloat(paymentAmount)
    if (amount <= 0) return
    if (amount > arr.balanceRemaining) {
      setError(`Amount cannot exceed what you owe (${formatCurrency(arr.balanceRemaining, arr.currency)}).`)
      return
    }
    setError("")
    setRecordingPayment(true)
    try {
      await recordPayment(id, {
        amount,
        paidOn: new Date().toISOString().slice(0, 10),
        note: paymentNote || undefined,
      })
      setPaymentAmount("")
      setPaymentNote("")
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not record payment.")
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleConfirm = async (paymentId: string) => {
    setError("")
    setConfirmingId(paymentId)
    try {
      await confirmPayment(paymentId, true)
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not confirm payment.")
    } finally {
      setConfirmingId(null)
    }
  }

  const handleReject = async (paymentId: string) => {
    setError("")
    setRejectingId(paymentId)
    try {
      await rejectPayment(paymentId)
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not reject payment.")
    } finally {
      setRejectingId(null)
    }
  }

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setError("")
    setCreatingReminder(true)
    try {
      await createReminder(id, {
        schedule: "monthly",
        messageTone: "gentle",
        customMessage: reminderCustom || undefined,
      })
      setReminderCustom("")
      await load()
    } catch (e) {
      setError("Could not create reminder.")
    } finally {
      setCreatingReminder(false)
    }
  }

  const handleSnooze = async (reminderId: string) => {
    setError("")
    setSnoozingId(reminderId)
    try {
      await snoozeReminder(reminderId, {
        snoozeUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        reason: "Will pay soon",
      })
      await load()
    } catch (e) {
      setError("Could not snooze reminder.")
    } finally {
      setSnoozingId(null)
    }
  }

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !proposalExpected) return
    setError("")
    setCreatingProposal(true)
    try {
      await createProposal(id, {
        type: "expectedByChange",
        newExpectedBy: proposalExpected,
        reason: proposalReason || undefined,
      })
      setProposalExpected("")
      setProposalReason("")
      await load()
    } catch (e) {
      setError("Could not create proposal.")
    } finally {
      setCreatingProposal(false)
    }
  }

  const handleRespond = async (proposalId: string, decision: "accept" | "reject") => {
    setError("")
    setRespondingId(proposalId)
    try {
      await respondToProposal(proposalId, decision)
      await load()
    } catch (e) {
      setError("Could not respond to proposal.")
    } finally {
      setRespondingId(null)
    }
  }

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setError("")
    setClosing(true)
    try {
      await closeArrangement(id, closeMessage || undefined)
      await load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error ?? "Could not close arrangement.")
    } finally {
      setClosing(false)
    }
  }

  if (loading && !arr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!id || !arr) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Arrangement not found.</p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const lenderName =
    arr.participants?.find((p: Participant) => p.role === "lender")?.name ??
    "Lender"
  const borrowerName =
    arr.participants?.find((p: Participant) => p.role === "borrower")?.name ??
    "Borrower"

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

      <main className="mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div
            className="mb-6 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{arr.title}</h1>
            <p className="text-gray-500 mt-1">
              {lenderName} → {borrowerName}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              You&apos;re the{" "}
              <span className="font-medium">{isLender ? "lender" : "borrower"}</span>
            </p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              arr.status === "active"
                ? "bg-teal-100 text-teal-800"
                : arr.status === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            {arr.status}
          </span>
        </div>

        {arr.note && (
          <p className="mt-4 p-4 rounded-xl bg-teal-50 border border-teal-100 text-gray-700">
            {arr.note}
          </p>
        )}

        <section className="mt-8 card">
          <h2 className="text-lg font-semibold text-gray-900">Balance</h2>
          <p className="mt-2 text-2xl font-bold text-gray-800">
            {formatCurrency(arr.balanceRemaining, arr.currency)} remaining
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {formatCurrency(arr.paidAmount, arr.currency)} paid of{" "}
            {formatCurrency(arr.totalAmount, arr.currency)} · Expected by{" "}
            {formatDate(arr.expectedBy)}
          </p>
        </section>

        {arr.status === "pending" && isBorrower && (
          <section className="mt-6 card">
            <p className="text-gray-700">
              You&apos;ve been invited to this arrangement. Accept to get started.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="btn-primary mt-4 disabled:opacity-60"
            >
              {accepting ? "Accepting…" : "Accept invitation"}
            </button>
          </section>
        )}

        {arr.status === "active" && (
          <>
            <section className="mt-8 card">
              <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
              <ul className="mt-4 space-y-2">
                {payments.length === 0 ? (
                  <li className="text-gray-500 text-sm">No payments yet.</li>
                ) : (
                  payments.map((p: PaymentItem) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <span className="font-medium">
                          {formatCurrency(p.amount, arr.currency)}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">
                          {formatDate(p.paidOn)} · {p.recordedBy}
                        </span>
                        {p.note && (
                          <p className="text-sm text-gray-500 mt-0.5">{p.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            p.status === "confirmed"
                              ? "bg-teal-100 text-teal-800"
                              : p.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {p.status === "confirmed"
                            ? "Confirmed"
                            : p.status === "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                        {p.status === "pending_confirmation" && isLender && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirm(p.id)}
                              disabled={confirmingId === p.id || rejectingId === p.id}
                              className="text-sm text-teal-600 hover:underline disabled:opacity-60"
                            >
                              {confirmingId === p.id ? "Confirming…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(p.id)}
                              disabled={rejectingId === p.id || confirmingId === p.id}
                              className="text-sm text-red-600 hover:underline disabled:opacity-60"
                            >
                              {rejectingId === p.id ? "Rejecting…" : "Reject"}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <form onSubmit={handleRecordPayment} className="mt-6 flex flex-wrap gap-3 items-end">
                <div>
                  <input
                    type="number"
                    min="0.01"
                    max={arr.balanceRemaining}
                    step="any"
                    className="input w-32"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Amount"
                    required
                    disabled={recordingPayment}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {formatCurrency(arr.balanceRemaining, arr.currency)}
                  </p>
                </div>
                <input
                  type="text"
                  className="input flex-1 min-w-[140px]"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Note (optional)"
                  disabled={recordingPayment}
                />
                <button
                  type="submit"
                  className="btn-primary shrink-0"
                  disabled={recordingPayment}
                >
                  {recordingPayment ? "Recording…" : "Record payment"}
                </button>
              </form>
            </section>

            {isLender && (
              <section className="mt-8 card">
                <h2 className="text-lg font-semibold text-gray-900">Reminders</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Gentle nudge schedule. Borrower can snooze with a reason.
                </p>
                <ul className="mt-4 space-y-2">
                  {reminders.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <span className="text-sm">{r.schedule}</span>
                        {r.customMessage && (
                          <p className="text-gray-500 text-sm mt-0.5">
                            &ldquo;{r.customMessage}&rdquo;
                          </p>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                            r.status === "snoozed"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {r.status}
                          {r.visibleNote && ` · ${r.visibleNote}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleCreateReminder} className="mt-6 flex flex-wrap gap-3">
                  <input
                    type="text"
                    className="input flex-1 min-w-[200px]"
                    value={reminderCustom}
                    onChange={(e) => setReminderCustom(e.target.value)}
                    placeholder="e.g. Hey! Just a small reminder — no rush 🙂"
                    disabled={creatingReminder}
                  />
                  <button
                    type="submit"
                    className="btn-secondary shrink-0"
                    disabled={creatingReminder}
                  >
                    {creatingReminder ? "Adding…" : "Add reminder"}
                  </button>
                </form>
              </section>
            )}

            {isBorrower && reminders.some((r) => r.status === "active") && (
              <section className="mt-8 card">
                <h2 className="text-lg font-semibold text-gray-900">
                  Active reminders
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  You can snooze and add a short reason if you need more time.
                </p>
                <ul className="mt-4 space-y-2">
                  {reminders
                    .filter((r) => r.status === "active")
                    .map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span className="text-sm">{r.customMessage || "Gentle reminder"}</span>
                        <button
                          type="button"
                          onClick={() => handleSnooze(r.id)}
                          disabled={snoozingId === r.id}
                          className="text-sm text-teal-600 hover:underline disabled:opacity-60"
                        >
                          {snoozingId === r.id ? "Snoozing…" : "Snooze"}
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            <section className="mt-8 card">
              <h2 className="text-lg font-semibold text-gray-900">Proposals</h2>
              <p className="text-sm text-gray-500 mt-1">
                Suggest changes (e.g. new expected date). The other party can accept
                or reject.
              </p>
              <ul className="mt-4 space-y-2">
                {proposals.map((p: ProposalItem) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <span className="font-medium">{p.type}</span>
                      {p.newExpectedBy && (
                        <span className="text-gray-500 text-sm ml-2">
                          → {formatDate(p.newExpectedBy)}
                        </span>
                      )}
                      {p.reason && (
                        <p className="text-sm text-gray-500 mt-0.5">{p.reason}</p>
                      )}
                      <span className="text-xs text-gray-400">by {p.proposedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          p.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : p.status === "accepted"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.status === "pending" &&
                        ((isLender && p.proposedBy === borrowerName) ||
                          (isBorrower && p.proposedBy === lenderName)) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRespond(p.id, "accept")}
                              disabled={respondingId === p.id}
                              className="text-sm text-teal-600 hover:underline"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespond(p.id, "reject")}
                              disabled={respondingId === p.id}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Reject
                            </button>
                          </>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleCreateProposal} className="mt-6 flex flex-wrap gap-3">
                <input
                  type="date"
                  className="input w-40"
                  value={proposalExpected}
                  onChange={(e) => setProposalExpected(e.target.value)}
                  required
                  disabled={creatingProposal}
                />
                <input
                  type="text"
                  className="input flex-1 min-w-[140px]"
                  value={proposalReason}
                  onChange={(e) => setProposalReason(e.target.value)}
                  placeholder="Reason (optional)"
                  disabled={creatingProposal}
                />
                <button
                  type="submit"
                  className="btn-secondary shrink-0"
                  disabled={creatingProposal}
                >
                  {creatingProposal ? "Sending…" : "Propose new date"}
                </button>
              </form>
            </section>

            {trust && (
              <section className="mt-8 card">
                <h2 className="text-lg font-semibold text-gray-900">
                  Trust summary
                </h2>
                <p className="mt-2 text-gray-700">{trust.summary}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Payments on time: {(trust.paymentsOnTimeRatio * 100).toFixed(0)}% ·
                  Communication: {trust.communicationScore} · Last interaction:{" "}
                  {formatDate(trust.lastInteraction)}
                </p>
              </section>
            )}

            <section className="mt-8 card">
              <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
              <ul className="mt-4 space-y-2">
                {activity.length === 0 ? (
                  <li className="text-gray-500 text-sm">No activity yet.</li>
                ) : (
                  activity.map((a, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-2 py-1 text-sm"
                    >
                      <span className="text-gray-500">
                        {formatDateTime(a.timestamp)}
                      </span>
                      <span className="text-gray-700">{a.message}</span>
                      <span className="text-gray-400">({a.by})</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {canClose && (
              <section className="mt-8 card border-teal-200 bg-teal-50/50">
                <h2 className="text-lg font-semibold text-gray-900">
                  All settled?
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Close this arrangement and leave a friendly note.
                </p>
                <form onSubmit={handleClose} className="mt-4 space-y-3">
                  <input
                    type="text"
                    className="input"
                    value={closeMessage}
                    onChange={(e) => setCloseMessage(e.target.value)}
                    placeholder="e.g. All settled. Thanks for the trust 🤝"
                    disabled={closing}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={closing}
                  >
                    {closing ? "Closing…" : "Close arrangement"}
                  </button>
                </form>
              </section>
            )}
          </>
        )}

        {arr.status === "closed" && (
          <section className="mt-8 card bg-gray-50">
            <p className="text-gray-600">
              This arrangement is closed. Everything&apos;s been settled.
            </p>
            <Link to="/dashboard" className="text-teal-600 hover:underline mt-2 inline-block">
              Back to dashboard
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}
