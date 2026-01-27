import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

app.post("/users", async (req, res) => {
  const { name, email } = req.body;

  const user = await prisma.user.create({
    data: { name, email },
  });

  res.json(user);
});

app.post("/loans", async (req, res) => {
  const { lenderId, borrowerId, amount, description } = req.body;

  const loan = await prisma.loan.create({
    data: {
      lenderId,
      borrowerId,
      amount,
      description,
    },
  });

  res.json(loan);
});

app.post("/repayments", async (req, res) => {
  const { loanId, amount } = req.body;

  const repayment = await prisma.repayment.create({
    data: {
      loanId,
      amount,
    },
  });

  res.json(repayment);
});

app.get("/loans/:id", async (req, res) => {
  const loanId = Number(req.params.id);

  if (isNaN(loanId)) {
    return res.status(400).json({ error: "Invalid loan id" });
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      lender: true,
      borrower: true,
      repayments: true,
    },
  });

  if (!loan) {
    return res.status(404).json({ error: "Loan not found" });
  }

  const totalRepaid = loan.repayments.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const remaining = loan.amount - totalRepaid;

  res.json({
    loanId: loan.id,
    lender: loan.lender.name,
    borrower: loan.borrower.name,
    amount: loan.amount,
    totalRepaid,
    remaining,
    status:
      remaining <= 0
        ? "paid"
        : totalRepaid > 0
        ? "partial"
        : "pending",
  });
});

app.get("/users/:id/loans", async (req, res) => {
  const userId = Number(req.params.id);

  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { lenderId: userId },
        { borrowerId: userId },
      ],
    },
    include: {
      lender: true,
      borrower: true,
      repayments: true,
    },
  });

  const formatted = loans.map((loan) => {
    const totalRepaid = loan.repayments.reduce(
      (sum, r) => sum + r.amount,
      0
    );

    return {
      loanId: loan.id,
      lender: loan.lender.name,
      borrower: loan.borrower.name,
      amount: loan.amount,
      totalRepaid,
      remaining: loan.amount - totalRepaid,
      status:
        totalRepaid === 0
          ? "pending"
          : totalRepaid >= loan.amount
          ? "paid"
          : "partial",
    };
  });

  res.json(formatted);
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
