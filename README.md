# Trust-Based Lending Manager

A gentle, transparent tool for managing informal lending between friends and family. No penalties, no interest, no legal pressure — just shared records, soft reminders, and clear communication.

**Focus:** Trust, transparency, and accountability in informal finance.

## Features

- **Arrangements** — Create lending arrangements by inviting someone via email. Both parties see the same balance and history.
- **Payments** — Either party can record a payment; the lender confirms. Full transparency.
- **Reminders** — Lenders can set gentle reminders. Borrowers can snooze with a reason.
- **Proposals** — Suggest changes (e.g. new “expected by” date). The other party accepts or rejects.
- **Activity log** — Every action is logged and visible to both participants.
- **Trust summary** — A simple, non-financial snapshot of communication and on-time payments.
- **Close** — When the balance is zero, either party can close the arrangement with a friendly note.

## Tech Stack

- **Backend:** Node.js, Express, Prisma, SQLite, JWT
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand

## Setup

### Prerequisites

- Node.js 18+
- npm (or pnpm / yarn)

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start
```

The API runs at `http://localhost:3000`. Base path: `/api/v1`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment (optional)

- **Backend:** `JWT_SECRET`, `PORT`, `CORS_ORIGIN` (defaults work for local dev).
- **Frontend:** `VITE_API_URL` or `VITE_API_BASE_URL` — API base URL (default: `http://localhost:3000`).

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Create account |
| POST | `/api/v1/auth/login` | Sign in |
| POST | `/api/v1/auth/logout` | Sign out |
| GET | `/api/v1/arrangements` | List your arrangements |
| POST | `/api/v1/arrangements` | Create arrangement (invite by email) |
| GET | `/api/v1/arrangements/:id` | Arrangement details |
| POST | `/api/v1/arrangements/:id/accept` | Borrower accepts invitation |
| GET | `/api/v1/arrangements/:id/payments` | List payments |
| POST | `/api/v1/arrangements/:id/payments` | Record payment |
| POST | `/api/v1/payments/:id/confirm` | Lender confirms payment |
| GET | `/api/v1/arrangements/:id/reminders` | List reminders |
| POST | `/api/v1/arrangements/:id/reminders` | Create reminder (lender) |
| POST | `/api/v1/reminders/:id/snooze` | Snooze reminder (borrower) |
| GET | `/api/v1/arrangements/:id/proposals` | List proposals |
| POST | `/api/v1/arrangements/:id/proposals` | Create proposal |
| POST | `/api/v1/proposals/:id/respond` | Respond to proposal |
| GET | `/api/v1/arrangements/:id/activity` | Activity log |
| GET | `/api/v1/arrangements/:id/trust-summary` | Trust summary |
| POST | `/api/v1/arrangements/:id/close` | Close arrangement |

All arrangement, payment, reminder, and activity endpoints require `Authorization: Bearer <token>`.

## Design Principles

- **Trust first** — No penalties, interest, or legal enforcement. All data is visible to both parties.
- **Transparency** — Every action is logged. Both see the same balance and history.
- **Soft accountability** — Gentle reminders, snooze with reasons, payments confirmed by the lender.
- **Human language** — We use “arrangement,” “borrower,” “expected by.” No “debt,” “loan,” or “penalty.”

Trust is the feature.
