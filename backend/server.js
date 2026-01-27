import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const JWT_SECRET = "supersecretkey";

// See if the API is running
app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

// Authorization end points

// Register a user
app.post("/auth/register", async (req, res) => {
  const { name, email, password, timezone } = req.body;

  if (!name || !email || !password || !timezone) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, timezone },
    });
    res.json({ message: "User registered", userId: user.id });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });

  res.json({ userId: user.id, accessToken: token, message: "Welcome back" });
});

// Middleware to protect routes
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Arrangement end points

// Create arrangement (loan)
app.post("/arrangements", authMiddleware, async (req, res) => {
  const { title, totalAmount, currency, expectedBy, repaymentStyle, note, borrowerId } = req.body;

  if (!title || !totalAmount || !currency || !repaymentStyle || !borrowerId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const arrangement = await prisma.arrangement.create({
    data: {
      title,
      totalAmount,
      currency,
      expectedBy: expectedBy ? new Date(expectedBy) : null,
      repaymentStyle,
      note,
      lenderId: req.userId,
      borrowerId,
    },
  });

  res.json(arrangement);
});

// Get arrangement by id
app.get("/arrangements/:id", authMiddleware, async (req, res) => {
  const arrangementId = Number(req.params.id);
  if (isNaN(arrangementId)) return res.status(400).json({ error: "Invalid arrangement id" });

  const arrangement = await prisma.arrangement.findUnique({
    where: { id: arrangementId },
    include: { lender: true, borrower: true },
  });

  if (!arrangement) return res.status(404).json({ error: "Arrangement not found" });

  res.json(arrangement);
});

// Get all arrangements for a user
app.get("/users/:id/arrangements", authMiddleware, async (req, res) => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });

  const arrangements = await prisma.arrangement.findMany({
    where: { OR: [{ lenderId: userId }, { borrowerId: userId }] },
    include: { lender: true, borrower: true },
  });

  res.json(arrangements);
});

// Repayment
app.post("/repayments", async (req, res) => {
  const { arrangementId, amount } = req.body;

  // Optionally: check if the logged-in user is the borrower
  const arrangement = await prisma.arrangement.findUnique({
    where: { id: arrangementId },
  });

  if (!arrangement) {
    return res.status(404).json({ error: "Arrangement not found" });
  }

  // Only borrower can pay
  if (arrangement.borrowerId !== req.userId) {
    return res.status(403).json({ error: "Only borrower can repay" });
  }

  // Create repayment record
  const repayment = await prisma.repayment.create({
    data: { arrangementId, amount },
  });

  // Optionally update status
  const repayments = await prisma.repayment.findMany({
    where: { arrangementId },
  });
  const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);

  if (totalRepaid >= arrangement.totalAmount) {
    await prisma.arrangement.update({
      where: { id: arrangementId },
      data: { status: "closed" },
    });
  } else if (totalRepaid > 0) {
    await prisma.arrangement.update({
      where: { id: arrangementId },
      data: { status: "active" },
    });
  }

  res.json({ repayment, totalRepaid });
});

// Start the server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

