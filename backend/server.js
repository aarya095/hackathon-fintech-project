import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { sendMail } from "./lib/email.js";

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const REMINDER_RATE_LIMIT_HOURS = Number(process.env.REMINDER_RATE_LIMIT_HOURS || 24);
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

async function getPendingPaymentSum(arrangementId) {
  const result = await prisma.payment.aggregate({
    where: {
      arrangementId,
      status: "pending_confirmation", // Only count pending, not rejected
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
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

// In-memory OTP store. Key: "email:purpose", value: { otp, expiresAt }
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 min

function generateOtp() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function setOtp(email, purpose, otp) {
  const key = `${email.toLowerCase().trim()}:${purpose}`;
  otpStore.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS });
}

function verifyOtp(email, purpose, otp) {
  const key = `${email.toLowerCase().trim()}:${purpose}`;
  const ent = otpStore.get(key);
  if (!ent || ent.expiresAt < Date.now()) return false;
  if (ent.otp !== String(otp).trim()) return false;
  otpStore.delete(key);
  return true;
}

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

api.post("/auth/signup/request-otp", async (req, res) => {
  const { email } = req.body;
  const em = typeof email === "string" ? email.trim() : "";
  if (!em) return res.status(400).json({ error: "Email is required" });

  const existing = await prisma.user.findUnique({ where: { email: em } });
  if (existing)
    return res.status(400).json({ error: "An account with this email already exists" });

  const otp = generateOtp();
  setOtp(em, "signup", otp);
  await sendMail(
    em,
    "Your verification code – Trust-based lending",
    `Your verification code is: ${otp}\n\nIt expires in 10 minutes.`
  );
  return res.json({ message: "Verification code sent to your email" });
});

api.post("/auth/signup/verify", async (req, res) => {
  const { email, otp, name, password, timezone } = req.body;
  const em = typeof email === "string" ? email.trim() : "";
  if (!em || !otp || !name || !password)
    return res.status(400).json({ error: "Email, OTP, name and password are required" });

  if (!verifyOtp(em, "signup", otp))
    return res.status(400).json({ error: "Invalid or expired verification code" });

  const existing = await prisma.user.findUnique({ where: { email: em } });
  if (existing)
    return res.status(400).json({ error: "An account with this email already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: em,
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

api.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  const em = typeof email === "string" ? email.trim() : "";
  if (!em) return res.status(400).json({ error: "Email is required" });

  const user = await prisma.user.findUnique({ where: { email: em } });
  if (!user) return res.status(404).json({ error: "No account found with this email" });

  const otp = generateOtp();
  setOtp(em, "reset", otp);
  await sendMail(
    em,
    "Reset your password – Trust-based lending",
    `Your verification code is: ${otp}\n\nIt expires in 10 minutes. Use it on the reset password page.`
  );
  return res.json({ message: "Verification code sent to your email" });
});

api.post("/auth/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const em = typeof email === "string" ? email.trim() : "";
  if (!em || !otp || !newPassword)
    return res.status(400).json({ error: "Email, OTP and new password are required" });

  if (!verifyOtp(em, "reset", otp))
    return res.status(400).json({ error: "Invalid or expired verification code" });

  const user = await prisma.user.findUnique({ where: { email: em } });
  if (!user) return res.status(404).json({ error: "No account found with this email" });

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });
  return res.json({ message: "Password reset successfully. You can sign in now." });
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

// ---------- Profile (me) ----------

api.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, timezone: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: String(user.id),
    name: user.name,
    email: user.email,
    timezone: user.timezone || "UTC",
  });
});

api.patch("/me", authMiddleware, async (req, res) => {
  const { name, timezone } = req.body;
  const data = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof timezone === "string") data.timezone = timezone.trim() || "UTC";
  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: "Provide name and/or timezone to update" });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: { id: true, name: true, email: true, timezone: true },
  });
  return res.json({
    id: String(user.id),
    name: user.name,
    email: user.email,
    timezone: user.timezone || "UTC",
  });
});

