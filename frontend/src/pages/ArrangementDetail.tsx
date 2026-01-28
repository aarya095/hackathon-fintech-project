import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useAuthStore } from "../stores/auth"
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
  sendManualReminder,
  deleteReminder,
  type ArrangementDetail,
  type PaymentItem,
  type ReminderItem,
  type ProposalItem,
  type ActivityItem,
  type TrustSummary,
} from "@/api/arrangements"
import TrustScore from "../components/TrustScore"

// --- Helpers ---

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

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Components ---

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-teal-600 text-teal-700"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      )}
    >
      {children}
    </button>
  );
}

export default function ArrangementDetail() {
  const { id } = useParams<{ id: string }>()

  const auth = useAuthStore()

  // Data State
  const [arr, setArr] = useState<ArrangementDetail | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [trust, setTrust] = useState<TrustSummary | null>(null)

  // UI State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "reminders" | "proposals" | "activity">("overview")

  // Action States
  const [accepting, setAccepting] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNote, setPaymentNote] = useState("")
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reminderCustom, setReminderCustom] = useState("")
  const [reminderSchedule, setReminderSchedule] = useState("monthly") // New state
  const [creatingReminder, setCreatingReminder] = useState(false)
  const [sendingManual, setSendingManual] = useState(false) // New state
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

  // --- Handlers ---



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
        paidOn: new Date().toISOString(),
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

  const handleSendManual = async () => {
    if (!id) return
    setError("")
    setSendingManual(true)
    try {
      await sendManualReminder(id, reminderCustom || undefined)
      setReminderCustom("")
      alert("Reminder sent!")
      await load() // refresh lastRemindedAt logic if we tracked it (we don't show it yet but good practice)
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number, data?: { error?: string } } }
      if (ax.response?.status === 429) {
        setError(ax.response?.data?.error ?? "Rate limit reached.")
      } else {
        setError("Could not send reminder.")
      }
    } finally {
      setSendingManual(false)
    }
  }

  const handleDeleteReminder = async (reminderId: string) => {
    if (!id) return
    if (!confirm("Turn off auto-reminder?")) return
    setError("")
    try {
      await deleteReminder(reminderId)
      await load()
    } catch (e) {
      setError("Could not turn off reminder.")
    }
  }

  const handleSnooze = async (reminderId: string) => {
    setError("")
    setSnoozingId(reminderId)
    try {
      await snoozeReminder(reminderId, {
        snoozeUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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

  // --- Render ---

  if (loading && !arr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Loading arrangement...</p>
        </div>
      </div>
    )
  }

  if (!id || !arr) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600 text-lg">Arrangement not found.</p>
        <Link to="/dashboard" className="btn-primary">
          Back to dashboard
        </Link>
      </div>
    )
  }

  type Participant = { userId: string; role: string; name?: string }
  const isLender = arr.participants?.some(p => p.role === "lender" && String(p.userId) === String(auth.userId))
  const isBorrower = arr.participants?.some(p => p.role === "borrower" && String(p.userId) === String(auth.userId))

  const otherParty = arr.participants?.find((p: Participant) =>
    isLender ? p.role === "borrower" : p.role === "lender"
  )
  const otherName = otherParty?.name || (isLender ? "Borrower" : "Lender")
  const lenderName = arr.participants?.find((p: Participant) => p.role === "lender")?.name || "Lender"


  const canClose = arr.balanceRemaining <= 0 && arr.status === "active"

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors p-1" aria-label="Back">
              ←
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">{arr.title}</h1>
              <p className="text-xs text-gray-500">
                with {otherName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${arr.status === "active" ? "bg-teal-50 text-teal-700 border-teal-200" :
              arr.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}>
              {arr.status === 'active' ? 'Active' : arr.status === 'pending' ? 'Pending Acceptance' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4 flex gap-1 overflow-x-auto scrollbar-hide">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
          <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>Payments</TabButton>
          <TabButton active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')}>Reminders</TabButton>
          <TabButton active={activeTab === 'proposals'} onClick={() => setActiveTab('proposals')}>Proposals</TabButton>
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>Activity</TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl shadow-sm animate-fade-in-up">
            {error}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {arr.note && (
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-100/50 text-teal-900 text-sm shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <span className="text-6xl">📝</span>
                </div>
                <h3 className="font-semibold mb-1 text-teal-800">Note</h3>
                <p className="relative z-10 opacity-90">{arr.note}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Balance Card */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Balance Remaining</h2>
                  <p className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
                    {formatCurrency(arr.balanceRemaining, arr.currency)}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${Math.min((arr.paidAmount / arr.totalAmount) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-medium">
                      {Math.round((arr.paidAmount / arr.totalAmount) * 100)}% paid
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Total: {formatCurrency(arr.totalAmount, arr.currency)}
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-50">
                  <p className="text-sm text-gray-500">
                    Expected by <span className="font-medium text-gray-700">{formatDate(arr.expectedBy)}</span>
                  </p>
                </div>
              </section>

              {/* Trust Summary Card */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Trust Health</h2>
                {trust ? (
                  <div className="flex flex-col items-center justify-center h-full pb-4">
                    <TrustScore score={trust.paymentsOnTimeRatio} label="On-time Payment Ratio" />
                    <p className="mt-6 text-center text-gray-600 font-medium leading-relaxed">
                      {trust.summary}
                    </p>
                    <div className="mt-4 flex gap-4 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                      <span>Comms: {trust.communicationScore}</span>
                      <span>Last Active: {formatDate(trust.lastInteraction)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    Not enough data yet
                  </div>
                )}
              </section>
            </div>

            {/* Actions Area */}
            {arr.status === "pending" && isBorrower && (
              <section className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <h3 className="text-lg font-semibold text-amber-900">Review Invitation</h3>
                <p className="text-amber-800 mt-1 mb-4 max-w-md mx-auto">
                  {lenderName} invited you to this arrangement. Review the terms carefully.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="btn-primary bg-amber-600 hover:bg-amber-700 border-transparent text-white shadow-amber-200"
                  >
                    {accepting ? "Joining..." : "Accept & Join"}
                  </button>
                </div>
              </section>
            )}

            {canClose && (
              <section className="p-6 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100">
                <h3 className="text-lg font-semibold text-teal-900">✨ All settled!</h3>
                <p className="text-teal-700 mt-1 mb-4 text-sm">
                  The balance is zero. You can now close this arrangement.
                </p>
                <form onSubmit={handleClose} className="flex gap-3 max-w-lg">
                  <input
                    type="text"
                    className="input bg-white/80 border-transparent focus:bg-white flex-1"
                    value={closeMessage}
                    onChange={(e) => setCloseMessage(e.target.value)}
                    placeholder="Closing note (optional)..."
                    disabled={closing}
                  />
                  <button type="submit" className="btn-primary whitespace-nowrap" disabled={closing}>
                    {closing ? "Closing..." : "Close Arrangement"}
                  </button>
                </form>
              </section>
            )}

            {arr.status === "closed" && (
              <div className="p-8 rounded-2xl bg-gray-100 border border-gray-200 text-center">
                <span className="text-4xl">🔒</span>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">Arrangement Closed</h3>
                <p className="text-gray-500 mt-1">
                  Closed on {arr.closedAt ? formatDate(arr.closedAt) : 'recently'}.
                  {arr.closedMessage && ` Note: "${arr.closedMessage}"`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
              <span className="text-sm text-gray-500">
                {payments.length} {payments.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            {/* Record Payment Form */}
            {arr.status === 'active' && (
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Record a new payment</h3>
                <form onSubmit={handleRecordPayment} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative w-full sm:w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                      {arr.currency === 'INR' ? '₹' : arr.currency}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      max={arr.balanceRemaining}
                      step="any"
                      className="input pl-8 w-full font-medium"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={recordingPayment}
                    />
                  </div>
                  <input
                    type="text"
                    className="input flex-1"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Add a note (e.g. Bank transfer, Cash)..."
                    disabled={recordingPayment}
                  />
                  <button type="submit" className="btn-primary sm:w-auto w-full" disabled={recordingPayment}>
                    {recordingPayment ? "Saving..." : (isLender ? "Record Receipt" : "Record Payment")}
                  </button>
                </form>
              </div>
            )}

            {/* List */}
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-400">No payments recorded yet.</p>
                </div>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${p.status === 'confirmed' ? 'bg-teal-500' :
                      p.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'
                      }`} />

                    <div className="flex justify-between items-start pl-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-900">
                            {formatCurrency(p.amount, arr.currency)}
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide ${p.status === 'confirmed' ? 'bg-teal-100 text-teal-800' :
                            p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(p.paidOn)} {new Date(p.paidOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Recorded by <span className="font-medium text-gray-700">{p.recordedBy}</span>
                        </p>
                        {p.note && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg inline-block">
                            {p.note}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {p.status === "pending_confirmation" && isLender && (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleConfirm(p.id)}
                            disabled={confirmingId === p.id || rejectingId === p.id}
                            className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                          >
                            {confirmingId === p.id ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => handleReject(p.id)}
                            disabled={rejectingId === p.id || confirmingId === p.id}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
                          >
                            {rejectingId === p.id ? "..." : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* REMINDERS TAB */}
        {activeTab === 'reminders' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex gap-3">
              <span className="text-xl">💡</span>
              <p>Reminders are gentle nudges. They help keep communication open without the awkwardness.</p>
            </div>

            {/* Active Reminder Layout */}
            {isLender && arr.status === 'active' && (
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Auto-Reminder Settings</h3>
                {reminders.some(r => r.status === 'active') ? (
                  <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-100 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-teal-800 flex items-center gap-2">
                        ✅ Active: {reminders.find(r => r.status === 'active')?.schedule} Nudge
                      </h4>
                      <p className="text-sm text-teal-600 mt-1">
                        Next one scheduled for: {reminders.find(r => r.status === 'active')?.nextTrigger ? formatDateTime(reminders.find(r => r.status === 'active')!.nextTrigger!) : 'Soon'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const r = reminders.find(r => r.status === 'active');
                          if (r) handleDeleteReminder(r.id);
                        }}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm font-medium rounded hover:bg-red-50"
                      >
                        Turn Off
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateReminder} className="flex gap-3">
                    <input
                      type="text"
                      className="input flex-1"
                      value={reminderCustom}
                      onChange={(e) => setReminderCustom(e.target.value)}
                      placeholder="Message (optional)"
                      disabled={creatingReminder || sendingManual}
                    />
                    <select
                      className="input w-32"
                      value={reminderSchedule}
                      onChange={(e) => setReminderSchedule(e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                      disabled={creatingReminder || sendingManual}
                    >
                      {creatingReminder ? "Saving..." : "Enable"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Manual Send Section */}
            {isLender && arr.status === 'active' && (
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">One-time check-in</h3>
                  <p className="text-xs text-gray-500">Send an immediate email reminder.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSendManual}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                  disabled={sendingManual}
                >
                  {sendingManual ? "Sending..." : "Send Now"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROPOSALS TAB */}
        {activeTab === 'proposals' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-900">Propose Changes</h2>
              <p className="text-gray-500 text-sm">Need more time? Propose a new date. It's better than silence.</p>
            </div>

            {arr.status === 'active' && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h3 className="font-semibold text-gray-900 mb-4">Propose new expected date</h3>
                <form onSubmit={handleCreateProposal} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">New Date</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={proposalExpected}
                        onChange={(e) => setProposalExpected(e.target.value)}
                        required
                        disabled={creatingProposal}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Reason (Optional)</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={proposalReason}
                        onChange={(e) => setProposalReason(e.target.value)}
                        placeholder="e.g. Salary delayed..."
                        disabled={creatingProposal}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white" disabled={creatingProposal}>
                      {creatingProposal ? "Sending..." : "Send Proposal"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4 pt-4">
              {proposals.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">New Date: {p.newExpectedBy ? formatDate(p.newExpectedBy) : 'N/A'}</span>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${p.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        p.status === 'accepted' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Proposed by {p.proposedBy}</p>
                    {p.reason && <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded block w-full">"{p.reason}"</p>}
                  </div>

                  {p.status === 'pending' && (
                    ((isLender && p.proposedBy === otherName) || (isBorrower && p.proposedBy === otherName)) && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRespond(p.id, 'accept')}
                          disabled={respondingId === p.id}
                          className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespond(p.id, 'reject')}
                          disabled={respondingId === p.id}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                        >
                          Reject
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900">Activity Log</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {activity.length === 0 ? (
                  <p className="p-8 text-center text-gray-400">No activity yet.</p>
                ) : (
                  activity.map((a, i) => (
                    <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-gray-300 shrink-0"></div>
                      <div>
                        <p className="text-sm text-gray-800">{a.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDateTime(a.timestamp)} · <span className="capitalize">{a.by}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
