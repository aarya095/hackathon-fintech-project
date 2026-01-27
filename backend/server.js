import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const PORT = process.env.PORT || 3000;

/**
 * CORS origin – single env var for deployment.
 * Set CORS_ORIGIN to your app's public URL (e.g. https://app.example.com).
 * Dev default: http://localhost:5173
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount, currency = "INR") {
  if (currency === "INR") return `₹${Number(amount).toLocaleString("en-IN")}`;
  return `${currency} ${Number(amount).toLocaleString()}`;
}

async function getPaidAmount(arrangementId) {
  const confirmed = await prisma.payment.aggregate({
    where: {
      arrangementId,
      status: "confirmed",
    },
    _sum: { amount: true },
  });
  return confirmed._sum.amount ?? 0;
}

async function getBalanceRemaining(arrangement) {
  const paid = await getPaidAmount(arrangement.id);
  return Math.max(0, arrangement.totalAmount - paid);
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireParticipant = (req, res, next) => {
  const arrangement = req.arrangement;
  const userId = req.userId;
  const isLender = arrangement.lenderId === userId;
  const isBorrower = arrangement.borrowerId === userId;
  if (!isLender && !isBorrower)
    return res.status(403).json({ error: "You are not part of this arrangement" });
  req.role = isLender ? "lender" : "borrower";
  req.isLender = isLender;
  req.isBorrower = isBorrower;
  next();
};

// ---------------------------------------------------------------------------
// Routes: /api/v1
// ---------------------------------------------------------------------------

const api = express.Router();

api.get("/health", (req, res) => {
  res.json({ status: "ok", version: "v1", base: "/api/v1" });
});

// ---------- Auth ----------

api.post("/auth/signup", async (req, res) => {
  const { name, email, password, timezone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required" });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return res.status(400).json({ error: "An account with this email already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      timezone: timezone || "UTC",
    },
  });

  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  return res.status(201).json({
    userId: String(user.id),
    accessToken,
    message: "Account created successfully",
  });
});

api.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  return res.json({
    userId: String(user.id),
    accessToken,
    message: "Welcome back",
  });
});

api.post("/auth/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// ---------- Arrangements ----------

api.post("/arrangements", authMiddleware, async (req, res) => {
  const { title, totalAmount, currency, borrowerEmail, expectedBy, repaymentStyle, note } = req.body;

  if (!title || !totalAmount || !repaymentStyle)
    return res.status(400).json({ error: "Title, totalAmount and repaymentStyle are required" });
  if (!borrowerEmail)
    return res.status(400).json({ error: "borrowerEmail is required to send an invitation" });

  const borrower = await prisma.user.findUnique({ where: { email: borrowerEmail.trim() } });
  if (!borrower)
    return res.status(404).json({ error: "No user found with that email. They need to sign up first." });

  if (borrower.id === req.userId)
    return res.status(400).json({ error: "You cannot create an arrangement with yourself" });

  const arrangement = await prisma.arrangement.create({
    data: {
      title,
      totalAmount: Number(totalAmount),
      currency: currency || "INR",
      expectedBy: expectedBy ? new Date(expectedBy) : null,
      repaymentStyle,
      note: note || null,
      lenderId: req.userId,
      borrowerId: borrower.id,
      status: "pending",
    },
    include: { lender: true, borrower: true },
  });

  await prisma.activity.create({
    data: {
      arrangementId: arrangement.id,
      type: "arrangement_created",
      actorRole: "lender",
      message: `"${arrangement.title}" created — invitation sent to ${arrangement.borrower.email}`,
    },
  });

  return res.status(201).json({
    id: String(arrangement.id),
    status: arrangement.status,
    message: "Invitation sent to borrower",
    createdAt: arrangement.createdAt,
  });
});

api.get("/arrangements", authMiddleware, async (req, res) => {
  const rows = await prisma.arrangement.findMany({
    where: {
      OR: [{ lenderId: req.userId }, { borrowerId: req.userId }],
    },
    include: { lender: true, borrower: true },
    orderBy: { id: "desc" },
  });

  const list = [];
  for (const a of rows) {
    const paid = await getPaidAmount(a.id);
    const balanceRemaining = Math.max(0, a.totalAmount - paid);
    const role = a.lenderId === req.userId ? "lender" : "borrower";
    list.push({
      id: String(a.id),
      title: a.title,
      role,
      totalAmount: a.totalAmount,
      balanceRemaining,
      status: a.status,
      currency: a.currency,
    });
  }

  return res.json(list);
});

// Load arrangement and require participant
api.use("/arrangements/:id", authMiddleware, async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid arrangement id" });
  const arrangement = await prisma.arrangement.findUnique({
    where: { id },
    include: { lender: true, borrower: true },
  });
  if (!arrangement) return res.status(404).json({ error: "Arrangement not found" });
  req.arrangement = arrangement;
  next();
});

api.get("/arrangements/:id", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  const paid = await getPaidAmount(a.id);
  const balanceRemaining = Math.max(0, a.totalAmount - paid);

  const participants = [
    { userId: String(a.lenderId), role: "lender", name: a.lender.name },
    { userId: String(a.borrowerId), role: "borrower", name: a.borrower.name },
  ];

  return res.json({
    id: String(a.id),
    title: a.title,
    totalAmount: a.totalAmount,
    paidAmount: paid,
    balanceRemaining,
    expectedBy: a.expectedBy,
    repaymentStyle: a.repaymentStyle,
    participants,
    note: a.note,
    status: a.status,
    currency: a.currency,
  });
});

// Accept invitation (borrower only)
api.post("/arrangements/:id/accept", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (req.role !== "borrower")
    return res.status(403).json({ error: "Only the borrower can accept the invitation" });
  if (a.status !== "pending")
    return res.status(400).json({ error: "This arrangement is not pending acceptance" });

  await prisma.arrangement.update({
    where: { id: a.id },
    data: { status: "active" },
  });

  await prisma.activity.create({
    data: {
      arrangementId: a.id,
      type: "arrangement_accepted",
      actorRole: "borrower",
      message: "Joined the arrangement — both parties are now active",
    },
  });

  return res.json({
    id: String(a.id),
    status: "active",
    message: "You've joined this arrangement. You're all set.",
  });
});

// ---------- Payments ----------

api.post("/arrangements/:id/payments", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (a.status === "closed")
    return res.status(400).json({ error: "Cannot add payments to a closed arrangement" });

  const { amount, paidOn, note } = req.body;
  if (!amount || Number(amount) <= 0)
    return res.status(400).json({ error: "A positive amount is required" });

  const paidOnDate = paidOn ? new Date(paidOn) : new Date();

  const payment = await prisma.payment.create({
    data: {
      arrangementId: a.id,
      amount: Number(amount),
      paidOn: paidOnDate,
      note: note || null,
      recordedById: req.userId,
      status: "pending_confirmation",
    },
  });

  const recordedByRole = req.isLender ? "lender" : "borrower";
  await prisma.activity.create({
    data: {
      arrangementId: a.id,
      type: "payment_recorded",
      actorRole: recordedByRole,
      message: `${formatAmount(amount, a.currency)} recorded — awaiting confirmation`,
    },
  });

  return res.status(201).json({
    paymentId: String(payment.id),
    status: "pending_confirmation",
    recordedBy: recordedByRole,
    message: "Payment recorded and awaiting confirmation",
  });
});

api.get("/arrangements/:id/payments", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  const payments = await prisma.payment.findMany({
    where: { arrangementId: a.id },
    orderBy: { paidOn: "desc" },
    include: { recordedBy: { select: { id: true, name: true } } },
  });
  const list = payments.map((p) => ({
    id: String(p.id),
    amount: p.amount,
    paidOn: p.paidOn,
    note: p.note,
    status: p.status,
    recordedBy: p.recordedBy.name,
  }));
  return res.json({ payments: list });
});

api.post("/payments/:paymentId/confirm", authMiddleware, async (req, res) => {
  const pid = Number(req.params.paymentId);
  if (isNaN(pid)) return res.status(400).json({ error: "Invalid payment id" });

  const payment = await prisma.payment.findUnique({
    where: { id: pid },
    include: { arrangement: true },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  if (payment.arrangement.lenderId !== req.userId)
    return res.status(403).json({ error: "Only the lender can confirm payments" });
  if (payment.status === "confirmed")
    return res.status(400).json({ error: "Payment is already confirmed" });

  await prisma.payment.update({
    where: { id: pid },
    data: {
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedById: req.userId,
    },
  });

  await prisma.activity.create({
    data: {
      arrangementId: payment.arrangementId,
      type: "payment_confirmed",
      actorRole: "lender",
      message: `${formatAmount(payment.amount, payment.arrangement.currency)} confirmed`,
    },
  });

  const balanceRemaining = await getBalanceRemaining(payment.arrangement);

  return res.json({
    paymentId: String(payment.id),
    status: "confirmed",
    balanceRemaining,
    message: "Payment confirmed successfully",
  });
});

// ---------- Reminders ----------

api.post("/arrangements/:id/reminders", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (!req.isLender)
    return res.status(403).json({ error: "Only the lender can create reminders" });
  if (a.status === "closed")
    return res.status(400).json({ error: "Cannot add reminders to a closed arrangement" });

  const { schedule, messageTone, customMessage } = req.body;
  const scheduleVal = schedule || "monthly";
  const tone = messageTone || "gentle";
  let nextTrigger = new Date();
  if (scheduleVal === "monthly") {
    nextTrigger.setMonth(nextTrigger.getMonth() + 1);
  } else if (scheduleVal === "weekly") {
    nextTrigger.setDate(nextTrigger.getDate() + 7);
  }

  const reminder = await prisma.reminder.create({
    data: {
      arrangementId: a.id,
      schedule: scheduleVal,
      messageTone: tone,
      customMessage: customMessage || null,
      nextTrigger,
      createdById: req.userId,
      status: "active",
    },
  });

  return res.status(201).json({
    reminderId: String(reminder.id),
    nextTrigger: reminder.nextTrigger,
    status: "active",
  });
});

api.post("/reminders/:id/snooze", authMiddleware, async (req, res) => {
  const rid = Number(req.params.id);
  if (isNaN(rid)) return res.status(400).json({ error: "Invalid reminder id" });

  const reminder = await prisma.reminder.findUnique({
    where: { id: rid },
    include: { arrangement: true },
  });
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });
  if (reminder.arrangement.borrowerId !== req.userId)
    return res.status(403).json({ error: "Only the borrower can snooze reminders" });

  const { snoozeUntil, reason } = req.body;
  const until = snoozeUntil ? new Date(snoozeUntil) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.reminder.update({
    where: { id: rid },
    data: {
      status: "snoozed",
      snoozeUntil: until,
      visibleNote: reason || "Snoozed",
    },
  });

  return res.json({
    reminderId: String(reminder.id),
    status: "snoozed",
    visibleNote: reason || "Snoozed",
  });
});

api.get("/arrangements/:id/reminders", requireParticipant, async (req, res) => {
  const reminders = await prisma.reminder.findMany({
    where: { arrangementId: req.arrangement.id },
    orderBy: { id: "desc" },
  });
  const list = reminders.map((r) => ({
    id: String(r.id),
    schedule: r.schedule,
    messageTone: r.messageTone,
    customMessage: r.customMessage,
    nextTrigger: r.nextTrigger,
    status: r.status,
    snoozeUntil: r.snoozeUntil,
    visibleNote: r.visibleNote,
  }));
  return res.json({ reminders: list });
});

// ---------- Proposals ----------

api.post("/arrangements/:id/proposals", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (a.status === "closed")
    return res.status(400).json({ error: "Cannot create proposals for a closed arrangement" });

  const { type, newExpectedBy, reason } = req.body;
  if (!type) return res.status(400).json({ error: "Proposal type is required" });

  const proposal = await prisma.proposal.create({
    data: {
      arrangementId: a.id,
      type,
      newExpectedBy: newExpectedBy ? new Date(newExpectedBy) : null,
      reason: reason || null,
      proposedById: req.userId,
      status: "pending",
    },
  });

  return res.status(201).json({
    proposalId: String(proposal.id),
    status: "pending",
    message: "Proposal sent for review",
  });
});

api.post("/proposals/:proposalId/respond", authMiddleware, async (req, res) => {
  const pid = Number(req.params.proposalId);
  if (isNaN(pid)) return res.status(400).json({ error: "Invalid proposal id" });

  const proposal = await prisma.proposal.findUnique({
    where: { id: pid },
    include: { arrangement: true },
  });
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });

  const isLender = proposal.arrangement.lenderId === req.userId;
  const isBorrower = proposal.arrangement.borrowerId === req.userId;
  if (!isLender && !isBorrower)
    return res.status(403).json({ error: "You are not part of this arrangement" });
  if (proposal.proposedById === req.userId)
    return res.status(400).json({ error: "You cannot respond to your own proposal" });

  const { decision } = req.body;
  if (!decision || !["accept", "reject"].includes(decision))
    return res.status(400).json({ error: "decision must be 'accept' or 'reject'" });

  const status = decision === "accept" ? "accepted" : "rejected";
  await prisma.proposal.update({
    where: { id: pid },
    data: { status },
  });

  let updatedExpectedBy = null;
  if (decision === "accept" && proposal.type === "expectedByChange" && proposal.newExpectedBy) {
    await prisma.arrangement.update({
      where: { id: proposal.arrangementId },
      data: { expectedBy: proposal.newExpectedBy },
    });
    updatedExpectedBy = proposal.newExpectedBy;
  }

  const actorRole = isLender ? "lender" : "borrower";
  await prisma.activity.create({
    data: {
      arrangementId: proposal.arrangementId,
      type: "proposal_responded",
      actorRole,
      message: `Proposal (${proposal.type}) ${status}`,
      metadata: JSON.stringify({ proposalId: proposal.id, decision, updatedExpectedBy }),
    },
  });

  return res.json({
    proposalId: String(proposal.id),
    status,
    updatedExpectedBy: updatedExpectedBy || undefined,
  });
});

api.get("/arrangements/:id/proposals", requireParticipant, async (req, res) => {
  const proposals = await prisma.proposal.findMany({
    where: { arrangementId: req.arrangement.id },
    orderBy: { id: "desc" },
    include: { proposedBy: { select: { id: true, name: true } } },
  });
  const list = proposals.map((p) => ({
    id: String(p.id),
    type: p.type,
    newExpectedBy: p.newExpectedBy,
    reason: p.reason,
    status: p.status,
    proposedBy: p.proposedBy.name,
  }));
  return res.json({ proposals: list });
});

// ---------- Activity ----------

api.get("/arrangements/:id/activity", requireParticipant, async (req, res) => {
  const rows = await prisma.activity.findMany({
    where: { arrangementId: req.arrangement.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const list = rows.map((r) => ({
    type: r.type,
    by: r.actorRole,
    message: r.message,
    timestamp: r.createdAt,
  }));

  return res.json(list);
});

// ---------- Trust summary ----------

api.get("/arrangements/:id/trust-summary", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  const payments = await prisma.payment.findMany({
    where: { arrangementId: a.id, status: "confirmed" },
    orderBy: { paidOn: "asc" },
  });

  const activities = await prisma.activity.findMany({
    where: { arrangementId: a.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let paymentsOnTimeRatio = 1;
  if (a.expectedBy && payments.length) {
    const onTime = payments.filter((p) => p.paidOn <= a.expectedBy).length;
    paymentsOnTimeRatio = Math.round((onTime / payments.length) * 100) / 100;
  }

  const recentCount = activities.filter(
    (x) => x.type === "payment_recorded" || x.type === "payment_confirmed" || x.type.includes("proposal")
  ).length;
  let communicationScore = "good";
  if (recentCount >= 5) communicationScore = "excellent";
  else if (recentCount <= 1) communicationScore = "limited";

  const lastAct = activities[0];
  const lastInteraction = (lastAct ? lastAct.createdAt : a.createdAt).toISOString().slice(0, 10);

  let summary = "Healthy and communicative arrangement";
  if (communicationScore === "excellent") summary = "Very responsive — great communication";
  else if (communicationScore === "limited") summary = "Consider checking in gently when comfortable";

  return res.json({
    paymentsOnTimeRatio,
    communicationScore,
    lastInteraction,
    summary,
  });
});

// ---------- Close arrangement ----------

api.post("/arrangements/:id/close", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (a.status === "closed")
    return res.status(400).json({ error: "This arrangement is already closed" });

  const paid = await getPaidAmount(a.id);
  const remaining = Math.max(0, a.totalAmount - paid);
  if (remaining > 0)
    return res
      .status(400)
      .json({ error: "Cannot close while there is a remaining balance. Record and confirm all payments first." });

  const { message } = req.body;
  const closedAt = new Date();

  await prisma.arrangement.update({
    where: { id: a.id },
    data: {
      status: "closed",
      closedAt,
      closedMessage: message || null,
    },
  });

  await prisma.activity.create({
    data: {
      arrangementId: a.id,
      type: "arrangement_closed",
      actorRole: req.role,
      message: message || "Arrangement closed. All settled.",
    },
  });

  return res.json({
    status: "closed",
    closedAt,
  });
});

// Mount API
app.use("/api/v1", api);

// Serve frontend (production Docker build)
const publicDir = path.join(process.cwd(), "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// Start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
});