// ---------- Friends ----------

api.post("/friends/request", authMiddleware, async (req, res) => {
  const { email } = req.body;
  const toEmail = typeof email === "string" ? email.trim() : "";
  if (!toEmail) return res.status(400).json({ error: "Email is required" });

  const toUser = await prisma.user.findUnique({ where: { email: toEmail } });
  if (!toUser) return res.status(404).json({ error: "No user found with that email" });
  if (toUser.id === req.userId) return res.status(400).json({ error: "You cannot add yourself" });

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromId: req.userId, toId: toUser.id },
        { fromId: toUser.id, toId: req.userId },
      ],
    },
  });
  if (existing) {
    if (existing.status === "accepted")
      return res.status(400).json({ error: "You are already friends" });
    if (existing.fromId === req.userId && existing.status === "pending")
      return res.status(400).json({ error: "Request already sent" });
    if (existing.toId === req.userId && existing.status === "pending")
      return res.status(400).json({ error: "They already sent you a request. Check incoming." });
    return res.status(400).json({ error: "A request exists between you two" });
  }

  await prisma.friendRequest.create({
    data: { fromId: req.userId, toId: toUser.id, status: "pending" },
  });
  return res.status(201).json({
    message: "Friend request sent",
    to: { id: String(toUser.id), name: toUser.name, email: toUser.email },
  });
});

