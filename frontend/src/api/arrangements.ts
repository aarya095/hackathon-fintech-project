import api from "./client"

const P = "/api/v1"

export type ArrangementListItem = {
  id: string
  title: string
  role: "lender" | "borrower"
  totalAmount: number
  balanceRemaining: number
  status: string
  currency: string
}

export type ArrangementDetail = {
  id: string
  title: string
  totalAmount: number
  paidAmount: number
  balanceRemaining: number
  expectedBy: string | null
  repaymentStyle: string
  participants: { userId: string; role: string; name?: string }[]
  note: string | null
  status: string
  currency: string
}

export type CreateArrangementInput = {
  title: string
  totalAmount: number
  currency?: string
  borrowerEmail: string
  expectedBy?: string
  repaymentStyle: "one_time" | "installments" | "flexible"
  note?: string
}

export type PaymentItem = {
  id: string
  amount: number
  paidOn: string
  note: string | null
  status: string
  recordedBy: string
}

export type ReminderItem = {
  id: string
  schedule: string
  messageTone: string
  customMessage: string | null
  nextTrigger: string | null
  status: string
  snoozeUntil: string | null
  visibleNote: string | null
}

export type ProposalItem = {
  id: string
  type: string
  newExpectedBy: string | null
  reason: string | null
  status: string
  proposedBy: string
}

export type ActivityItem = {
  type: string
  by: string
  message: string
  timestamp: string
}

export type TrustSummary = {
  paymentsOnTimeRatio: number
  communicationScore: string
  lastInteraction: string
  summary: string
}

export function listArrangements() {
  return api.get<ArrangementListItem[]>(`${P}/arrangements`)
}

export function getArrangement(id: string) {
  return api.get<ArrangementDetail>(`${P}/arrangements/${id}`)
}

export function createArrangement(data: CreateArrangementInput) {
  return api.post<{ id: string; status: string; message: string; createdAt: string }>(
    `${P}/arrangements`,
    data
  )
}

export function acceptArrangement(id: string) {
  return api.post<{ id: string; status: string; message: string }>(
    `${P}/arrangements/${id}/accept`
  )
}

export function getPayments(id: string) {
  return api.get<{ payments: PaymentItem[] }>(`${P}/arrangements/${id}/payments`)
}

export function recordPayment(
  arrangementId: string,
  data: { amount: number; paidOn?: string; note?: string }
) {
  return api.post<{
    paymentId: string
    status: string
    recordedBy: string
    message: string
  }>(`${P}/arrangements/${arrangementId}/payments`, data)
}

export function confirmPayment(paymentId: string, confirmed: boolean) {
  return api.post<{
    paymentId: string
    status: string
    balanceRemaining: number
    message: string
  }>(`${P}/payments/${paymentId}/confirm`, { confirmed })
}

export function getReminders(arrangementId: string) {
  return api.get<{ reminders: ReminderItem[] }>(
    `${P}/arrangements/${arrangementId}/reminders`
  )
}

export function createReminder(
  arrangementId: string,
  data: { schedule?: string; messageTone?: string; customMessage?: string }
) {
  return api.post<{ reminderId: string; nextTrigger: string; status: string }>(
    `${P}/arrangements/${arrangementId}/reminders`,
    data
  )
}

export function snoozeReminder(
  reminderId: string,
  data: { snoozeUntil?: string; reason?: string }
) {
  return api.post<{ reminderId: string; status: string; visibleNote: string }>(
    `${P}/reminders/${reminderId}/snooze`,
    data
  )
}

export function getProposals(arrangementId: string) {
  return api.get<{ proposals: ProposalItem[] }>(
    `${P}/arrangements/${arrangementId}/proposals`
  )
}

export function createProposal(
  arrangementId: string,
  data: { type: string; newExpectedBy?: string; reason?: string }
) {
  return api.post<{ proposalId: string; status: string; message: string }>(
    `${P}/arrangements/${arrangementId}/proposals`,
    data
  )
}

export function respondToProposal(proposalId: string, decision: "accept" | "reject") {
  return api.post<{
    proposalId: string
    status: string
    updatedExpectedBy?: string
  }>(`${P}/proposals/${proposalId}/respond`, { decision })
}

export function getActivity(arrangementId: string) {
  return api.get<ActivityItem[]>(`${P}/arrangements/${arrangementId}/activity`)
}

export function getTrustSummary(arrangementId: string) {
  return api.get<TrustSummary>(
    `${P}/arrangements/${arrangementId}/trust-summary`
  )
}

export function closeArrangement(arrangementId: string, message?: string) {
  return api.post<{ status: string; closedAt: string }>(
    `${P}/arrangements/${arrangementId}/close`,
    { message }
  )
}
