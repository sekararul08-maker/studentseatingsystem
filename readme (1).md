# Smart Examination Hall Seating Allocation System

A full-stack web application for colleges/institutes to automatically allocate
students to examination halls and assign staff as invigilators, based on
examination dates, sessions, departments, hall capacity, and staff availability.

## 1. Project Overview

Three separate portals — **Admin**, **Staff**, **Student** — each with its own
login and permissions, backed by a single REST API and PostgreSQL database.
The core of the system is a configurable **smart seating algorithm** that only
allocates students whose department is actually writing a given exam session,
respects hall capacity, and supports three anti-cheating seating strategies
(department separation, mixed, alternating).

## 2. Features

- Role-based access control (Admin / Staff / Student) enforced server-side on every API route
- Department, Hall, Exam, and Staff management (full CRUD)
- Student register bulk import via Excel/CSV with validation, preview, and confirm-before-save
- Smart seating allocation: department-eligibility-aware, capacity-safe, transaction-atomic, never silently overwrites an existing allocation
- Three seating strategies: Department Separation, Mixed, Alternating
- Invigilator auto-assignment respecting staff availability and avoiding double-booking
- PDF seating slips (with QR code), hall-wise seating plans, student/staff reports
- Excel exports for student, staff duty, and hall-wise reports
- Full audit log of admin/staff actions
- Swagger/OpenAPI docs at `/api-docs`

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Axios, Tailwind CSS (via CDN), Vite |
| Backend | Node.js, Express.js, REST API |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| File processing | ExcelJS (xlsx), csv-parse (csv), Multer (upload) |
| Reports | PDFKit (PDF), ExcelJS (xlsx), qrcode |
| Docs | Swagger / OpenAPI |
| Containers | Docker, Docker Compose |
| Tests | Jest, Supertest |

## 4. Folder Structure

```
smart-examination-system/
├── frontend/            React app (Vite)
│   └── src/
│       ├── components/  Shared UI primitives (Table, Toast, ConfirmDialog...)
│       ├── pages/        admin/, staff/, and public pages
│       ├── layouts/      AdminLayout, StaffLayout
│       ├── services/     api.js (axios client)
│       ├── context/      AuthContext
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── algorithms/   seatingAlgorithm.js, invigilationAlgorithm.js (pure, unit-tested)
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/   auth, rbac, error handling, rate limiting
│   │   ├── validators/
│   │   ├── config/
│   │   └── server.js
│   └── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

## 5. Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use the provided Docker Compose setup)
- npm

## 6. Environment Variables

Copy `.env.example` to `backend/.env` and fill in real values:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_exam_db?schema=public
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=8h
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Never commit a real `.env` file. `JWT_SECRET` must be a long random string in production.

## 7. Installation (local, without Docker)

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Set up the database
cp ../.env.example .env    # then edit DATABASE_URL / JWT_SECRET
npx prisma migrate dev --name init
npm run prisma:seed

# 3. Start the backend
npm run dev                 # http://localhost:5000

# 4. In a separate terminal, start the frontend
cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```

## 8. Installation (Docker)

```bash
docker compose up --build
```

This starts PostgreSQL, runs migrations + seed automatically, then starts the
backend (port 5000) and the frontend (port 5173).

## 9. Default Development Logins

**Change these before production.**

| Role | Login ID | Password |
|---|---|---|
| Admin | `ADMIN001` | `Admin@123` |
| Staff | `STF101` (or STF102 ... STF115) | `Staff@123` |
| Student | any seeded register number, e.g. `23CSE001` | *(register-number lookup, no password)* |

## 10. How to Import Student Registers

1. Log in as Admin → **Student Register Upload**
2. Upload an `.xlsx` or `.csv` file with columns: `Register Number`, `Student Name`, `Department`, `Year` (optional: `Section`, `Batch`, `Email`)
3. Review the generated preview — rows with missing fields, duplicate register numbers, or unknown department codes are flagged and excluded
4. Click **Confirm & Import** — only the valid rows are inserted, inside a single database transaction

## 11. How to Generate a Seating Allocation

1. Create the exam first (**Exams** page), selecting which departments are writing it — only students in those departments become eligible
2. Go to **Seating Allocation**, pick the exam and a strategy (Separation / Mixed / Alternating)
3. Click **Generate Allocation** — this produces a **preview only**; nothing is saved yet
4. Review the halls used, student counts, and any conflicts
5. Click **Confirm & Save Allocation** (or **Replace Existing Allocation** if one already exists) — this is the only step that writes to the database, inside a transaction

## 12. How the Seating Algorithm Works

Implemented in `backend/src/algorithms/seatingAlgorithm.js` as a pure, side-effect-free function:

```
generateAllocation(exam, eligibleStudents, availableHalls, strategy)
  -> { success, hallsUsed, allocations, conflicts }
```

1. **Eligibility** — only students explicitly linked to the exam via the `ExamStudent` table are considered (populated from the departments selected at exam-creation time). A department not writing that session never appears.
2. **Hall selection** — halls are sorted largest-capacity-first and the *fewest* halls needed to seat everyone are chosen; unused halls stay untouched (never marked occupied "just because").
3. **Seat ordering** — depends on strategy:
   - **Separation**: whole department blocks, largest department first, so departments land in different halls where possible
   - **Alternating**: round-robin across departments so neighbouring seats differ; degrades gracefully when one department is much larger
   - **Mixed**: a deterministic shuffle across all eligible students
4. **Assignment** — students are assigned to a flat, ordered seat queue (hall → row → column), guaranteeing every student gets exactly one seat and no hall exceeds capacity.
5. **Integrity checks** — before returning success, the function re-verifies no duplicate students, no duplicate seats, and no hall over capacity.
6. **Persistence** — `allocation.service.js` re-runs this computation at confirm-time (never trusts a stale client-side result) and writes all `SeatingAllocation` rows inside one `$transaction` — either all rows are written or none are.

## 13. Running Tests

```bash
cd backend
npm install
npm test
```

Tests cover: admin/staff login, student lookup, department/hall creation and
delete-protection, hall capacity validation, exam department-eligibility,
duplicate-student prevention, staff double-booking prevention, and the full
seating + invigilation algorithms in isolation (no database required for the
algorithm tests — they're pure functions).

## 14. API Documentation

Once the backend is running: **http://localhost:5000/api-docs**

## 15. Production Build

```bash
# Backend
cd backend
npm install --omit=dev
npx prisma migrate deploy
npm start

# Frontend
cd frontend
npm install
npm run build     # outputs to frontend/dist — serve with any static host / nginx
```

## 16. Security Notes

- Passwords are hashed with bcrypt (never stored or transmitted in plaintext)
- JWT-based auth; every protected route enforces both authentication and role
- Rate limiting on all three login endpoints
- Helmet + CORS configured; Prisma parameterizes all queries (no raw SQL injection surface)
- Uploaded files are validated by extension and size before parsing
- `.env` is git-ignored; `.env.example` documents required variables only

## 17. Build Notes / Verification

This project was generated in 6 numbered stages (see the accompanying stage
files). Each stage's code was syntax-checked with `node --check`, and the
seating/invigilation algorithms were additionally executed directly against
the spec's own edge-case example (CSE 80 + ECE 60 + CIVIL 30 students across
8 halls with EEE/MECH excluded) to confirm correct behavior before being
finalized. A full `npm install` / `vite build` / `jest` run could not be
executed inside the sandbox this was built in (no outbound network access to
fetch npm packages) — run `npm install` and `npm test` yourself after
downloading to get a complete green build confirmation.