api.get("/friends/requests", authMiddleware, async (req, res) => {
  const rows = await prisma.friendRequest.findMany({
    where: { toId: req.userId, status: "pending" },
    include: { from: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const list = rows.map((r) => ({
    id: String(r.id),
    from: {
      id: String(r.from.id),
      name: r.from.name,
      email: r.from.email,
    },
    createdAt: r.createdAt,
  }));
  return res.json({ requests: list });
});

api.post("/friends/requests/:id/respond", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid request id" });
  const { decision } = req.body;
  if (!decision || !["accept", "reject"].includes(decision))
    return res.status(400).json({ error: "decision must be 'accept' or 'reject'" });

  const fr = await prisma.friendRequest.findUnique({
    where: { id },
    include: { from: true, to: true },
  });
  if (!fr) return res.status(404).json({ error: "Friend request not found" });
  if (fr.toId !== req.userId) return res.status(403).json({ error: "You can only respond to requests sent to you" });
  if (fr.status !== "pending") return res.status(400).json({ error: "Request already responded" });

  const status = decision === "accept" ? "accepted" : "rejected";
  await prisma.friendRequest.update({ where: { id }, data: { status } });
  return res.json({ status, message: decision === "accept" ? "You are now friends" : "Request rejected" });
});

api.get("/friends", authMiddleware, async (req, res) => {
  const accepted = await prisma.friendRequest.findMany({
    where: { status: "accepted" },
    include: { from: true, to: true },
  });
  const mine = accepted.filter((r) => r.fromId === req.userId || r.toId === req.userId);
  const list = mine.map((r) => {
    const other = r.fromId === req.userId ? r.to : r.from;
    return { id: String(other.id), name: other.name, email: other.email };
  });
  return res.json({ friends: list });
});

api.delete("/friends/:userId", authMiddleware, async (req, res) => {
  const friendId = Number(req.params.userId);
  if (isNaN(friendId)) return res.status(400).json({ error: "Invalid user id" });
  if (friendId === req.userId) return res.status(400).json({ error: "Cannot remove yourself" });

  const fr = await prisma.friendRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromId: req.userId, toId: friendId },
        { fromId: friendId, toId: req.userId },
      ],
    },
  });
  if (!fr) return res.status(404).json({ error: "Not friends with this user" });

  await prisma.friendRequest.delete({ where: { id: fr.id } });
  return res.json({ message: "Friend removed" });
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
  const amt = Number(amount);
  if (!amount || amt <= 0)
    return res.status(400).json({ error: "A positive amount is required" });

  const paid = await getPaidAmount(a.id);
  const pendingSum = await getPendingPaymentSum(a.id);
  const balanceRemaining = Math.max(0, a.totalAmount - paid);
  const maxAllowed = Math.max(0, balanceRemaining - pendingSum);
  if (amt > maxAllowed)
    return res.status(400).json({
      error:
        maxAllowed <= 0
          ? "Nothing left to pay. Balance is fully covered (including pending payments)."
          : `Amount cannot exceed ${maxAllowed.toFixed(2)} ${a.currency} (remaining after pending). You owe ${balanceRemaining.toFixed(2)} ${a.currency}.`,
    });

  const paidOnDate = paidOn ? new Date(paidOn) : new Date();

  const payment = await prisma.payment.create({
    data: {
      arrangementId: a.id,
      amount: amt,
      paidOn: paidOnDate,
      note: note || null,
      recordedById: req.userId,
      status: "pending_confirmation",
    },
  });

  if (req.isLender) {
    // Auto-confirm if lender records it (Wait, logic usually says lender recording = receipt = confirmed immediately?)
    // Checking previous logic... recordPayment usually creates 'pending_confirmation' if borrower, but if lender does it, it should probably be 'confirmed' or 'pending' depending on app logic.
    // The current app logic (lines 583-591 in previous view) creates it as 'pending_confirmation' even for lender? 
    // Wait, let's check recordPayment again from previous view. It sets status: 'pending_confirmation'.
    // BUT common sense says if Lender records it, they HAVE the money.
    // The previous implementation plan implies Lender Receipts are confirmed.
    // Let's UPDATE it to be 'confirmed' if isLender and check for auto-close.
    // Actually, looking at the code I saw, it just creates 'pending_confirmation'.
    // Optimizing: If Lender, set status 'confirmed', closedAt if 0.
    // ... Actually, to be safe and consistent with existing code, let's see if there is code handling lender recording specifically.
    // Line 594: `const recordedByRole = req.isLender ? "lender" : "borrower";`
    // I will stick to modifying the response/post-creation logic.

    // Actually, if lender records, we should mark as confirmed immediately.
    // But let's stick to the prompt's `confirmPayment` modification for now and `recordPayment` if previously agreed.
    // Plan said: "If req.isLender (auto-confirmed): Recalculate...".
    // So I need to set it to confirmed IF isLender.
  }

  // Re-reading file content of recordPayment (lines 559+).
  // It effectively makes it "pending_confirmation". 
  // I will change it to be "confirmed" if req.isLender.

  /* 
  Re-writing the whole `recordPayment` block is risky.
  Let's focus on:
  1. `recordPayment` -> if (req.isLender) { status: 'confirmed' } ... and then check auto-close.
  2. `confirmPayment` -> check auto-close.
  */

  if (req.isLender) {
    // Lender recording = Auto-confirmed
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "confirmed", confirmedAt: new Date(), confirmedById: req.userId },
    });

    // Check availability for auto-close
    // recalculate paid amount including this new payment
    const totalPaid = await getPaidAmount(a.id);
    const remaining = Math.max(0, a.totalAmount - totalPaid);

    if (remaining <= 0) {
      await prisma.arrangement.update({
        where: { id: a.id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closedMessage: "Auto-closed: Payment confirmed & balance settled."
        },
      });
      await prisma.activity.create({
        data: {
          arrangementId: a.id,
          type: "arrangement_closed",
          actorRole: "system",
          message: "Arrangement auto-closed: All money returned."
        },
      });
    }
  }

  const recordedByRole = req.isLender ? "lender" : "borrower";
  await prisma.activity.create({
    data: {
      arrangementId: a.id,
      type: "payment_recorded",
      actorRole: recordedByRole,
      message: `${formatAmount(amt, a.currency)} recorded — awaiting confirmation`,
    },
  });

  return res.status(201).json({
    paymentId: String(payment.id),
    status: req.isLender ? "confirmed" : "pending_confirmation",
    recordedBy: recordedByRole,
    message: req.isLender ? "Receipt recorded & confirmed" : "Payment recorded and awaiting confirmation",
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

  const paid = await getPaidAmount(payment.arrangementId);
  const wouldBeTotal = paid + payment.amount;
  if (wouldBeTotal > payment.arrangement.totalAmount)
    return res.status(400).json({
      error: `Confirming this payment would exceed the arrangement total (${formatAmount(payment.arrangement.totalAmount, payment.arrangement.currency)}). Maximum confirmable: ${formatAmount(Math.max(0, payment.arrangement.totalAmount - paid), payment.arrangement.currency)}.`,
    });

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

  if (balanceRemaining <= 0) {
    await prisma.arrangement.update({
      where: { id: payment.arrangementId },
      data: {
        status: "closed",
        closedAt: new Date(),
        closedMessage: "Auto-closed: Payment confirmed & balance settled."
      },
    });
    await prisma.activity.create({
      data: {
        arrangementId: payment.arrangementId,
        type: "arrangement_closed",
        actorRole: "system",
        message: "Arrangement auto-closed: All money returned."
      },
    });
  }

  return res.json({
    paymentId: String(payment.id),
    status: "confirmed",
    balanceRemaining,
    message: "Payment confirmed successfully",
  });
});

