# Trust-Based Lending Manager

A gentle, transparent tool for managing informal lending between friends and family. No penalties, no interest, no legal pressure — just shared records, soft reminders, and clear communication.

**Focus:** Trust, transparency, and accountability in informal finance.

## Features

- **Arrangements** — Create lending arrangements by inviting someone via email (or pick from friends). Both parties see the same balance and history.
- **Payments** — Either party can record a payment; the lender confirms. You cannot record or confirm more than the amount owed; the UI enforces this.
- **Reminders** — Lenders can set gentle reminders. Borrowers can snooze with a reason. **Auto-reminders** run periodically and email the borrower when due.
- **Proposals** — Suggest changes (e.g. new “expected by” date). The other party accepts or rejects.
- **Activity log** — Every action is logged and visible to both participants.
- **Trust summary** — A simple, non-financial snapshot of communication and on-time payments.
- **Close** — When the balance is zero, either party can close the arrangement with a friendly note.
- **Profile** — View and edit your name and timezone. Profile tab in the nav.
- **Friends** — Add friends by email, accept/reject requests. Quick-select friends when creating arrangements.
- **OTP verification** — Signup requires email verification (OTP). Forgot-password flow uses OTP sent to email.

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
cp .env.example .env   # then set DATABASE_URL, JWT_SECRET, CORS_ORIGIN as needed
npm install
npx prisma generate
npx prisma db push
npm run start
```

The API runs at `http://localhost:3000`. Base path: `/api/v1`. `DATABASE_URL` is required (see `backend/.env.example`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment (optional)

- **Backend:** `DATABASE_URL` (required; see `backend/.env.example`), `JWT_SECRET`, `PORT`, `CORS_ORIGIN` (defaults work for local dev).
- **Email (OTP, reminders):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. If unset, OTP is logged to the console only (dev).
- **Frontend:** `VITE_API_URL` or `VITE_API_BASE_URL` — API base URL (default: `http://localhost:3000`).

After adding new schema (e.g. `FriendRequest`), run `npx prisma db push` in `backend`.

## Docker (single-image deployment)

Build and run the full stack (API + frontend) in one container:

```bash
docker build -t trust-lending .
docker run -p 3000:3000 \
  -v trust-lending-data:/app/data \
  -e CORS_ORIGIN="https://your-app.example.com" \
  -e JWT_SECRET="your-secret" \
  trust-lending
```

- App: `http://localhost:3000` (or your host).
- API: `http://localhost:3000/api/v1`.
- Health: `GET /api/v1/health`.

### CORS – one env var

**Configure CORS in a single place:** set **`CORS_ORIGIN`** to your app’s public URL.

| Where | What to set |
|-------|-------------|
| **Docker** | `-e CORS_ORIGIN="https://your-app.example.com"` |
| **Backend `.env`** | `CORS_ORIGIN=https://your-app.example.com` |

Use the URL users open in the browser (e.g. `https://app.example.com`). No other CORS config is needed.

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/auth/signup` | Create account (legacy) |
| POST | `/api/v1/auth/signup/request-otp` | Request OTP for signup |
| POST | `/api/v1/auth/signup/verify` | Verify OTP and create account |
| POST | `/api/v1/auth/forgot-password` | Request OTP for password reset |
| POST | `/api/v1/auth/reset-password` | Verify OTP and set new password |
| POST | `/api/v1/auth/login` | Sign in |
| POST | `/api/v1/auth/logout` | Sign out |
| GET | `/api/v1/me` | Profile (auth) |
| PATCH | `/api/v1/me` | Update profile (auth) |
| POST | `/api/v1/friends/request` | Send friend request (email) |
| GET | `/api/v1/friends/requests` | Incoming friend requests |
| POST | `/api/v1/friends/requests/:id/respond` | Accept/reject request |
| GET | `/api/v1/friends` | List friends |
| DELETE | `/api/v1/friends/:userId` | Remove friend |
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
