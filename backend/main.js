const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: { name: "Alice", email: "alice@example.com" },
  });

  const loan = await prisma.loan.create({
    data: {
      lenderId: user.id,
      borrowerId: user.id,
      amount: 100,
      description: "Lunch loan",
    },
  });

  const repayment = await prisma.repayment.create({
    data: {
      loanId: loan.id,
      amount: 50,
    },
  });

  console.log({ user, loan, repayment });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