api.post("/payments/:paymentId/reject", authMiddleware, async (req, res) => {
  const pid = Number(req.params.paymentId);
  if (isNaN(pid)) return res.status(400).json({ error: "Invalid payment id" });

  const payment = await prisma.payment.findUnique({
    where: { id: pid },
    include: { arrangement: true },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  if (payment.arrangement.lenderId !== req.userId)
    return res.status(403).json({ error: "Only the lender can reject payments" });
  if (payment.status === "confirmed")
    return res.status(400).json({ error: "Cannot reject a confirmed payment" });
  if (payment.status === "rejected")
    return res.status(400).json({ error: "Payment is already rejected" });

  await prisma.payment.update({
    where: { id: pid },
    data: {
      status: "rejected",
      confirmedAt: null,
      confirmedById: null,
    },
  });

  await prisma.activity.create({
    data: {
      arrangementId: payment.arrangementId,
      type: "payment_rejected",
      actorRole: "lender",
      message: `${formatAmount(payment.amount, payment.arrangement.currency)} rejected — payment not received`,
    },
  });

  const balanceRemaining = await getBalanceRemaining(payment.arrangement);

  return res.json({
    paymentId: String(payment.id),
    status: "rejected",
    balanceRemaining,
    message: "Payment rejected",
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

  // Singleton logic: Deactivate ALL existing active/snoozed reminders for this arrangement
  await prisma.reminder.updateMany({
    where: {
      arrangementId: a.id,
      status: { in: ["active", "snoozed"] }
    },
    data: { status: "inactive" }
  });

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

api.post("/arrangements/:id/reminders/manual", requireParticipant, async (req, res) => {
  const a = req.arrangement;
  if (!req.isLender)
    return res.status(403).json({ error: "Only the lender can send manual reminders" });
  if (a.status === "closed")
    return res.status(400).json({ error: "Cannot remind for a closed arrangement" });

  const now = new Date();
  if (a.lastRemindedAt) {
    const hoursSince = (now.getTime() - new Date(a.lastRemindedAt).getTime()) / (1000 * 60 * 60);
    if (REMINDER_RATE_LIMIT_HOURS > 0 && hoursSince < REMINDER_RATE_LIMIT_HOURS) {
      return res.status(429).json({
        error: `Please wait ${Math.ceil(REMINDER_RATE_LIMIT_HOURS - hoursSince)}h before sending another reminder.`
      });
    }
  }

  const borrowerEmail = a.borrower.email;
  const lenderName = a.lender.name;
  const title = a.title;
  const msg = req.body.customMessage || "Just a gentle reminder — no rush. 🙂";
  const body = `Hi,\n\n${lenderName} sent you a manual reminder about "${title}":\n\n"${msg}"\n\nLog in to view details.\n\n— Trust-based lending`;

  try {
    await sendMail(borrowerEmail, `Reminder: ${title} — Trust-based lending`, body);
    await prisma.arrangement.update({
      where: { id: a.id },
      data: { lastRemindedAt: now },
    });
    await prisma.activity.create({
      data: {
        arrangementId: a.id,
        type: "reminder_sent",
        actorRole: "lender",
        message: "Manual reminder sent"
      }
    });
    return res.json({ status: "sent", message: "Reminder sent successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to send email" });
  }
});

api.delete("/reminders/:id", authMiddleware, async (req, res) => {
  const rid = Number(req.params.id);
  // Include arrangement to check permissions
  const reminder = await prisma.reminder.findUnique({
    where: { id: rid },
    include: { arrangement: true }
  });
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });

  if (reminder.arrangement.lenderId !== req.userId) {
    return res.status(403).json({ error: "Only lender can delete reminders" });
  }

  await prisma.reminder.update({
    where: { id: rid },
    data: { status: "inactive" }
  });

  return res.json({ status: "inactive", message: "Reminder turned off" });
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

// ---------- Auto-reminders (cron) ----------

async function processDueReminders() {
  const now = new Date();
  const reminders = await prisma.reminder.findMany({
    where: {
      nextTrigger: { lte: now },
      OR: [
        { status: "active" },
        {
          status: "snoozed",
          snoozeUntil: { lte: now },
        },
      ],
    },
    include: {
      arrangement: {
        include: { lender: true, borrower: true },
      },
    },
  });

  for (const r of reminders) {
    try {
      const arr = r.arrangement;
      if (arr.status === "closed") continue;

      // Rate limit check for auto-reminders too
      if (arr.lastRemindedAt) {
        const hoursSince = (Date.now() - new Date(arr.lastRemindedAt).getTime()) / (1000 * 60 * 60);
        if (REMINDER_RATE_LIMIT_HOURS > 0 && hoursSince < REMINDER_RATE_LIMIT_HOURS) {
          // Skip this cycle, try again next time (wait until limit expires)
          continue;
        }
      }

      const borrowerEmail = arr.borrower.email;
      const lenderName = arr.lender.name;
      const title = arr.title;
      const msg = r.customMessage || "Just a gentle reminder — no rush. 🙂";
      const body = `Hi,\n\n${lenderName} sent you a reminder about "${title}":\n\n"${msg}"\n\nLog in to view details or snooze the reminder.\n\n— Trust-based lending`;
      await sendMail(
        borrowerEmail,
        `Reminder: ${title} — Trust-based lending`,
        body
      );

      // Update lastRemindedAt on arrangement
      await prisma.arrangement.update({
        where: { id: arr.id },
        data: { lastRemindedAt: new Date() } // Use current time
      });

      let next = new Date(now);
      if (r.schedule === "monthly") next.setMonth(next.getMonth() + 1);
      else if (r.schedule === "weekly") next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 7);

      await prisma.reminder.update({
        where: { id: r.id },
        data: {
          nextTrigger: next,
          status: "active",
          snoozeUntil: null,
          visibleNote: null,
        },
      });
    } catch (e) {
      console.error("[processDueReminders] reminder id", r.id, e);
    }
  }
}

// Run every 60s; also run once shortly after startup
setInterval(processDueReminders, 60_000);
setTimeout(processDueReminders, 5_000);

// Mount API
app.use("/api/v1", api);

// Serve frontend (production Docker build)
const publicDir = path.join(process.cwd(), "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
  app.get(/(.*)/s, (req, res, next) => {
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
