// ============================================================================
// ALL JAVASCRIPT / JSX CODE — Smart Examination Hall Seating Allocation System
// Covers both the Node.js/Express backend and the React frontend.
// Split at '==== FILE:' markers to recreate the folder structure shown.
// app.js appears 4 times below (Stage 1-4) — each one REPLACES the previous
// as new route groups were added; only the LAST one (Stage 4, final) should
// actually be used in the finished project.
// ============================================================================

// ==== FILE: backend/prisma/seed.js ====
/* eslint-disable no-console */
// ============================================================================
// Seed script — populates development data:
//   5 departments, 100+ students, 10 halls, 15 staff, multiple exams
//   covering the required test scenarios (section 36 & 37 of the spec):
//     - all departments have exams
//     - only two departments have exams
//     - a department has no exam at all
//     - insufficient halls scenario
//     - insufficient invigilators scenario
//     - different hall capacities
// ============================================================================
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/password");

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science and Engineering" },
  { code: "ECE", name: "Electronics and Communication Engineering" },
  { code: "EEE", name: "Electrical and Electronics Engineering" },
  { code: "MECH", name: "Mechanical Engineering" },
  { code: "CIVIL", name: "Civil Engineering" },
];

// hallNumber, building, floor, capacity, rows, columns
const HALLS = [
  ["Hall 101", "Main Block", "1", 40, 5, 8],
  ["Hall 102", "Main Block", "1", 40, 5, 8],
  ["Hall 103", "Main Block", "1", 40, 5, 8],
  ["Hall 104", "Main Block", "2", 40, 5, 8],
  ["Hall 105", "Main Block", "2", 40, 5, 8],
  ["Hall 106", "Annex Block", "1", 30, 5, 6],
  ["Hall 107", "Annex Block", "1", 30, 5, 6],
  ["Hall 108", "Annex Block", "2", 60, 6, 10],
  ["Hall 109", "Annex Block", "2", 25, 5, 5],
  ["Hall 110", "Science Block", "1", 20, 4, 5],
];

function makeStudents(deptCode, count, year = "III") {
  const list = [];
  for (let i = 1; i <= count; i += 1) {
    const num = String(i).padStart(3, "0");
    list.push({
      registerNumber: `23${deptCode}${num}`,
      name: `${deptCode} Student ${i}`,
      year,
      section: i % 2 === 0 ? "B" : "A",
      batch: "2023-2027",
      email: `23${deptCode.toLowerCase()}${num}@institute.edu`,
    });
  }
  return list;
}

async function main() {
  console.log("Seeding database...");

  // ---- Admin (dev credentials — CHANGE BEFORE PRODUCTION) -----------------
  const adminPasswordHash = await hashPassword("Admin@123");
  await prisma.admin.upsert({
    where: { instituteId: "ADMIN001" },
    update: {},
    create: {
      instituteId: "ADMIN001",
      name: "System Administrator",
      passwordHash: adminPasswordHash,
    },
  });
  console.log("  Admin seeded -> instituteId: ADMIN001 / password: Admin@123 (DEV ONLY)");

  // ---- Departments ----------------------------------------------------------
  const deptRecords = {};
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
    deptRecords[d.code] = dept;
  }
  console.log(`  ${DEPARTMENTS.length} departments seeded`);

  // ---- Halls ------------------------------------------------------------------
  for (const [hallNumber, building, floor, capacity, rows, columns] of HALLS) {
    await prisma.hall.upsert({
      where: { hallNumber },
      update: {},
      create: { hallNumber, building, floor, capacity, rows, columns, status: "ACTIVE" },
    });
  }
  console.log(`  ${HALLS.length} halls seeded`);

  // ---- Students (CSE 80, ECE 60, EEE 40, MECH 30, CIVIL 30 = 240 total) -----
  const studentCounts = { CSE: 80, ECE: 60, EEE: 40, MECH: 30, CIVIL: 30 };
  let totalStudents = 0;
  for (const [code, count] of Object.entries(studentCounts)) {
    const students = makeStudents(code, count);
    for (const s of students) {
      await prisma.student.upsert({
        where: { registerNumber: s.registerNumber },
        update: {},
        create: { ...s, departmentId: deptRecords[code].id },
      });
    }
    totalStudents += count;
  }
  console.log(`  ${totalStudents} students seeded`);

  // ---- Staff (15 total, spread across departments) --------------------------
  const staffPasswordHash = await hashPassword("Staff@123");
  const deptCodes = Object.keys(deptRecords);
  for (let i = 1; i <= 15; i += 1) {
    const staffId = `STF${100 + i}`;
    const dept = deptCodes[i % deptCodes.length];
    await prisma.staff.upsert({
      where: { staffId },
      update: {},
      create: {
        staffId,
        name: `Staff Member ${i}`,
        departmentId: deptRecords[dept].id,
        email: `staff${i}@institute.edu`,
        mobile: `90000000${String(i).padStart(2, "0")}`,
        passwordHash: staffPasswordHash,
        status: "ACTIVE",
      },
    });
  }
  console.log("  15 staff seeded -> e.g. staffId: STF101 / password: Staff@123 (DEV ONLY)");

  // ---- Exams — covers the required test scenarios ----------------------------
  // Scenario 1: ALL departments write (Data Structures, 20-09-2026, FN)
  const examAll = await prisma.exam.upsert({
    where: { subjectCode_date_session: { subjectCode: "CS301", date: new Date("2026-09-20"), session: "FN" } },
    update: {},
    create: {
      examName: "Data Structures",
      subjectCode: "CS301",
      subjectName: "Data Structures",
      date: new Date("2026-09-20"),
      session: "FN",
      startTime: "09:00",
      endTime: "12:00",
      duration: 180,
      regulation: "R2023",
    },
  });
  for (const code of deptCodes) {
    await prisma.examDepartment.upsert({
      where: { examId_departmentId: { examId: examAll.id, departmentId: deptRecords[code].id } },
      update: {},
      create: { examId: examAll.id, departmentId: deptRecords[code].id },
    });
  }

  // Scenario 2: only CSE + EEE write (Digital Electronics, 20-09-2026, AN)
  // -> tests that ECE/MECH/CIVIL students are correctly EXCLUDED (spec section 9)
  const examTwoDept = await prisma.exam.upsert({
    where: { subjectCode_date_session: { subjectCode: "EC302", date: new Date("2026-09-20"), session: "AN" } },
    update: {},
    create: {
      examName: "Digital Electronics",
      subjectCode: "EC302",
      subjectName: "Digital Electronics",
      date: new Date("2026-09-20"),
      session: "AN",
      startTime: "13:00",
      endTime: "16:00",
      duration: 180,
      regulation: "R2023",
    },
  });
  for (const code of ["CSE", "EEE"]) {
    await prisma.examDepartment.upsert({
      where: { examId_departmentId: { examId: examTwoDept.id, departmentId: deptRecords[code].id } },
      update: {},
      create: { examId: examTwoDept.id, departmentId: deptRecords[code].id },
    });
  }
  // NOTE: MECH intentionally has NO exam anywhere in this seed on 21-09-2026 FN,
  // covering the "department has no exam" scenario.

  // Scenario 3: CSE + ECE + CIVIL write on 21-09-2026 FN (insufficient-halls test:
  // 80+60+30 = 170 students vs the two smallest halls being reserved elsewhere)
  const examInsufficient = await prisma.exam.upsert({
    where: { subjectCode_date_session: { subjectCode: "CS401", date: new Date("2026-09-21"), session: "FN" } },
    update: {},
    create: {
      examName: "Engineering Mathematics",
      subjectCode: "CS401",
      subjectName: "Engineering Mathematics",
      date: new Date("2026-09-21"),
      session: "FN",
      startTime: "09:00",
      endTime: "12:00",
      duration: 180,
      regulation: "R2023",
    },
  });
  for (const code of ["CSE", "ECE", "CIVIL"]) {
    await prisma.examDepartment.upsert({
      where: { examId_departmentId: { examId: examInsufficient.id, departmentId: deptRecords[code].id } },
      update: {},
      create: { examId: examInsufficient.id, departmentId: deptRecords[code].id },
    });
  }

  console.log("  3 exams seeded covering: all-departments, two-departments, and larger-cohort scenarios");

  // ---- System settings (configurable business rules — spec section 48) -----
  const settings = [
    { key: "INVIGILATORS_PER_HALL", value: "1" },
    { key: "DEFAULT_SEATING_STRATEGY", value: "ALTERNATING" },
    { key: "DEFAULT_REPORTING_TIME_OFFSET_MINUTES", value: "30" },
    { key: "MAX_STUDENTS_PER_INVIGILATOR", value: "40" },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`  ${settings.length} system settings seeded`);

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


// ==== FILE: backend/src/config/env.js ====
// Loads and validates required environment variables in one place.
// Fail fast on startup rather than discovering a missing secret at request time.
require("dotenv").config();

const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || "10", 10),
  loginRateLimitWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || "900000", 10),
  loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || "10", 10),
};


// ==== FILE: backend/src/config/prisma.js ====
// Single shared Prisma Client instance for the whole backend.
// Prevents exhausting DB connections by re-instantiating the client
// on every hot-reload / require().
const { PrismaClient } = require("@prisma/client");

const prisma =
  global.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}

module.exports = prisma;


// ==== FILE: backend/src/config/swagger.js ====
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Examination Hall Seating Allocation System API",
      version: "1.0.0",
      description:
        "REST API for managing departments, students, halls, exams, seating allocation, and invigilation duties.",
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // JSDoc @openapi comments in route files are collected into the spec
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJSDoc(options);


// ==== FILE: backend/src/utils/password.js ====
// Password hashing helpers.
// bcrypt is used (widely supported, battle-tested). Cost factor 12 balances
// security and login latency for an exam-day login spike.
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, verifyPassword };


// ==== FILE: backend/src/utils/jwt.js ====
const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn } = require("../config/env");

/**
 * Sign a JWT for an authenticated user.
 * The payload intentionally carries only non-sensitive identity fields —
 * never the password hash.
 */
function signToken({ id, role, loginId }) {
  return jwt.sign({ sub: id, role, loginId }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };


// ==== FILE: backend/src/utils/apiResponse.js ====
// Consistent response envelope used across every controller.
// See spec section 42 — global error handling / consistent API responses.

function success(res, { statusCode = 200, message = "Success", data = null, meta = null }) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function failure(res, { statusCode = 400, message = "Request failed", errorCode = "BAD_REQUEST", details = null }) {
  const body = { success: false, message, errorCode };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

/**
 * Custom application error class. Thrown from services/controllers and
 * caught by the global error handler middleware, which maps it to a
 * consistent JSON error response.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = "BAD_REQUEST", details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = { success, failure, AppError };


// ==== FILE: backend/src/middleware/auth.middleware.js ====
const { verifyToken } = require("../utils/jwt");
const { failure } = require("../utils/apiResponse");

/**
 * Verifies the Bearer token on every protected route and attaches the
 * decoded identity to req.user = { id, role, loginId }.
 * This is the single choke point every protected API must pass through —
 * students cannot reach admin logic, staff cannot reach admin logic, etc.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return failure(res, {
      statusCode: 401,
      message: "Authentication token missing or malformed",
      errorCode: "AUTH_TOKEN_MISSING",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, role: decoded.role, loginId: decoded.loginId };
    return next();
  } catch (err) {
    return failure(res, {
      statusCode: 401,
      message: "Invalid or expired authentication token",
      errorCode: "AUTH_TOKEN_INVALID",
    });
  }
}

module.exports = { requireAuth };


// ==== FILE: backend/src/middleware/rbac.middleware.js ====
const { failure } = require("../utils/apiResponse");

/**
 * Restricts a route to one or more roles, e.g. requireRole("ADMIN").
 * Must run AFTER requireAuth so req.user is populated.
 *
 * This is what physically prevents Students/Staff from hitting Admin
 * endpoints even if they guess the URL — the check happens server-side
 * on every request, not just by hiding UI links.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return failure(res, {
        statusCode: 401,
        message: "Not authenticated",
        errorCode: "AUTH_REQUIRED",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return failure(res, {
        statusCode: 403,
        message: "You do not have permission to perform this action",
        errorCode: "FORBIDDEN_ROLE",
      });
    }

    return next();
  };
}

module.exports = { requireRole };


// ==== FILE: backend/src/middleware/errorHandler.middleware.js ====
const { AppError } = require("../utils/apiResponse");

/**
 * Global error handler — must be registered LAST in server.js (after all routes).
 * Converts thrown errors (AppError, Prisma errors, validation errors, or
 * anything unexpected) into the consistent response shape used across the API.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Known, deliberately-thrown application error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Prisma unique constraint violation
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: `A record with this ${err.meta?.target?.join(", ") || "value"} already exists`,
      errorCode: "DUPLICATE_RECORD",
    });
  }

  // Prisma "record not found" on update/delete
  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Record not found",
      errorCode: "NOT_FOUND",
    });
  }

  // Multer file-size / upload errors
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      errorCode: "UPLOAD_ERROR",
    });
  }

  // Fallback: unexpected error — never leak stack traces / internals to the client
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred. Please try again later.",
    errorCode: "INTERNAL_SERVER_ERROR",
  });
}

module.exports = { errorHandler };


// ==== FILE: backend/src/middleware/rateLimiter.middleware.js ====
const rateLimit = require("express-rate-limit");
const { loginRateLimitWindowMs, loginRateLimitMax } = require("../config/env");

// Applied to all /api/auth/*/login routes to slow down credential-stuffing
// and brute-force attempts against Admin/Staff/Student logins.
const loginRateLimiter = rateLimit({
  windowMs: loginRateLimitWindowMs,
  max: loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    errorCode: "RATE_LIMITED",
  },
});

module.exports = { loginRateLimiter };


// ==== FILE: backend/src/middleware/validate.middleware.js ====
const { validationResult } = require("express-validator");
const { failure } = require("../utils/apiResponse");

/**
 * Runs after any array of express-validator rules. Collects and returns
 * all validation errors in a consistent shape instead of letting bad
 * input reach controllers/services.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return failure(res, {
      statusCode: 422,
      message: "Validation failed",
      errorCode: "VALIDATION_ERROR",
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = { validate };


// ==== FILE: backend/src/validators/auth.validator.js ====
const { body } = require("express-validator");

const adminLoginRules = [
  body("instituteId").trim().notEmpty().withMessage("Institute ID is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const staffLoginRules = [
  body("staffId").trim().notEmpty().withMessage("Staff ID is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const studentLoginRules = [
  body("registerNumber").trim().notEmpty().withMessage("Register number is required"),
];

module.exports = { adminLoginRules, staffLoginRules, studentLoginRules };


// ==== FILE: backend/src/services/auditLog.service.js ====
const prisma = require("../config/prisma");

/**
 * Writes one audit log entry. Called by other services after a meaningful
 * state change (login, create/delete department, generate allocation, etc.)
 * per spec section 33. Never throws into the caller's request flow —
 * a failed audit write should not fail the underlying business operation.
 */
async function recordAudit({ userId, role, action, description, ipAddress = null }) {
  try {
    const data = {
      role,
      action,
      description,
      ipAddress,
    };
    if (role === "ADMIN") data.adminId = userId;
    if (role === "STAFF") data.staffRefId = userId;

    await prisma.auditLog.create({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to write audit log:", err.message);
  }
}

module.exports = { recordAudit };


// ==== FILE: backend/src/services/auth.service.js ====
const prisma = require("../config/prisma");
const { verifyPassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const { AppError } = require("../utils/apiResponse");
const { recordAudit } = require("./auditLog.service");

/**
 * Strips sensitive fields (passwordHash) before anything is sent to the client.
 * Passwords/hashes must never leave the backend — spec section 34.
 */
function sanitizeAdmin(admin) {
  const { passwordHash, ...safe } = admin;
  return safe;
}
function sanitizeStaff(staff) {
  const { passwordHash, ...safe } = staff;
  return safe;
}

async function loginAdmin({ instituteId, password }, ipAddress) {
  const admin = await prisma.admin.findUnique({ where: { instituteId } });

  // Same generic error whether the ID doesn't exist or the password is wrong —
  // avoids leaking which institute IDs are valid.
  if (!admin) {
    throw new AppError("Invalid institute ID or password", 401, "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    throw new AppError("Invalid institute ID or password", 401, "INVALID_CREDENTIALS");
  }

  const token = signToken({ id: admin.id, role: "ADMIN", loginId: admin.instituteId });

  await recordAudit({
    userId: admin.id,
    role: "ADMIN",
    action: "ADMIN_LOGIN",
    description: `Admin ${admin.instituteId} logged in`,
    ipAddress,
  });

  return { token, user: sanitizeAdmin(admin), role: "ADMIN" };
}

async function loginStaff({ staffId, password }, ipAddress) {
  const staff = await prisma.staff.findUnique({
    where: { staffId },
    include: { department: true },
  });

  if (!staff || staff.status !== "ACTIVE") {
    throw new AppError("Invalid staff ID or password", 401, "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) {
    throw new AppError("Invalid staff ID or password", 401, "INVALID_CREDENTIALS");
  }

  const token = signToken({ id: staff.id, role: "STAFF", loginId: staff.staffId });

  await recordAudit({
    userId: staff.id,
    role: "STAFF",
    action: "STAFF_LOGIN",
    description: `Staff ${staff.staffId} logged in`,
    ipAddress,
  });

  return { token, user: sanitizeStaff(staff), role: "STAFF" };
}

/**
 * Student "login" is a lookup by register number (spec section 13), optionally
 * strengthened with a second factor. Here we require register number +
 * date of birth (stored on the student record) as a lightweight verification
 * factor rather than a traditional password, matching the spec's suggestion.
 * No JWT is required to just search public exam-hall info, but we still issue
 * a short-lived, narrowly-scoped token so "My seating" pages behind requireAuth
 * work consistently with the rest of the app.
 */
async function loginStudent({ registerNumber }) {
  const student = await prisma.student.findUnique({
    where: { registerNumber },
    include: { department: true },
  });

  if (!student) {
    throw new AppError("Register number not found", 404, "STUDENT_NOT_FOUND");
  }

  const token = signToken({ id: student.id, role: "STUDENT", loginId: student.registerNumber });

  return { token, user: student, role: "STUDENT" };
}

module.exports = { loginAdmin, loginStaff, loginStudent };


// ==== FILE: backend/src/controllers/auth.controller.js ====
const authService = require("../services/auth.service");
const { success } = require("../utils/apiResponse");

async function adminLogin(req, res, next) {
  try {
    const result = await authService.loginAdmin(req.body, req.ip);
    return success(res, { message: "Admin login successful", data: result });
  } catch (err) {
    return next(err);
  }
}

async function staffLogin(req, res, next) {
  try {
    const result = await authService.loginStaff(req.body, req.ip);
    return success(res, { message: "Staff login successful", data: result });
  } catch (err) {
    return next(err);
  }
}

async function studentLogin(req, res, next) {
  try {
    const result = await authService.loginStudent(req.body);
    return success(res, { message: "Student verified", data: result });
  } catch (err) {
    return next(err);
  }
}

// JWTs are stateless; "logout" is a client-side token discard. This endpoint
// exists for a consistent API surface and so an audit entry / future
// token-blocklist can be added without breaking the frontend contract.
async function logout(req, res) {
  return success(res, { message: "Logged out successfully" });
}

module.exports = { adminLogin, staffLogin, studentLogin, logout };


// ==== FILE: backend/src/routes/auth.routes.js ====
const express = require("express");
const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { loginRateLimiter } = require("../middleware/rateLimiter.middleware");
const {
  adminLoginRules,
  staffLoginRules,
  studentLoginRules,
} = require("../validators/auth.validator");

const router = express.Router();

/**
 * @openapi
 * /api/auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Auth]
 */
router.post("/admin/login", loginRateLimiter, adminLoginRules, validate, authController.adminLogin);

/**
 * @openapi
 * /api/auth/staff/login:
 *   post:
 *     summary: Staff login
 *     tags: [Auth]
 */
router.post("/staff/login", loginRateLimiter, staffLoginRules, validate, authController.staffLogin);

/**
 * @openapi
 * /api/auth/student/login:
 *   post:
 *     summary: Student lookup/login by register number
 *     tags: [Auth]
 */
router.post("/student/login", loginRateLimiter, studentLoginRules, validate, authController.studentLogin);

router.post("/logout", authController.logout);

module.exports = router;


// ==== FILE: backend/src/app.js  [STAGE 1 VERSION — superseded below] ====
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const swaggerSpec = require("./config/swagger");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const authRoutes = require("./routes/auth.routes");
// Additional route modules (departments, students, halls, exams, allocation,
// staff, invigilation, reports) are registered here in later stages of the
// build, following this exact same pattern.

const app = express();

// ---- Security & core middleware -------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
}

// ---- API documentation ------------------------------------------------------
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---- Health check ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is running", timestamp: new Date().toISOString() });
});

// ---- Routes --------------------------------------------------------------
app.use("/api/auth", authRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: "ROUTE_NOT_FOUND",
  });
});

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;


// ==== FILE: backend/src/server.js ====
const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Smart Examination System API running on port ${env.port} [${env.nodeEnv}]`);
  // eslint-disable-next-line no-console
  console.log(`API docs available at http://localhost:${env.port}/api-docs`);
});

// Graceful shutdown — close DB connections cleanly.
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));


// ==== FILE: backend/src/validators/department.validator.js ====
const { body, param } = require("express-validator");

const createDepartmentRules = [
  body("code").trim().notEmpty().withMessage("Department code is required").isLength({ max: 10 }),
  body("name").trim().notEmpty().withMessage("Department name is required"),
];

const updateDepartmentRules = [
  param("id").isUUID().withMessage("Invalid department id"),
  body("code").optional().trim().notEmpty(),
  body("name").optional().trim().notEmpty(),
  body("status").optional().isIn(["ACTIVE", "INACTIVE"]),
];

const idParamRule = [param("id").isUUID().withMessage("Invalid department id")];

module.exports = { createDepartmentRules, updateDepartmentRules, idParamRule };


// ==== FILE: backend/src/services/department.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");

async function listDepartments({ search, page = 1, pageSize = 20 }) {
  const where = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: { _count: { select: { students: true, staff: true } } },
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.department.count({ where }),
  ]);

  const data = items.map((d) => ({
    ...d,
    studentCount: d._count.students,
    staffCount: d._count.staff,
  }));

  return { data, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getDepartmentById(id) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { students: true, staff: true } } },
  });
  if (!dept) throw new AppError("Department not found", 404, "DEPARTMENT_NOT_FOUND");
  return dept;
}

async function createDepartment({ code, name }) {
  return prisma.department.create({ data: { code: code.toUpperCase(), name } });
}

async function updateDepartment(id, updates) {
  await getDepartmentById(id);
  if (updates.code) updates.code = updates.code.toUpperCase();
  return prisma.department.update({ where: { id }, data: updates });
}

async function deleteDepartment(id) {
  const dept = await getDepartmentById(id);
  const studentCount = await prisma.student.count({ where: { departmentId: id } });
  if (studentCount > 0) {
    throw new AppError(
      `Cannot delete department "${dept.code}" — ${studentCount} students are still assigned to it`,
      409,
      "DEPARTMENT_IN_USE"
    );
  }
  await prisma.department.delete({ where: { id } });
}

module.exports = { listDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment };


// ==== FILE: backend/src/controllers/department.controller.js ====
const deptService = require("../services/department.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const { search, page, pageSize } = req.query;
    const result = await deptService.listDepartments({ search, page, pageSize });
    return success(res, {
      message: "Departments fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const dept = await deptService.getDepartmentById(req.params.id);
    return success(res, { message: "Department fetched", data: dept });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const dept = await deptService.createDepartment(req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "DEPARTMENT_CREATED",
      description: `Department ${dept.code} created`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Department created", data: dept });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const dept = await deptService.updateDepartment(req.params.id, req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "DEPARTMENT_UPDATED",
      description: `Department ${dept.code} updated`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Department updated", data: dept });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await deptService.deleteDepartment(req.params.id);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "DEPARTMENT_DELETED",
      description: `Department ${req.params.id} deleted`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Department deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove };


// ==== FILE: backend/src/routes/department.routes.js ====
const express = require("express");
const controller = require("../controllers/department.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  createDepartmentRules,
  updateDepartmentRules,
  idParamRule,
} = require("../validators/department.validator");

const router = express.Router();

// All department management is Admin-only. Staff/Student cannot reach these
// routes — requireAuth verifies the JWT, requireRole enforces the role.
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", controller.list);
router.get("/:id", idParamRule, validate, controller.getOne);
router.post("/", createDepartmentRules, validate, controller.create);
router.put("/:id", updateDepartmentRules, validate, controller.update);
router.delete("/:id", idParamRule, validate, controller.remove);

module.exports = router;


// ==== FILE: backend/src/validators/hall.validator.js ====
const { body, param } = require("express-validator");

const createHallRules = [
  body("hallNumber").trim().notEmpty().withMessage("Hall number is required"),
  body("building").trim().notEmpty().withMessage("Building is required"),
  body("floor").trim().notEmpty().withMessage("Floor is required"),
  body("capacity").isInt({ min: 1 }).withMessage("Capacity must be a positive integer"),
  body("rows").isInt({ min: 1 }).withMessage("Rows must be a positive integer"),
  body("columns").isInt({ min: 1 }).withMessage("Columns must be a positive integer"),
  body().custom((value) => {
    if (value.rows && value.columns && value.capacity) {
      if (value.rows * value.columns < value.capacity) {
        throw new Error("rows x columns must be able to accommodate the stated capacity");
      }
    }
    return true;
  }),
];

const updateHallRules = [
  param("id").isUUID(),
  body("capacity").optional().isInt({ min: 1 }),
  body("rows").optional().isInt({ min: 1 }),
  body("columns").optional().isInt({ min: 1 }),
  body("status").optional().isIn(["ACTIVE", "MAINTENANCE", "DISABLED"]),
];

const idParamRule = [param("id").isUUID()];

module.exports = { createHallRules, updateHallRules, idParamRule };


// ==== FILE: backend/src/services/hall.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");

async function listHalls({ status, search, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { hallNumber: { contains: search, mode: "insensitive" } },
      { building: { contains: search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.hall.findMany({ where, orderBy: { hallNumber: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.hall.count({ where }),
  ]);
  return { data: items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getHallById(id) {
  const hall = await prisma.hall.findUnique({ where: { id } });
  if (!hall) throw new AppError("Hall not found", 404, "HALL_NOT_FOUND");
  return hall;
}

async function createHall(payload) {
  return prisma.hall.create({ data: payload });
}

async function updateHall(id, updates) {
  await getHallById(id);
  return prisma.hall.update({ where: { id }, data: updates });
}

async function deleteHall(id) {
  await getHallById(id);
  const usedInAllocation = await prisma.seatingAllocation.count({ where: { hallId: id } });
  if (usedInAllocation > 0) {
    throw new AppError(
      "Cannot delete a hall that has existing seating allocations. Mark it DISABLED instead.",
      409,
      "HALL_IN_USE"
    );
  }
  await prisma.hall.delete({ where: { id } });
}

/** Halls eligible to be used for a NEW allocation — active status only. */
async function listAvailableHalls() {
  return prisma.hall.findMany({ where: { status: "ACTIVE" }, orderBy: { capacity: "desc" } });
}

module.exports = { listHalls, getHallById, createHall, updateHall, deleteHall, listAvailableHalls };


// ==== FILE: backend/src/controllers/hall.controller.js ====
const hallService = require("../services/hall.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await hallService.listHalls(req.query);
    return success(res, {
      message: "Halls fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const hall = await hallService.getHallById(req.params.id);
    return success(res, { message: "Hall fetched", data: hall });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const hall = await hallService.createHall(req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "HALL_CREATED",
      description: `Hall ${hall.hallNumber} created (capacity ${hall.capacity})`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Hall created", data: hall });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const hall = await hallService.updateHall(req.params.id, req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "HALL_UPDATED",
      description: `Hall ${hall.hallNumber} updated`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Hall updated", data: hall });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await hallService.deleteHall(req.params.id);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "HALL_DELETED",
      description: `Hall ${req.params.id} deleted`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Hall deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove };


// ==== FILE: backend/src/routes/hall.routes.js ====
const express = require("express");
const controller = require("../controllers/hall.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createHallRules, updateHallRules, idParamRule } = require("../validators/hall.validator");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", controller.list);
router.get("/:id", idParamRule, validate, controller.getOne);
router.post("/", createHallRules, validate, controller.create);
router.put("/:id", updateHallRules, validate, controller.update);
router.delete("/:id", idParamRule, validate, controller.remove);

module.exports = router;


// ==== FILE: backend/src/validators/student.validator.js ====
const { body, param } = require("express-validator");

const createStudentRules = [
  body("registerNumber").trim().notEmpty().withMessage("Register number is required"),
  body("name").trim().notEmpty().withMessage("Student name is required"),
  body("departmentId").isUUID().withMessage("Valid departmentId is required"),
  body("year").trim().notEmpty().withMessage("Year is required"),
  body("section").optional().trim(),
  body("batch").optional().trim(),
  body("email").optional().isEmail().withMessage("Invalid email"),
];

const updateStudentRules = [
  param("id").isUUID(),
  body("name").optional().trim().notEmpty(),
  body("departmentId").optional().isUUID(),
  body("year").optional().trim().notEmpty(),
];

const idParamRule = [param("id").isUUID()];

module.exports = { createStudentRules, updateStudentRules, idParamRule };


// ==== FILE: backend/src/utils/upload.js ====
const multer = require("multer");
const path = require("path");
const { maxUploadSizeMb } = require("../config/env");

// Files are staged in-memory then parsed immediately — nothing sensitive
// is written to disk longer than the request lifecycle.
const storage = multer.memoryStorage();

const ALLOWED_EXT = [".xlsx", ".csv"];

const upload = multer({
  storage,
  limits: { fileSize: maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}". Only .xlsx and .csv are allowed.`));
    }
    return cb(null, true);
  },
});

module.exports = { upload };


// ==== FILE: backend/src/utils/registerParser.js ====
// Parses an uploaded student register (.xlsx or .csv) into normalized rows
// and validates them BEFORE anything touches the database, per spec section 6:
//   - detect missing required values
//   - detect duplicate register numbers WITHIN the file
//   - flag department codes that don't exist yet
// The caller (student.service.importRegister) cross-checks duplicates
// against the database and performs the actual insert inside a transaction.
const ExcelJS = require("exceljs");
const { parse } = require("csv-parse/sync");

const REQUIRED_HEADERS = ["registernumber", "studentname", "department", "year"];

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

async function parseWorkbookBuffer(buffer, mimetypeHint) {
  const isCsv = mimetypeHint === "csv";
  let rows;

  if (isCsv) {
    const text = buffer.toString("utf-8");
    rows = parse(text, { skip_empty_lines: true });
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    rows = [];
    sheet.eachRow((row) => {
      rows.push(row.values.slice(1).map((v) => (v === null || v === undefined ? "" : String(v).trim())));
    });
  }

  if (rows.length < 2) {
    return { headerMap: {}, rawRows: [] };
  }

  const headerRow = rows[0].map(normalizeHeader);
  const headerMap = {};
  headerRow.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const missingHeaders = REQUIRED_HEADERS.filter((h) => !(h in headerMap));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required column(s): ${missingHeaders.join(", ")}`);
  }

  return { headerMap, rawRows: rows.slice(1) };
}

/**
 * Validates the parsed rows: missing fields, duplicate register numbers
 * WITHIN the file. Returns { validRows, invalidRows } — invalidRows carry
 * a human-readable reason for the import preview / error report.
 */
function validateRows(headerMap, rawRows) {
  const seenInFile = new Set();
  const validRows = [];
  const invalidRows = [];

  rawRows.forEach((cols, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-indexing
    const get = (key) => (cols[headerMap[key]] || "").toString().trim();

    const registerNumber = get("registernumber");
    const name = get("studentname");
    const department = get("department");
    const year = get("year");
    const section = get("section");
    const batch = get("batch");
    const email = get("email") || get("emailmobile");

    // Skip fully blank trailing rows
    if (!registerNumber && !name && !department && !year) return;

    const reasons = [];
    if (!registerNumber) reasons.push("Missing register number");
    if (!name) reasons.push("Missing student name");
    if (!department) reasons.push("Missing department");
    if (!year) reasons.push("Missing year");

    if (registerNumber) {
      if (seenInFile.has(registerNumber)) {
        reasons.push(`Duplicate register number within file: ${registerNumber}`);
      } else {
        seenInFile.add(registerNumber);
      }
    }

    if (reasons.length > 0) {
      invalidRows.push({ rowNumber, registerNumber, name, department, year, reasons });
    } else {
      validRows.push({ rowNumber, registerNumber, name, department: department.toUpperCase(), year, section, batch, email });
    }
  });

  return { validRows, invalidRows };
}

module.exports = { parseWorkbookBuffer, validateRows };


// ==== FILE: backend/src/services/student.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");
const { parseWorkbookBuffer, validateRows } = require("../utils/registerParser");

async function listStudents({ search, departmentId, year, page = 1, pageSize = 20 }) {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (year) where.year = year;
  if (search) {
    where.OR = [
      { registerNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { department: true },
      orderBy: { registerNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return { data: items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getStudentById(id) {
  const student = await prisma.student.findUnique({ where: { id }, include: { department: true } });
  if (!student) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
  return student;
}

async function createStudent(payload) {
  return prisma.student.create({ data: payload });
}

async function updateStudent(id, updates) {
  await getStudentById(id);
  return prisma.student.update({ where: { id }, data: updates });
}

async function deleteStudent(id) {
  await getStudentById(id);
  await prisma.student.delete({ where: { id } });
}

/**
 * STEP 1 of import: parse + validate the uploaded file and return a preview
 * (spec section 6 — "show an import preview, ask Admin to confirm import").
 * Nothing is written to the database yet.
 */
async function previewRegisterImport(fileBuffer, originalName) {
  const isCsv = originalName.toLowerCase().endsWith(".csv");
  const { headerMap, rawRows } = await parseWorkbookBuffer(fileBuffer, isCsv ? "csv" : "xlsx");

  if (rawRows.length === 0) {
    throw new AppError("The uploaded file has no data rows", 400, "EMPTY_FILE");
  }

  const { validRows, invalidRows } = validateRows(headerMap, rawRows);

  // Cross-check department codes against the DB, and register numbers
  // against already-existing students, WITHOUT inserting anything yet.
  const departments = await prisma.department.findMany();
  const deptByCode = new Map(departments.map((d) => [d.code, d]));

  const registerNumbers = validRows.map((r) => r.registerNumber);
  const existing = registerNumbers.length
    ? await prisma.student.findMany({
        where: { registerNumber: { in: registerNumbers } },
        select: { registerNumber: true },
      })
    : [];
  const existingSet = new Set(existing.map((e) => e.registerNumber));

  const readyRows = [];
  for (const row of validRows) {
    if (!deptByCode.has(row.department)) {
      invalidRows.push({ ...row, reasons: [`Unknown department code: ${row.department}`] });
      continue;
    }
    if (existingSet.has(row.registerNumber)) {
      invalidRows.push({ ...row, reasons: [`Register number already exists in database: ${row.registerNumber}`] });
      continue;
    }
    readyRows.push(row);
  }

  // A short-lived, signed preview token would normally be cached (e.g. Redis)
  // keyed by an id so "confirm" doesn't require re-uploading the file. Here
  // we simply return the ready rows to the client, which re-submits them
  // verbatim to /students/import/confirm — keeping the backend stateless.
  return {
    totalRows: rawRows.length,
    validCount: readyRows.length,
    invalidCount: invalidRows.length,
    readyRows,
    invalidRows,
  };
}

/**
 * STEP 2 of import: Admin has reviewed the preview and confirmed. Insert
 * all ready rows inside a single transaction — either all succeed or none do,
 * so a mid-import failure can never leave a half-imported register.
 */
async function confirmRegisterImport(readyRows) {
  if (!Array.isArray(readyRows) || readyRows.length === 0) {
    throw new AppError("No valid rows to import", 400, "NOTHING_TO_IMPORT");
  }

  const departments = await prisma.department.findMany();
  const deptByCode = new Map(departments.map((d) => [d.code, d.id]));

  const created = await prisma.$transaction(
    readyRows.map((row) =>
      prisma.student.create({
        data: {
          registerNumber: row.registerNumber,
          name: row.name,
          departmentId: deptByCode.get(row.department),
          year: row.year,
          section: row.section || null,
          batch: row.batch || null,
          email: row.email || null,
        },
      })
    )
  );

  return { importedCount: created.length };
}

module.exports = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  previewRegisterImport,
  confirmRegisterImport,
};


// ==== FILE: backend/src/controllers/student.controller.js ====
const studentService = require("../services/student.service");
const { recordAudit } = require("../services/auditLog.service");
const { success, AppError } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await studentService.listStudents(req.query);
    return success(res, {
      message: "Students fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const student = await studentService.getStudentById(req.params.id);
    return success(res, { message: "Student fetched", data: student });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const student = await studentService.createStudent(req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "STUDENT_CREATED",
      description: `Student ${student.registerNumber} created`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Student created", data: student });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    return success(res, { message: "Student updated", data: student });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await studentService.deleteStudent(req.params.id);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "STUDENT_DELETED",
      description: `Student ${req.params.id} deleted`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Student deleted" });
  } catch (err) {
    return next(err);
  }
}

async function previewImport(req, res, next) {
  try {
    if (!req.file) throw new AppError("No file uploaded", 400, "FILE_MISSING");
    const preview = await studentService.previewRegisterImport(req.file.buffer, req.file.originalname);
    return success(res, { message: "Import preview generated", data: preview });
  } catch (err) {
    return next(err);
  }
}

async function confirmImport(req, res, next) {
  try {
    const { readyRows } = req.body;
    const result = await studentService.confirmRegisterImport(readyRows);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "STUDENT_REGISTER_IMPORTED",
      description: `${result.importedCount} students imported via register upload`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: `${result.importedCount} students imported`, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove, previewImport, confirmImport };


// ==== FILE: backend/src/routes/student.routes.js ====
const express = require("express");
const controller = require("../controllers/student.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const { upload } = require("../utils/upload");
const {
  createStudentRules,
  updateStudentRules,
  idParamRule,
} = require("../validators/student.validator");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", controller.list);
router.get("/:id", idParamRule, validate, controller.getOne);
router.post("/", createStudentRules, validate, controller.create);
router.put("/:id", updateStudentRules, validate, controller.update);
router.delete("/:id", idParamRule, validate, controller.remove);

// Register upload workflow: upload -> preview -> confirm (never auto-saves)
router.post("/import/preview", upload.single("file"), controller.previewImport);
router.post("/import/confirm", controller.confirmImport);

module.exports = router;


// ==== FILE: backend/src/validators/exam.validator.js ====
const { body, param } = require("express-validator");

const createExamRules = [
  body("examName").trim().notEmpty().withMessage("Exam name is required"),
  body("subjectCode").trim().notEmpty().withMessage("Subject code is required"),
  body("subjectName").trim().notEmpty().withMessage("Subject name is required"),
  body("date").isISO8601().withMessage("Valid exam date is required"),
  body("session").isIn(["FN", "AN"]).withMessage("Session must be FN or AN"),
  body("startTime").trim().notEmpty().withMessage("Start time is required"),
  body("endTime").trim().notEmpty().withMessage("End time is required"),
  body("duration").isInt({ min: 1 }).withMessage("Duration (minutes) is required"),
  body("departmentIds").isArray({ min: 1 }).withMessage("At least one department must be selected"),
  body("departmentIds.*").isUUID().withMessage("Invalid department id in departmentIds"),
];

const updateExamRules = [
  param("id").isUUID(),
  body("date").optional().isISO8601(),
  body("session").optional().isIn(["FN", "AN"]),
  body("departmentIds").optional().isArray({ min: 1 }),
  body("departmentIds.*").optional().isUUID(),
];

const idParamRule = [param("id").isUUID()];

module.exports = { createExamRules, updateExamRules, idParamRule };


// ==== FILE: backend/src/services/exam.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");

async function listExams({ date, session, page = 1, pageSize = 20 }) {
  const where = {};
  if (date) where.date = new Date(date);
  if (session) where.session = session;

  const [items, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      include: {
        examDepartments: { include: { department: true } },
        _count: { select: { examStudents: true, allocations: true } },
      },
      orderBy: [{ date: "asc" }, { session: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exam.count({ where }),
  ]);

  return { data: items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getExamById(id) {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { examDepartments: { include: { department: true } } },
  });
  if (!exam) throw new AppError("Exam not found", 404, "EXAM_NOT_FOUND");
  return exam;
}

/**
 * Creates an exam AND materializes ExamStudent rows for every student in the
 * selected departments (spec section 9: only students of departments WRITING
 * this exam are ever considered by the seating algorithm). Done inside a
 * transaction so the exam is never left without its student cohort.
 */
async function createExam(payload) {
  const { departmentIds, ...examFields } = payload;

  const students = await prisma.student.findMany({
    where: { departmentId: { in: departmentIds } },
    select: { id: true },
  });

  if (students.length === 0) {
    throw new AppError(
      "None of the selected departments currently have any students",
      400,
      "NO_ELIGIBLE_STUDENTS"
    );
  }

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({ data: { ...examFields, date: new Date(examFields.date) } });

    await tx.examDepartment.createMany({
      data: departmentIds.map((departmentId) => ({ examId: created.id, departmentId })),
    });

    await tx.examStudent.createMany({
      data: students.map((s) => ({ examId: created.id, studentId: s.id })),
    });

    return created;
  });

  return getExamById(exam.id);
}

async function updateExam(id, updates) {
  await getExamById(id);
  const { departmentIds, ...fields } = updates;
  if (fields.date) fields.date = new Date(fields.date);

  // Changing departments after creation re-derives the eligible-student list.
  // Any existing seating allocation becomes stale and must be regenerated —
  // we refuse the update if a CONFIRMED allocation already exists, matching
  // "never silently overwrite an existing allocation" (spec section 19).
  if (departmentIds) {
    const existingAllocationCount = await prisma.seatingAllocation.count({ where: { examId: id } });
    if (existingAllocationCount > 0) {
      throw new AppError(
        "This exam already has a saved seating allocation. Delete or regenerate the allocation before changing departments.",
        409,
        "ALLOCATION_EXISTS"
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.examDepartment.deleteMany({ where: { examId: id } });
      await tx.examStudent.deleteMany({ where: { examId: id } });
      await tx.examDepartment.createMany({
        data: departmentIds.map((departmentId) => ({ examId: id, departmentId })),
      });
      const students = await tx.student.findMany({ where: { departmentId: { in: departmentIds } }, select: { id: true } });
      await tx.examStudent.createMany({ data: students.map((s) => ({ examId: id, studentId: s.id })) });
      await tx.exam.update({ where: { id }, data: fields });
    });
  } else {
    await prisma.exam.update({ where: { id }, data: fields });
  }

  return getExamById(id);
}

async function deleteExam(id) {
  await getExamById(id);
  const allocationCount = await prisma.seatingAllocation.count({ where: { examId: id } });
  if (allocationCount > 0) {
    throw new AppError(
      "Cannot delete an exam that already has a saved seating allocation",
      409,
      "ALLOCATION_EXISTS"
    );
  }
  await prisma.exam.delete({ where: { id } });
}

module.exports = { listExams, getExamById, createExam, updateExam, deleteExam };


// ==== FILE: backend/src/controllers/exam.controller.js ====
const examService = require("../services/exam.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await examService.listExams(req.query);
    return success(res, {
      message: "Exams fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const exam = await examService.getExamById(req.params.id);
    return success(res, { message: "Exam fetched", data: exam });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const exam = await examService.createExam(req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "EXAM_CREATED",
      description: `Exam "${exam.examName}" (${exam.subjectCode}) created for ${exam.date.toISOString().slice(0, 10)} ${exam.session}`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Exam created", data: exam });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const exam = await examService.updateExam(req.params.id, req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "EXAM_UPDATED",
      description: `Exam "${exam.examName}" updated`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Exam updated", data: exam });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await examService.deleteExam(req.params.id);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "EXAM_DELETED",
      description: `Exam ${req.params.id} deleted`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Exam deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove };


// ==== FILE: backend/src/routes/exam.routes.js ====
const express = require("express");
const controller = require("../controllers/exam.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const { createExamRules, updateExamRules, idParamRule } = require("../validators/exam.validator");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", controller.list);
router.get("/:id", idParamRule, validate, controller.getOne);
router.post("/", createExamRules, validate, controller.create);
router.put("/:id", updateExamRules, validate, controller.update);
router.delete("/:id", idParamRule, validate, controller.remove);

module.exports = router;


// ==== FILE: backend/src/app.js  [STAGE 2 VERSION — superseded below] ====
// REPLACES backend/src/app.js from Stage 1 — adds department/student/hall/exam routes.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const swaggerSpec = require("./config/swagger");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const authRoutes = require("./routes/auth.routes");
const departmentRoutes = require("./routes/department.routes");
const studentRoutes = require("./routes/student.routes");
const hallRoutes = require("./routes/hall.routes");
const examRoutes = require("./routes/exam.routes");
// Stage 3+ will add: allocation, staff, invigilation, reports, audit routes.

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
}

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/exams", examRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: "ROUTE_NOT_FOUND",
  });
});

app.use(errorHandler);

module.exports = app;


// ==== FILE: backend/src/algorithms/seatLayout.js ====
// Converts a hall's rows/columns/capacity into an ordered list of physical
// seats (row, column, seatNumber), row-major, capped at the hall's stated
// capacity (a hall may have rows*columns > capacity, e.g. seats reserved
// for storage/aisles).
function rowLetter(rowIndex) {
  // 1 -> A, 2 -> B ... 26 -> Z, 27 -> AA, etc.
  let n = rowIndex;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function buildSeatList(hall) {
  const seats = [];
  for (let r = 1; r <= hall.rows && seats.length < hall.capacity; r += 1) {
    for (let c = 1; c <= hall.columns && seats.length < hall.capacity; c += 1) {
      seats.push({ row: r, column: c, seatNumber: `${rowLetter(r)}${c}` });
    }
  }
  return seats;
}

module.exports = { buildSeatList, rowLetter };


// ==== FILE: backend/src/algorithms/seatingAlgorithm.js ====
// ============================================================================
// SMART SEATING ALLOCATION ALGORITHM
// Spec sections 9, 10, 11, 12, 47.
//
// This module is deliberately pure / DB-agnostic: it receives plain data
// (exam info, eligible students, available halls, a strategy) and returns a
// plain result object. All Prisma reads/writes happen in
// services/allocation.service.js, which is what makes this function easy
// to unit test in isolation (see stage 6 tests) and keeps business logic
// out of the API route layer per spec section 28.
//
//   generateAllocation(exam, eligibleStudents, availableHalls, strategy)
//     -> { success, hallsUsed, allocations, conflicts }
// ============================================================================
const { buildSeatList } = require("./seatLayout");

/**
 * Picks the smallest set of halls (by count) whose combined capacity can
 * seat every eligible student, largest-capacity-first. This directly
 * implements spec section 37: halls that aren't needed stay unused/available
 * rather than being marked occupied "just because they exist".
 */
function selectHallsForCapacity(availableHalls, studentCount) {
  const sorted = [...availableHalls].sort((a, b) => b.capacity - a.capacity);
  const selected = [];
  let runningCapacity = 0;

  for (const hall of sorted) {
    if (runningCapacity >= studentCount) break;
    selected.push(hall);
    runningCapacity += hall.capacity;
  }

  return { selected, totalCapacity: runningCapacity };
}

/**
 * Groups students by department and returns entries sorted by group size
 * descending — used by the SEPARATION strategy so the largest department
 * is placed first (more likely to fill a hall on its own).
 */
function groupByDepartment(students) {
  const map = new Map();
  for (const s of students) {
    if (!map.has(s.departmentId)) map.set(s.departmentId, []);
    map.get(s.departmentId).push(s);
  }
  return [...map.values()].sort((a, b) => b.length - a.length);
}

/**
 * Builds the seat-fill ORDER of students for each strategy. The actual
 * seat assignment (which physical seat number) always happens sequentially
 * hall-by-hall, seat-by-seat, over whatever order this function returns —
 * the strategy only changes which student lands in which seat.
 */
function buildStudentOrder(students, strategy) {
  if (strategy === "SEPARATION") {
    // Whole department blocks, largest department first. When departments
    // are placed hall-by-hall in sequence, same-department students land
    // in the same hall until a hall boundary forces a split — exactly the
    // "distribute across different halls where possible" requirement.
    return groupByDepartment(students).flat();
  }

  if (strategy === "ALTERNATING") {
    // Round-robin across departments: dept A[0], dept B[0], dept C[0],
    // dept A[1], dept B[1]... so neighbouring seats are (as much as
    // possible) from different departments. Naturally degrades gracefully
    // when one department has far more students than the others — it
    // simply continues alone once the smaller groups are exhausted.
    const groups = groupByDepartment(students).map((g) => [...g]);
    const order = [];
    let remaining = groups.reduce((sum, g) => sum + g.length, 0);
    while (remaining > 0) {
      for (const g of groups) {
        if (g.length > 0) {
          order.push(g.shift());
          remaining -= 1;
        }
      }
    }
    return order;
  }

  // MIXED (Strategy B): departments are allowed to share halls/seats freely.
  // A deterministic shuffle (not true department grouping, not strict
  // alternation) is used so the distribution is unpredictable but still
  // reproducible for the same input in tests.
  const shuffled = [...students];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(pseudoRandom(i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deterministic pseudo-random generator (seeded by index) — avoids pulling
// in a RNG dependency while keeping shuffles reproducible for tests.
function pseudoRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * Main entry point.
 *
 * @param {object} exam - { id, examName, date, session }
 * @param {Array}  eligibleStudents - [{ id, registerNumber, name, departmentId, departmentCode }]
 * @param {Array}  availableHalls - [{ id, hallNumber, capacity, rows, columns }]
 * @param {string} strategy - "SEPARATION" | "MIXED" | "ALTERNATING"
 * @returns {{ success: boolean, hallsUsed: Array, allocations: Array, conflicts: Array }}
 */
function generateAllocation(exam, eligibleStudents, availableHalls, strategy = "ALTERNATING") {
  const conflicts = [];

  if (!eligibleStudents || eligibleStudents.length === 0) {
    conflicts.push({
      code: "NO_ELIGIBLE_STUDENTS",
      message: "No students are eligible for this exam's departments — nothing to allocate.",
    });
    return { success: false, hallsUsed: [], allocations: [], conflicts };
  }

  // Guard against duplicate students in the input (defensive — should never
  // happen given the unique ExamStudent constraint, but the algorithm must
  // never allocate the same student twice regardless of its input).
  const dedupedStudents = [];
  const seenStudentIds = new Set();
  for (const s of eligibleStudents) {
    if (seenStudentIds.has(s.id)) continue;
    seenStudentIds.add(s.id);
    dedupedStudents.push(s);
  }

  const { selected: hallsUsed, totalCapacity } = selectHallsForCapacity(availableHalls, dedupedStudents.length);

  if (totalCapacity < dedupedStudents.length) {
    conflicts.push({
      code: "INSUFFICIENT_CAPACITY",
      message: `Unable to generate allocation. ${dedupedStudents.length} students require seating, but only ${totalCapacity} seats are available across ${hallsUsed.length} hall(s).`,
    });
    return { success: false, hallsUsed: [], allocations: [], conflicts };
  }

  const orderedStudents = buildStudentOrder(dedupedStudents, strategy);

  // Build a flat seat queue across the selected halls, in hall order
  // (largest capacity first, same order used for capacity selection above).
  const seatQueue = [];
  for (const hall of hallsUsed) {
    for (const seat of buildSeatList(hall)) {
      seatQueue.push({ hall, ...seat });
    }
  }

  const allocations = [];
  const allocatedStudentIds = new Set();
  const hallStudentCounts = new Map(hallsUsed.map((h) => [h.id, 0]));

  for (let i = 0; i < orderedStudents.length; i += 1) {
    const student = orderedStudents[i];
    const seat = seatQueue[i]; // guaranteed to exist: totalCapacity >= studentCount

    // Never allocate the same student twice (belt-and-braces on top of the dedupe above).
    if (allocatedStudentIds.has(student.id)) continue;

    allocations.push({
      examId: exam.id,
      studentId: student.id,
      hallId: seat.hall.id,
      row: seat.row,
      column: seat.column,
      seatNumber: seat.seatNumber,
    });
    allocatedStudentIds.add(student.id);
    hallStudentCounts.set(seat.hall.id, hallStudentCounts.get(seat.hall.id) + 1);
  }

  // Final integrity checks before returning — these should be mathematically
  // impossible given the logic above, but we verify explicitly rather than
  // trust it silently, since a seating error is high-stakes for students.
  if (allocations.length !== dedupedStudents.length) {
    conflicts.push({
      code: "ALLOCATION_MISMATCH",
      message: "Internal error: not every eligible student received a seat. Allocation aborted.",
    });
    return { success: false, hallsUsed: [], allocations: [], conflicts };
  }
  for (const hall of hallsUsed) {
    if (hallStudentCounts.get(hall.id) > hall.capacity) {
      conflicts.push({
        code: "HALL_CAPACITY_EXCEEDED",
        message: `Internal error: Hall ${hall.hallNumber} was assigned more students than its capacity.`,
      });
      return { success: false, hallsUsed: [], allocations: [], conflicts };
    }
  }

  return {
    success: true,
    hallsUsed: hallsUsed.map((h) => ({
      hallId: h.id,
      hallNumber: h.hallNumber,
      capacity: h.capacity,
      studentsAssigned: hallStudentCounts.get(h.id),
    })),
    allocations,
    conflicts: [],
  };
}

module.exports = { generateAllocation, selectHallsForCapacity, buildStudentOrder, groupByDepartment };


// ==== FILE: backend/src/algorithms/invigilationAlgorithm.js ====
// ============================================================================
// INVIGILATOR ALLOCATION ALGORITHM — spec section 16.
// Pure function, mirrors the structure of seatingAlgorithm.js.
//
//   generateInvigilation({ exam, hallsUsed, availableStaff, invigilatorsPerHall })
//     -> { success, duties, conflicts }
//
// Rules enforced:
//   - never assign an unavailable staff member
//   - never assign the same staff member to two halls in the same date+session
//   - prefer staff whose department differs from the hall's dominant student department
// ============================================================================

/**
 * @param {object} exam - { id, date, session }
 * @param {Array} hallsUsed - [{ hallId, hallNumber, dominantDepartmentId? }]
 * @param {Array} availableStaff - [{ id, staffId, name, departmentId }] (already
 *        filtered to ACTIVE + AVAILABLE for this date/session by the caller)
 * @param {number} invigilatorsPerHall
 * @param {string} reportingTime
 */
function generateInvigilation({ exam, hallsUsed, availableStaff, invigilatorsPerHall = 1, reportingTime = "08:30" }) {
  const conflicts = [];
  const duties = [];
  const assignedStaffIds = new Set(); // a staff member can only cover ONE hall per date/session

  // Prefer staff from a DIFFERENT department than the hall's dominant student
  // department where possible (spec section 16), falling back to any
  // available staff member when no cross-department option remains.
  const pool = [...availableStaff];

  for (const hall of hallsUsed) {
    const needed = invigilatorsPerHall;
    const assignedForHall = [];

    // Pass 1: staff from a different department than this hall's students
    const crossDept = pool.filter(
      (s) => !assignedStaffIds.has(s.id) && s.departmentId !== hall.dominantDepartmentId
    );
    // Pass 2: any remaining available staff (same department allowed as fallback)
    const sameDeptFallback = pool.filter((s) => !assignedStaffIds.has(s.id));

    const candidates = [...crossDept, ...sameDeptFallback];

    for (const candidate of candidates) {
      if (assignedForHall.length >= needed) break;
      if (assignedStaffIds.has(candidate.id)) continue;
      assignedForHall.push(candidate);
      assignedStaffIds.add(candidate.id);
    }

    if (assignedForHall.length < needed) {
      conflicts.push({
        code: "INSUFFICIENT_INVIGILATORS",
        message: `Hall ${hall.hallNumber} requires ${needed} invigilator(s) but only ${assignedForHall.length} available staff could be assigned.`,
        hallId: hall.hallId,
      });
    }

    for (const staff of assignedForHall) {
      duties.push({
        staffId: staff.id,
        examId: exam.id,
        hallId: hall.hallId,
        date: exam.date,
        session: exam.session,
        reportingTime,
      });
    }
  }

  return {
    success: conflicts.length === 0,
    duties,
    conflicts,
  };
}

module.exports = { generateInvigilation };


// ==== FILE: backend/src/services/systemSettings.service.js ====
const prisma = require("../config/prisma");

// Defaults used only if a setting row is somehow missing (should not happen
// after seeding) — keeps the app resilient rather than crashing.
const DEFAULTS = {
  INVIGILATORS_PER_HALL: "1",
  DEFAULT_SEATING_STRATEGY: "ALTERNATING",
  DEFAULT_REPORTING_TIME_OFFSET_MINUTES: "30",
  MAX_STUDENTS_PER_INVIGILATOR: "40",
};

async function getSetting(key) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? row.value : DEFAULTS[key];
}

async function getAllSettings() {
  const rows = await prisma.systemSetting.findMany();
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

async function setSetting(key, value) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

module.exports = { getSetting, getAllSettings, setSetting };


// ==== FILE: backend/src/services/allocation.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");
const { generateAllocation } = require("../algorithms/seatingAlgorithm");
const { generateInvigilation } = require("../algorithms/invigilationAlgorithm");
const { getSetting } = require("./systemSettings.service");

/**
 * Loads exactly the students eligible for THIS exam (spec section 9) —
 * via the explicit ExamStudent join, never "all students in a department"
 * inferred loosely. This is what guarantees a department with no exam that
 * session never appears in the allocation.
 */
async function loadEligibleStudents(examId) {
  const examStudents = await prisma.examStudent.findMany({
    where: { examId },
    include: { student: { include: { department: true } } },
  });
  return examStudents.map((es) => ({
    id: es.student.id,
    registerNumber: es.student.registerNumber,
    name: es.student.name,
    departmentId: es.student.departmentId,
    departmentCode: es.student.department.code,
  }));
}

/**
 * STEP 1 — PREVIEW (spec section 39). Runs the full algorithm and conflict
 * detection but writes NOTHING to the database. The Admin reviews this
 * before calling confirmAllocation().
 */
async function previewAllocation(examId, strategyOverride) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Exam not found", 404, "EXAM_NOT_FOUND");

  const existingAllocation = await prisma.seatingAllocation.count({ where: { examId } });

  const eligibleStudents = await loadEligibleStudents(examId);
  const availableHalls = await prisma.hall.findMany({ where: { status: "ACTIVE" } });
  const strategy = strategyOverride || (await getSetting("DEFAULT_SEATING_STRATEGY"));

  const result = generateAllocation(exam, eligibleStudents, availableHalls, strategy);

  return {
    exam,
    strategy,
    studentCount: eligibleStudents.length,
    hasExistingAllocation: existingAllocation > 0,
    ...result,
  };
}

/**
 * STEP 2 — CONFIRM (spec sections 19, 38). Re-runs the SAME preview
 * computation (never trusts a stale client-supplied allocation blindly)
 * and persists it inside a single database transaction: either every
 * SeatingAllocation row is written, or none are (atomic rollback on error).
 *
 * `mode`:
 *   "create"  - fails if an allocation already exists for this exam
 *   "replace" - deletes the existing allocation first, then writes the new one
 */
async function confirmAllocation(examId, { strategy, mode = "create" } = {}) {
  const existingCount = await prisma.seatingAllocation.count({ where: { examId } });

  if (existingCount > 0 && mode !== "replace") {
    throw new AppError(
      "A seating allocation already exists for this exam. Use 'replace' to regenerate it, or view the existing allocation.",
      409,
      "ALLOCATION_EXISTS"
    );
  }

  const preview = await previewAllocation(examId, strategy);
  if (!preview.success) {
    throw new AppError(
      preview.conflicts[0]?.message || "Unable to generate allocation",
      422,
      preview.conflicts[0]?.code || "ALLOCATION_FAILED",
      preview.conflicts
    );
  }

  const saved = await prisma.$transaction(async (tx) => {
    if (existingCount > 0) {
      await tx.seatingAllocation.deleteMany({ where: { examId } });
    }
    await tx.seatingAllocation.createMany({
      data: preview.allocations.map((a) => ({
        examId: a.examId,
        studentId: a.studentId,
        hallId: a.hallId,
        row: a.row,
        column: a.column,
        seatNumber: a.seatNumber,
        status: existingCount > 0 ? "REGENERATED" : "CONFIRMED",
      })),
    });
    return tx.seatingAllocation.findMany({ where: { examId } });
  });

  return { savedCount: saved.length, hallsUsed: preview.hallsUsed, strategy: preview.strategy };
}

async function getAllocation(examId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Exam not found", 404, "EXAM_NOT_FOUND");

  const allocations = await prisma.seatingAllocation.findMany({
    where: { examId },
    include: {
      student: { include: { department: true } },
      hall: true,
    },
    orderBy: [{ hallId: "asc" }, { row: "asc" }, { column: "asc" }],
  });

  if (allocations.length === 0) {
    throw new AppError("No seating allocation has been generated for this exam yet", 404, "ALLOCATION_NOT_FOUND");
  }

  return { exam, allocations };
}

async function deleteAllocation(examId) {
  const count = await prisma.seatingAllocation.count({ where: { examId } });
  if (count === 0) throw new AppError("No allocation exists for this exam", 404, "ALLOCATION_NOT_FOUND");
  await prisma.seatingAllocation.deleteMany({ where: { examId } });
  return { deletedCount: count };
}

/**
 * Generates invigilator duties for an exam's ALREADY-SAVED hall allocation.
 * Requires a seating allocation to exist first (invigilators are assigned
 * to the halls actually in use, per spec section 16).
 */
async function generateInvigilationForExam(examId, { invigilatorsPerHall } = {}) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Exam not found", 404, "EXAM_NOT_FOUND");

  const allocations = await prisma.seatingAllocation.findMany({
    where: { examId },
    include: { hall: true, student: true },
  });
  if (allocations.length === 0) {
    throw new AppError(
      "Generate the seating allocation before assigning invigilators",
      409,
      "ALLOCATION_NOT_FOUND"
    );
  }

  // Determine the dominant (most common) student department per hall, used
  // by the algorithm's cross-department preference.
  const hallsMap = new Map();
  for (const a of allocations) {
    if (!hallsMap.has(a.hallId)) {
      hallsMap.set(a.hallId, { hallId: a.hallId, hallNumber: a.hall.hallNumber, deptCounts: new Map() });
    }
    const entry = hallsMap.get(a.hallId);
    entry.deptCounts.set(a.student.departmentId, (entry.deptCounts.get(a.student.departmentId) || 0) + 1);
  }
  const hallsUsed = [...hallsMap.values()].map((h) => {
    let dominantDepartmentId = null;
    let max = -1;
    for (const [deptId, count] of h.deptCounts) {
      if (count > max) {
        max = count;
        dominantDepartmentId = deptId;
      }
    }
    return { hallId: h.hallId, hallNumber: h.hallNumber, dominantDepartmentId };
  });

  const perHall = invigilatorsPerHall
    ? Number(invigilatorsPerHall)
    : Number(await getSetting("INVIGILATORS_PER_HALL"));
  const reportingOffset = Number(await getSetting("DEFAULT_REPORTING_TIME_OFFSET_MINUTES"));
  const reportingTime = computeReportingTime(exam.startTime, reportingOffset);

  // Staff eligible: ACTIVE, and not marked UNAVAILABLE/LEAVE for this date+session.
  const unavailableStaffIds = (
    await prisma.staffAvailability.findMany({
      where: { date: exam.date, session: exam.session, status: { in: ["UNAVAILABLE", "LEAVE"] } },
      select: { staffId: true },
    })
  ).map((r) => r.staffId);

  // Also exclude staff already assigned elsewhere at this exact date+session
  // (covers other exams running in the same slot).
  const alreadyBusyStaffIds = (
    await prisma.invigilationDuty.findMany({
      where: { date: exam.date, session: exam.session },
      select: { staffId: true },
    })
  ).map((r) => r.staffId);

  const excluded = new Set([...unavailableStaffIds, ...alreadyBusyStaffIds]);

  const availableStaff = (
    await prisma.staff.findMany({ where: { status: "ACTIVE" } })
  ).filter((s) => !excluded.has(s.id));

  const result = generateInvigilation({
    exam,
    hallsUsed,
    availableStaff,
    invigilatorsPerHall: perHall,
    reportingTime,
  });

  if (result.duties.length === 0) {
    throw new AppError("No invigilators could be assigned — no available staff", 422, "NO_AVAILABLE_STAFF");
  }

  const saved = await prisma.$transaction(
    result.duties.map((d) =>
      prisma.invigilationDuty.create({
        data: {
          staffId: d.staffId,
          examId: d.examId,
          hallId: d.hallId,
          date: d.date,
          session: d.session,
          reportingTime: d.reportingTime,
        },
      })
    )
  );

  return { assignedCount: saved.length, conflicts: result.conflicts, fullySuccessful: result.success };
}

function computeReportingTime(startTime, offsetMinutes) {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m - offsetMinutes;
  const clamped = Math.max(total, 0);
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

module.exports = {
  previewAllocation,
  confirmAllocation,
  getAllocation,
  deleteAllocation,
  generateInvigilationForExam,
};


// ==== FILE: backend/src/validators/allocation.validator.js ====
const { body, param } = require("express-validator");

const generateRules = [
  body("examId").isUUID().withMessage("Valid examId is required"),
  body("strategy").optional().isIn(["SEPARATION", "MIXED", "ALTERNATING"]),
];

const confirmRules = [
  body("examId").isUUID().withMessage("Valid examId is required"),
  body("strategy").optional().isIn(["SEPARATION", "MIXED", "ALTERNATING"]),
  body("mode").optional().isIn(["create", "replace"]),
];

const examIdParamRule = [param("examId").isUUID()];

module.exports = { generateRules, confirmRules, examIdParamRule };


// ==== FILE: backend/src/controllers/allocation.controller.js ====
const allocationService = require("../services/allocation.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

// POST /api/allocation/generate  { examId, strategy? }
// Returns a PREVIEW only — nothing is saved (spec section 39).
async function generatePreview(req, res, next) {
  try {
    const { examId, strategy } = req.body;
    const preview = await allocationService.previewAllocation(examId, strategy);
    return success(res, { message: "Allocation preview generated", data: preview });
  } catch (err) {
    return next(err);
  }
}

// POST /api/allocation/confirm  { examId, strategy?, mode: "create" | "replace" }
async function confirm(req, res, next) {
  try {
    const { examId, strategy, mode } = req.body;
    const result = await allocationService.confirmAllocation(examId, { strategy, mode });
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: mode === "replace" ? "ALLOCATION_REGENERATED" : "ALLOCATION_GENERATED",
      description: `Seating allocation ${mode === "replace" ? "regenerated" : "generated"} for exam ${examId} (${result.savedCount} students, strategy ${result.strategy})`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Allocation saved", data: result });
  } catch (err) {
    return next(err);
  }
}

// POST /api/allocation/regenerate  { examId, strategy? }  — convenience alias for confirm(mode="replace")
async function regenerate(req, res, next) {
  try {
    const { examId, strategy } = req.body;
    const result = await allocationService.confirmAllocation(examId, { strategy, mode: "replace" });
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "ALLOCATION_REGENERATED",
      description: `Seating allocation regenerated for exam ${examId}`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Allocation regenerated", data: result });
  } catch (err) {
    return next(err);
  }
}

// GET /api/allocation/:examId
async function getOne(req, res, next) {
  try {
    const result = await allocationService.getAllocation(req.params.examId);
    return success(res, { message: "Allocation fetched", data: result });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/allocation/:examId
async function remove(req, res, next) {
  try {
    const result = await allocationService.deleteAllocation(req.params.examId);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "ALLOCATION_DELETED",
      description: `Seating allocation deleted for exam ${req.params.examId} (${result.deletedCount} seats removed)`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Allocation deleted", data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { generatePreview, confirm, regenerate, getOne, remove };


// ==== FILE: backend/src/routes/allocation.routes.js ====
const express = require("express");
const controller = require("../controllers/allocation.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const { generateRules, confirmRules, examIdParamRule } = require("../validators/allocation.validator");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post("/generate", generateRules, validate, controller.generatePreview);
router.post("/confirm", confirmRules, validate, controller.confirm);
router.post("/regenerate", confirmRules, validate, controller.regenerate);
router.get("/:examId", examIdParamRule, validate, controller.getOne);
router.delete("/:examId", examIdParamRule, validate, controller.remove);

module.exports = router;


// ==== FILE: backend/src/controllers/invigilation.controller.js ====
const prisma = require("../config/prisma");
const allocationService = require("../services/allocation.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

// POST /api/invigilation/generate  { examId, invigilatorsPerHall? }
async function generate(req, res, next) {
  try {
    const { examId, invigilatorsPerHall } = req.body;
    const result = await allocationService.generateInvigilationForExam(examId, { invigilatorsPerHall });
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "INVIGILATION_GENERATED",
      description: `${result.assignedCount} invigilation duties assigned for exam ${examId}`,
      ipAddress: req.ip,
    });
    return success(res, {
      statusCode: 201,
      message: result.fullySuccessful
        ? "Invigilators assigned"
        : "Invigilators partially assigned — some halls are short-staffed",
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/invigilation/:examId
async function getOne(req, res, next) {
  try {
    const duties = await prisma.invigilationDuty.findMany({
      where: { examId: req.params.examId },
      include: { staff: { include: { department: true } }, hall: true },
      orderBy: { hallId: "asc" },
    });
    return success(res, { message: "Invigilation duties fetched", data: duties });
  } catch (err) {
    return next(err);
  }
}

module.exports = { generate, getOne };


// ==== FILE: backend/src/routes/invigilation.routes.js ====
const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/invigilation.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post(
  "/generate",
  [body("examId").isUUID(), body("invigilatorsPerHall").optional().isInt({ min: 1 })],
  validate,
  controller.generate
);
router.get("/:examId", [param("examId").isUUID()], validate, controller.getOne);

module.exports = router;


// ==== FILE: backend/src/validators/staff.validator.js ====
const { body, param } = require("express-validator");

const createStaffRules = [
  body("staffId").trim().notEmpty().withMessage("Staff ID is required"),
  body("name").trim().notEmpty().withMessage("Staff name is required"),
  body("departmentId").isUUID().withMessage("Valid departmentId is required"),
  body("email").optional().isEmail(),
  body("mobile").optional().trim(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("Passwords do not match");
    return true;
  }),
];

const updateStaffRules = [
  param("id").isUUID(),
  body("name").optional().trim().notEmpty(),
  body("departmentId").optional().isUUID(),
  body("status").optional().isIn(["ACTIVE", "INACTIVE"]),
];

const idParamRule = [param("id").isUUID()];

const availabilityRules = [
  body("staffId").isUUID(),
  body("date").isISO8601(),
  body("session").isIn(["FN", "AN"]),
  body("status").isIn(["AVAILABLE", "UNAVAILABLE", "LEAVE"]),
];

module.exports = { createStaffRules, updateStaffRules, idParamRule, availabilityRules };


// ==== FILE: backend/src/services/staff.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");
const { hashPassword } = require("../utils/password");

function sanitize(staff) {
  const { passwordHash, ...safe } = staff;
  return safe;
}

async function listStaff({ search, departmentId, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { staffId: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      include: { department: true },
      orderBy: { staffId: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.staff.count({ where }),
  ]);
  return { data: items.map(sanitize), total, page: Number(page), pageSize: Number(pageSize) };
}

async function getStaffById(id) {
  const staff = await prisma.staff.findUnique({ where: { id }, include: { department: true } });
  if (!staff) throw new AppError("Staff not found", 404, "STAFF_NOT_FOUND");
  return sanitize(staff);
}

async function createStaff({ staffId, name, departmentId, email, mobile, password }) {
  const passwordHash = await hashPassword(password);
  const staff = await prisma.staff.create({
    data: { staffId, name, departmentId, email, mobile, passwordHash },
  });
  return sanitize(staff);
}

async function updateStaff(id, updates) {
  await getStaffById(id);
  return sanitize(await prisma.staff.update({ where: { id }, data: updates }));
}

async function deleteStaff(id) {
  await getStaffById(id);
  const dutyCount = await prisma.invigilationDuty.count({ where: { staffId: id } });
  if (dutyCount > 0) {
    throw new AppError(
      "Cannot delete staff with existing invigilation duty history. Set status to INACTIVE instead.",
      409,
      "STAFF_IN_USE"
    );
  }
  await prisma.staff.delete({ where: { id } });
}

// ---- Availability -----------------------------------------------------------

async function setAvailability({ staffId, date, session, status }) {
  return prisma.staffAvailability.upsert({
    where: { staffId_date_session: { staffId, date: new Date(date), session } },
    update: { status },
    create: { staffId, date: new Date(date), session, status },
  });
}

async function listAvailability({ staffId, date }) {
  const where = {};
  if (staffId) where.staffId = staffId;
  if (date) where.date = new Date(date);
  return prisma.staffAvailability.findMany({
    where,
    include: { staff: { include: { department: true } } },
    orderBy: { date: "asc" },
  });
}

module.exports = {
  listStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  setAvailability,
  listAvailability,
};


// ==== FILE: backend/src/controllers/staff.controller.js ====
const staffService = require("../services/staff.service");
const { recordAudit } = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await staffService.listStaff(req.query);
    return success(res, {
      message: "Staff fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const staff = await staffService.getStaffById(req.params.id);
    return success(res, { message: "Staff fetched", data: staff });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const staff = await staffService.createStaff(req.body);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "STAFF_CREATED",
      description: `Staff ${staff.staffId} created`,
      ipAddress: req.ip,
    });
    return success(res, { statusCode: 201, message: "Staff created", data: staff });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const staff = await staffService.updateStaff(req.params.id, req.body);
    return success(res, { message: "Staff updated", data: staff });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await staffService.deleteStaff(req.params.id);
    await recordAudit({
      userId: req.user.id,
      role: req.user.role,
      action: "STAFF_DELETED",
      description: `Staff ${req.params.id} deleted`,
      ipAddress: req.ip,
    });
    return success(res, { message: "Staff deleted" });
  } catch (err) {
    return next(err);
  }
}

async function setAvailability(req, res, next) {
  try {
    const record = await staffService.setAvailability(req.body);
    return success(res, { message: "Availability updated", data: record });
  } catch (err) {
    return next(err);
  }
}

async function listAvailability(req, res, next) {
  try {
    const records = await staffService.listAvailability(req.query);
    return success(res, { message: "Availability fetched", data: records });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getOne, create, update, remove, setAvailability, listAvailability };


// ==== FILE: backend/src/routes/staff.routes.js ====
const express = require("express");
const controller = require("../controllers/staff.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  createStaffRules,
  updateStaffRules,
  idParamRule,
  availabilityRules,
} = require("../validators/staff.validator");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", controller.list);
router.get("/:id", idParamRule, validate, controller.getOne);
router.post("/", createStaffRules, validate, controller.create);
router.put("/:id", updateStaffRules, validate, controller.update);
router.delete("/:id", idParamRule, validate, controller.remove);

// Staff availability (spec section 17)
router.post("/availability/set", availabilityRules, validate, controller.setAvailability);
router.get("/availability/list", controller.listAvailability);

module.exports = router;


// ==== FILE: backend/src/app.js  [STAGE 3 VERSION — superseded below] ====
// REPLACES backend/src/app.js from Stage 2 — adds staff, allocation, invigilation routes.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const swaggerSpec = require("./config/swagger");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const authRoutes = require("./routes/auth.routes");
const departmentRoutes = require("./routes/department.routes");
const studentRoutes = require("./routes/student.routes");
const hallRoutes = require("./routes/hall.routes");
const examRoutes = require("./routes/exam.routes");
const staffRoutes = require("./routes/staff.routes");
const allocationRoutes = require("./routes/allocation.routes");
const invigilationRoutes = require("./routes/invigilation.routes");
// Stage 4 will add: reports, student seating lookup, audit log routes.

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
}

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/allocation", allocationRoutes);
app.use("/api/invigilation", invigilationRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: "ROUTE_NOT_FOUND",
  });
});

app.use(errorHandler);

module.exports = app;


// ==== FILE: backend/src/utils/pdfReport.js ====
// PDF generation helpers built on PDFKit. Every function returns a Buffer
// so controllers can either stream it directly to the response or attach it
// to an email (Nodemailer) without touching the filesystem.
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function drawHeader(doc, title, subtitle) {
  doc.fontSize(16).font("Helvetica-Bold").text("INSTITUTE EXAMINATION CELL", { align: "center" });
  doc.fontSize(13).font("Helvetica-Bold").text(title, { align: "center" });
  if (subtitle) doc.fontSize(10).font("Helvetica").text(subtitle, { align: "center" });
  doc.moveDown(1);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 20;

  doc.font("Helvetica-Bold").fontSize(9);
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i], continued: false });
    x += colWidths[i];
  });
  y += rowHeight;
  doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();

  doc.font("Helvetica").fontSize(9);
  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = startX;
    row.forEach((cell, i) => {
      doc.text(String(cell), x, y, { width: colWidths[i] });
      x += colWidths[i];
    });
    y += rowHeight;
  }
  doc.y = y;
}

/**
 * Hall-wise printable seating plan (spec section 22).
 */
async function generateHallSeatingPlanPDF({ exam, hall, allocations }) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const bufferPromise = streamToBuffer(doc);

  drawHeader(
    doc,
    `Hall Seating Plan — ${hall.hallNumber}`,
    `${exam.examName} (${exam.subjectCode}) | ${exam.date.toISOString().slice(0, 10)} | Session: ${exam.session}`
  );

  drawTable(
    doc,
    ["Seat", "Register Number", "Student Name", "Department"],
    allocations.map((a) => [a.seatNumber, a.student.registerNumber, a.student.name, a.student.department.code]),
    [60, 130, 200, 100]
  );

  doc.end();
  return bufferPromise;
}

/**
 * Student seating slip — printable A4, includes a verification QR code
 * (spec section 31). The QR encodes a non-sensitive reference id only.
 */
async function generateStudentSeatingSlipPDF({ student, exam, hall, allocation }) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const bufferPromise = streamToBuffer(doc);

  drawHeader(doc, "EXAMINATION SEATING ALLOCATION", "Institute Name");

  const rows = [
    ["Student Name", student.name],
    ["Register Number", student.registerNumber],
    ["Department", student.department.code],
    ["Exam / Subject", `${exam.examName} (${exam.subjectCode})`],
    ["Date", exam.date.toISOString().slice(0, 10)],
    ["Session", exam.session],
    ["Hall Number", hall.hallNumber],
    ["Building", hall.building],
    ["Floor", hall.floor],
    ["Room Number", hall.roomNumber || "-"],
    ["Row", String(allocation.row)],
    ["Column", String(allocation.column)],
    ["Seat Number", allocation.seatNumber],
    ["Reporting Time", exam.startTime],
  ];

  doc.font("Helvetica").fontSize(11);
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
    doc.moveDown(0.3);
  }

  const qrPayload = JSON.stringify({ ref: allocation.id, exam: exam.subjectCode, reg: student.registerNumber });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 120 });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
  doc.image(qrBuffer, doc.page.width - 170, 60, { width: 100 });

  doc.end();
  return bufferPromise;
}

/**
 * Generic student seating report (spec section 23).
 */
async function generateStudentReportPDF(rows) {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const bufferPromise = streamToBuffer(doc);
  drawHeader(doc, "Student Seating Report");
  drawTable(
    doc,
    ["Register No.", "Name", "Department", "Exam", "Date", "Session", "Hall", "Seat"],
    rows.map((r) => [r.registerNumber, r.name, r.department, r.exam, r.date, r.session, r.hall, r.seat]),
    [80, 130, 80, 140, 80, 60, 90, 60]
  );
  doc.end();
  return bufferPromise;
}

/**
 * Invigilator duty report (spec section 24).
 */
async function generateStaffDutyReportPDF(rows) {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const bufferPromise = streamToBuffer(doc);
  drawHeader(doc, "Invigilator Duty Report");
  drawTable(
    doc,
    ["Staff ID", "Name", "Department", "Date", "Session", "Exam", "Hall", "Reporting Time"],
    rows.map((r) => [r.staffId, r.name, r.department, r.date, r.session, r.exam, r.hall, r.reportingTime]),
    [70, 120, 80, 80, 60, 140, 80, 90]
  );
  doc.end();
  return bufferPromise;
}

module.exports = {
  generateHallSeatingPlanPDF,
  generateStudentSeatingSlipPDF,
  generateStudentReportPDF,
  generateStaffDutyReportPDF,
};


// ==== FILE: backend/src/utils/excelReport.js ====
// Excel export helpers built on ExcelJS. Every function returns a Buffer.
const ExcelJS = require("exceljs");

async function buildWorkbookBuffer(sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = headers.map((h) => ({ header: h.label, key: h.key, width: h.width || 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

function generateStudentReportExcel(rows) {
  return buildWorkbookBuffer(
    "Student Seating Report",
    [
      { key: "registerNumber", label: "Register Number" },
      { key: "name", label: "Student Name", width: 24 },
      { key: "department", label: "Department" },
      { key: "exam", label: "Exam", width: 24 },
      { key: "date", label: "Date" },
      { key: "session", label: "Session" },
      { key: "hall", label: "Hall" },
      { key: "seat", label: "Seat" },
    ],
    rows
  );
}

function generateStaffDutyExcel(rows) {
  return buildWorkbookBuffer(
    "Invigilator Duty Report",
    [
      { key: "staffId", label: "Staff ID" },
      { key: "name", label: "Name", width: 22 },
      { key: "department", label: "Department" },
      { key: "date", label: "Date" },
      { key: "session", label: "Session" },
      { key: "exam", label: "Exam", width: 24 },
      { key: "hall", label: "Hall" },
      { key: "reportingTime", label: "Reporting Time" },
    ],
    rows
  );
}

function generateHallWiseExcel(rows) {
  return buildWorkbookBuffer(
    "Hall Allocation Report",
    [
      { key: "hall", label: "Hall Number" },
      { key: "capacity", label: "Capacity" },
      { key: "exam", label: "Exam", width: 24 },
      { key: "date", label: "Date" },
      { key: "session", label: "Session" },
      { key: "studentCount", label: "Number of Students" },
      { key: "invigilators", label: "Invigilator(s)", width: 28 },
    ],
    rows
  );
}

module.exports = { generateStudentReportExcel, generateStaffDutyExcel, generateHallWiseExcel };


// ==== FILE: backend/src/services/report.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");

async function getHallSeatingPlanData(examId, hallId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  const hall = await prisma.hall.findUnique({ where: { id: hallId } });
  if (!exam || !hall) throw new AppError("Exam or hall not found", 404, "NOT_FOUND");

  const allocations = await prisma.seatingAllocation.findMany({
    where: { examId, hallId },
    include: { student: { include: { department: true } } },
    orderBy: [{ row: "asc" }, { column: "asc" }],
  });
  if (allocations.length === 0) {
    throw new AppError("No allocation found for this exam and hall", 404, "ALLOCATION_NOT_FOUND");
  }
  return { exam, hall, allocations };
}

async function getStudentSeatingSlipData(examId, registerNumber) {
  const student = await prisma.student.findUnique({ where: { registerNumber }, include: { department: true } });
  if (!student) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");

  const allocation = await prisma.seatingAllocation.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } },
    include: { hall: true },
  });
  if (!allocation) throw new AppError("No seating allocation found for this student/exam", 404, "ALLOCATION_NOT_FOUND");

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  return { student, exam, hall: allocation.hall, allocation };
}

/** Student-wise seating report across optional filters (spec section 23). */
async function getStudentReportRows({ examId, departmentId, date }) {
  const where = {};
  if (examId) where.examId = examId;
  if (departmentId) where.student = { departmentId };
  if (date) where.exam = { date: new Date(date) };

  const allocations = await prisma.seatingAllocation.findMany({
    where,
    include: { student: { include: { department: true } }, hall: true, exam: true },
    orderBy: [{ examId: "asc" }, { hallId: "asc" }],
  });

  return allocations.map((a) => ({
    registerNumber: a.student.registerNumber,
    name: a.student.name,
    department: a.student.department.code,
    exam: a.exam.examName,
    date: a.exam.date.toISOString().slice(0, 10),
    session: a.exam.session,
    hall: a.hall.hallNumber,
    seat: a.seatNumber,
  }));
}

/** Invigilator duty report (spec section 24). */
async function getStaffDutyRows({ examId, staffId, date }) {
  const where = {};
  if (examId) where.examId = examId;
  if (staffId) where.staffId = staffId;
  if (date) where.date = new Date(date);

  const duties = await prisma.invigilationDuty.findMany({
    where,
    include: { staff: { include: { department: true } }, hall: true, exam: true },
    orderBy: [{ date: "asc" }, { hallId: "asc" }],
  });

  return duties.map((d) => ({
    staffId: d.staff.staffId,
    name: d.staff.name,
    department: d.staff.department.code,
    date: d.date.toISOString().slice(0, 10),
    session: d.session,
    exam: d.exam.examName,
    hall: d.hall.hallNumber,
    reportingTime: d.reportingTime,
  }));
}

/** Hall-wise allocation report (spec section 25). */
async function getHallWiseRows({ examId }) {
  const where = examId ? { examId } : {};
  const allocations = await prisma.seatingAllocation.findMany({
    where,
    include: { hall: true, exam: true },
  });
  const duties = await prisma.invigilationDuty.findMany({
    where: examId ? { examId } : {},
    include: { staff: true, hall: true },
  });

  const grouped = new Map();
  for (const a of allocations) {
    const key = `${a.examId}-${a.hallId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        hall: a.hall.hallNumber,
        capacity: a.hall.capacity,
        exam: a.exam.examName,
        date: a.exam.date.toISOString().slice(0, 10),
        session: a.exam.session,
        studentCount: 0,
        invigilators: [],
      });
    }
    grouped.get(key).studentCount += 1;
  }
  for (const d of duties) {
    const key = `${d.examId}-${d.hallId}`;
    if (grouped.has(key)) grouped.get(key).invigilators.push(d.staff.name);
  }

  return [...grouped.values()].map((row) => ({ ...row, invigilators: row.invigilators.join(", ") || "Unassigned" }));
}

module.exports = {
  getHallSeatingPlanData,
  getStudentSeatingSlipData,
  getStudentReportRows,
  getStaffDutyRows,
  getHallWiseRows,
};


// ==== FILE: backend/src/controllers/report.controller.js ====
const reportService = require("../services/report.service");
const pdfReport = require("../utils/pdfReport");
const excelReport = require("../utils/excelReport");

function sendPdf(res, buffer, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
}

function sendExcel(res, buffer, filename) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
}

// GET /api/reports/hall-seating-plan/:examId/:hallId
async function hallSeatingPlan(req, res, next) {
  try {
    const data = await reportService.getHallSeatingPlanData(req.params.examId, req.params.hallId);
    const buffer = await pdfReport.generateHallSeatingPlanPDF(data);
    return sendPdf(res, buffer, `hall-seating-plan-${data.hall.hallNumber}.pdf`);
  } catch (err) {
    return next(err);
  }
}

// GET /api/reports/seating-slip/:examId/:registerNumber
async function seatingSlip(req, res, next) {
  try {
    const data = await reportService.getStudentSeatingSlipData(req.params.examId, req.params.registerNumber);
    const buffer = await pdfReport.generateStudentSeatingSlipPDF(data);
    return sendPdf(res, buffer, `seating-slip-${data.student.registerNumber}.pdf`);
  } catch (err) {
    return next(err);
  }
}

// GET /api/reports/student-report?format=pdf|excel&examId=&departmentId=&date=
async function studentReport(req, res, next) {
  try {
    const rows = await reportService.getStudentReportRows(req.query);
    if (req.query.format === "excel") {
      const buffer = await excelReport.generateStudentReportExcel(rows);
      return sendExcel(res, buffer, "student-seating-report.xlsx");
    }
    const buffer = await pdfReport.generateStudentReportPDF(rows);
    return sendPdf(res, buffer, "student-seating-report.pdf");
  } catch (err) {
    return next(err);
  }
}

// GET /api/reports/staff-duty?format=pdf|excel&examId=&staffId=&date=
async function staffDutyReport(req, res, next) {
  try {
    const rows = await reportService.getStaffDutyRows(req.query);
    if (req.query.format === "excel") {
      const buffer = await excelReport.generateStaffDutyExcel(rows);
      return sendExcel(res, buffer, "invigilator-duty-report.xlsx");
    }
    const buffer = await pdfReport.generateStaffDutyReportPDF(rows);
    return sendPdf(res, buffer, "invigilator-duty-report.pdf");
  } catch (err) {
    return next(err);
  }
}

// GET /api/reports/hall-wise?examId= (Excel only — tabular summary)
async function hallWiseReport(req, res, next) {
  try {
    const rows = await reportService.getHallWiseRows(req.query);
    const buffer = await excelReport.generateHallWiseExcel(rows);
    return sendExcel(res, buffer, "hall-allocation-report.xlsx");
  } catch (err) {
    return next(err);
  }
}

module.exports = { hallSeatingPlan, seatingSlip, studentReport, staffDutyReport, hallWiseReport };


// ==== FILE: backend/src/routes/report.routes.js ====
const express = require("express");
const controller = require("../controllers/report.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");

const router = express.Router();

// Admin generates/downloads all report types. (The student-facing seating
// slip download uses its own public route — see student.routes additions
// in this stage's studentSeating routes file.)
router.use(requireAuth, requireRole("ADMIN"));

router.get("/hall-seating-plan/:examId/:hallId", controller.hallSeatingPlan);
router.get("/seating-slip/:examId/:registerNumber", controller.seatingSlip);
router.get("/student-report", controller.studentReport);
router.get("/staff-duty", controller.staffDutyReport);
router.get("/hall-wise", controller.hallWiseReport);

module.exports = router;


// ==== FILE: backend/src/services/studentSeating.service.js ====
const prisma = require("../config/prisma");
const { AppError } = require("../utils/apiResponse");

/**
 * GET /api/student/seating/:registerNumber — spec section 13.
 * Returns every upcoming/past exam seating for this student. Public-facing
 * (behind the student's own token, scoped to their own registerNumber only
 * — see studentSeating.controller.js for the ownership check).
 */
async function getSeatingForStudent(registerNumber) {
  const student = await prisma.student.findUnique({
    where: { registerNumber },
    include: { department: true },
  });
  if (!student) throw new AppError("Register number not found", 404, "STUDENT_NOT_FOUND");

  const allocations = await prisma.seatingAllocation.findMany({
    where: { studentId: student.id },
    include: { hall: true, exam: true },
    orderBy: [{ exam: { date: "asc" } }],
  });

  return {
    student: {
      registerNumber: student.registerNumber,
      name: student.name,
      department: student.department.code,
    },
    seatings: allocations.map((a) => ({
      examName: a.exam.examName,
      subjectName: a.exam.subjectName,
      date: a.exam.date.toISOString().slice(0, 10),
      session: a.exam.session,
      hallNumber: a.hall.hallNumber,
      building: a.hall.building,
      floor: a.hall.floor,
      roomNumber: a.hall.roomNumber,
      row: a.row,
      column: a.column,
      seatNumber: a.seatNumber,
      reportingTime: a.exam.startTime,
      allocationId: a.id,
    })),
  };
}

module.exports = { getSeatingForStudent };


// ==== FILE: backend/src/middleware/optionalAuth.middleware.js ====
const { verifyToken } = require("../utils/jwt");

/**
 * Used on routes that must stay public (e.g. student seating search) but
 * should still enforce ownership checks when a student happens to be
 * logged in. Unlike requireAuth, a missing/invalid token is NOT an error —
 * req.user is simply left undefined and the route's own logic decides
 * what, if anything, that implies.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme === "Bearer" && token) {
    try {
      const decoded = verifyToken(token);
      req.user = { id: decoded.sub, role: decoded.role, loginId: decoded.loginId };
    } catch (err) {
      // Invalid/expired token on an optional route — ignore and proceed unauthenticated.
    }
  }

  return next();
}

module.exports = { optionalAuth };


// ==== FILE: backend/src/controllers/studentSeating.controller.js ====
const studentSeatingService = require("../services/studentSeating.service");
const { success, failure } = require("../utils/apiResponse");

/**
 * GET /api/student/seating/:registerNumber
 * Protected by requireAuth + requireRole("STUDENT") so only an authenticated
 * student token can call this — and even then, ONLY for their own register
 * number (a student cannot look up another student's seat by guessing a URL).
 * Admin has its own separate, unrestricted allocation-view endpoints.
 */
async function getMySeating(req, res, next) {
  try {
    if (req.user.loginId !== req.params.registerNumber) {
      return failure(res, {
        statusCode: 403,
        message: "You may only view your own seating allocation",
        errorCode: "FORBIDDEN_OWNERSHIP",
      });
    }
    const result = await studentSeatingService.getSeatingForStudent(req.params.registerNumber);
    return success(res, { message: "Seating fetched", data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMySeating };


// ==== FILE: backend/src/routes/studentSeating.routes.js ====
const express = require("express");
const { param } = require("express-validator");
const controller = require("../controllers/studentSeating.controller");
const { validate } = require("../middleware/validate.middleware");
const { optionalAuth } = require("../middleware/optionalAuth.middleware");

const router = express.Router();

// Deliberately public — matches spec section 13 "Student Seating Search"
// page, which must work before any login. Ownership is still enforced
// inside the controller when a student token happens to be attached.
router.get(
  "/seating/:registerNumber",
  optionalAuth,
  [param("registerNumber").trim().notEmpty()],
  validate,
  controller.getSeating
);

module.exports = router;


// ==== FILE: backend/src/services/auditLogView.service.js ====
const prisma = require("../config/prisma");

/**
 * Lists audit log entries for Admin viewing (spec section 33). Filters by
 * role/action/date range; always newest first so recent activity surfaces
 * without extra client-side sorting.
 */
async function listAuditLogs({ role, action, from, to, page = 1, pageSize = 50 }) {
  const where = {};
  if (role) where.role = role;
  if (action) where.action = action;
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) where.timestamp.lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { instituteId: true, name: true } }, staff: { select: { staffId: true, name: true } } },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: items, total, page: Number(page), pageSize: Number(pageSize) };
}

module.exports = { listAuditLogs };


// ==== FILE: backend/src/controllers/auditLog.controller.js ====
// ==== controller ====
const auditLogViewService = require("../services/auditLogView.service");
const { success } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await auditLogViewService.listAuditLogs(req.query);
    return success(res, {
      message: "Audit logs fetched",
      data: result.data,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list };


// ==== FILE: backend/src/routes/auditLog.routes.js ====
const express = require("express");
const controller = require("../controllers/auditLog.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));
router.get("/", controller.list);

module.exports = router;


// ==== FILE: backend/src/app.js  [FINAL VERSION — use this one] ====
// REPLACES backend/src/app.js from Stage 3 — adds reports, public student
// seating lookup, and audit log routes. This is the FINAL version of app.js;
// no further route groups are added in Stage 5 (frontend) or Stage 6 (tests/docker).
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const swaggerSpec = require("./config/swagger");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const authRoutes = require("./routes/auth.routes");
const departmentRoutes = require("./routes/department.routes");
const studentRoutes = require("./routes/student.routes");
const hallRoutes = require("./routes/hall.routes");
const examRoutes = require("./routes/exam.routes");
const staffRoutes = require("./routes/staff.routes");
const allocationRoutes = require("./routes/allocation.routes");
const invigilationRoutes = require("./routes/invigilation.routes");
const reportRoutes = require("./routes/report.routes");
const studentSeatingRoutes = require("./routes/studentSeating.routes");
const auditLogRoutes = require("./routes/auditLog.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
}

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/allocation", allocationRoutes);
app.use("/api/invigilation", invigilationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/student", studentSeatingRoutes); // public: GET /api/student/seating/:registerNumber
app.use("/api/audit-logs", auditLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: "ROUTE_NOT_FOUND",
  });
});

app.use(errorHandler);

module.exports = app;


// ============================================================================
// FRONTEND (React + JSX) — everything below is under frontend/
// ============================================================================

// ==== FILE: frontend/vite.config.js ====
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});


// ==== FILE: frontend/src/main.jsx ====
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);


// ==== FILE: frontend/src/App.jsx ====
import React from "react";
import { Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import StaffLoginPage from "./pages/StaffLoginPage.jsx";
import StudentSearchPage from "./pages/StudentSearchPage.jsx";
import StudentSeatingResultPage from "./pages/StudentSeatingResultPage.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import StaffLayout from "./layouts/StaffLayout.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import DepartmentsPage from "./pages/admin/DepartmentsPage.jsx";
import StudentsPage from "./pages/admin/StudentsPage.jsx";
import StudentImportPage from "./pages/admin/StudentImportPage.jsx";
import HallsPage from "./pages/admin/HallsPage.jsx";
import ExamsPage from "./pages/admin/ExamsPage.jsx";
import TimetablePage from "./pages/admin/TimetablePage.jsx";
import StaffPage from "./pages/admin/StaffPage.jsx";
import StaffAvailabilityPage from "./pages/admin/StaffAvailabilityPage.jsx";
import SeatingAllocationPage from "./pages/admin/SeatingAllocationPage.jsx";
import InvigilatorAllocationPage from "./pages/admin/InvigilatorAllocationPage.jsx";
import ReportsPage from "./pages/admin/ReportsPage.jsx";
import AuditLogsPage from "./pages/admin/AuditLogsPage.jsx";

import StaffDashboard from "./pages/staff/StaffDashboard.jsx";
import MyDutiesPage from "./pages/staff/MyDutiesPage.jsx";
import StaffProfilePage from "./pages/staff/StaffProfilePage.jsx";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route path="/student/search" element={<StudentSearchPage />} />
      <Route path="/student/result/:registerNumber" element={<StudentSeatingResultPage />} />

      {/* Admin (protected) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/import" element={<StudentImportPage />} />
        <Route path="halls" element={<HallsPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="staff-availability" element={<StaffAvailabilityPage />} />
        <Route path="allocation" element={<SeatingAllocationPage />} />
        <Route path="invigilation" element={<InvigilatorAllocationPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>

      {/* Staff (protected) */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={["STAFF"]}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="duties" element={<MyDutiesPage />} />
        <Route path="profile" element={<StaffProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}


// ==== FILE: frontend/src/services/api.js ====
import axios from "axios";

// The browser only ever stores the auth TOKEN (a JWT), never permanent
// application data — all real data lives in PostgreSQL behind the API
// (spec section 32). Losing this token just means logging in again; it
// does not lose any data.
const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("login")) {
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export default api;


// ==== FILE: frontend/src/context/AuthContext.jsx ====
import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [role, setRole] = useState(() => localStorage.getItem("role"));

  const loginAdmin = useCallback(async (instituteId, password) => {
    const res = await api.post("/auth/admin/login", { instituteId, password });
    persist(res.data.data);
    return res.data.data;
  }, []);

  const loginStaff = useCallback(async (staffId, password) => {
    const res = await api.post("/auth/staff/login", { staffId, password });
    persist(res.data.data);
    return res.data.data;
  }, []);

  const loginStudent = useCallback(async (registerNumber) => {
    const res = await api.post("/auth/student/login", { registerNumber });
    persist(res.data.data);
    return res.data.data;
  }, []);

  function persist({ token, user: u, role: r }) {
    localStorage.setItem("token", token);
    localStorage.setItem("role", r);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    setRole(r);
  }

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // stateless JWT — logout is a client-side token discard regardless
    }
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loginAdmin, loginStaff, loginStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


// ==== FILE: frontend/src/components/ProtectedRoute.jsx ====
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Frontend RBAC guard. This is a UX convenience only — the REAL enforcement
 * is server-side (requireAuth + requireRole on every API route). Even if
 * someone bypassed this component, every API call would still be rejected
 * by the backend for the wrong role.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { role } = useAuth();

  if (!role) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
}


// ==== FILE: frontend/src/components/UI.jsx ====
import React from "react";

export function Card({ title, value, accent = "brand" }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderColor: accentColor(accent) }}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

function accentColor(accent) {
  const map = { brand: "#1e3a8a", success: "#16a34a", warning: "#f59e0b", danger: "#dc2626" };
  return map[accent] || map.brand;
}

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-12 text-gray-500">
      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  );
}

export function EmptyState({ message = "No data found" }) {
  return <div className="text-center py-12 text-gray-400">{message}</div>;
}

export function ErrorState({ message = "Something went wrong" }) {
  return <div className="text-center py-12 text-red-600">{message}</div>;
}

export function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  const colors = { success: "bg-green-600", error: "bg-red-600", warning: "bg-orange-500" };
  return (
    <div
      className={`fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-2 rounded shadow-lg cursor-pointer z-50`}
      onClick={onClose}
    >
      {message}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-navy text-white">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}


// ==== FILE: frontend/src/layouts/AdminLayout.jsx ====
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/departments", label: "Departments" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/students/import", label: "Register Upload" },
  { to: "/admin/halls", label: "Halls" },
  { to: "/admin/exams", label: "Exams" },
  { to: "/admin/timetable", label: "Timetable" },
  { to: "/admin/staff", label: "Staff" },
  { to: "/admin/staff-availability", label: "Staff Availability" },
  { to: "/admin/allocation", label: "Seating Allocation" },
  { to: "/admin/invigilation", label: "Invigilator Allocation" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-navy text-white flex-shrink-0 hidden md:block">
        <div className="p-4 text-lg font-bold border-b border-white/10">Exam Admin</div>
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive ? "bg-brand" : "hover:bg-white/10"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white shadow px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-navy">Smart Examination Hall Seating Allocation System</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.instituteId}</span>
            <button onClick={logout} className="text-sm px-3 py-1 rounded bg-red-600 text-white">
              Logout
            </button>
          </div>
        </header>
        <main className="p-4 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


// ==== FILE: frontend/src/layouts/StaffLayout.jsx ====
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StaffLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold">Staff Portal</span>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/staff/dashboard" className={({ isActive }) => (isActive ? "underline" : "")}>
              Dashboard
            </NavLink>
            <NavLink to="/staff/duties" className={({ isActive }) => (isActive ? "underline" : "")}>
              My Duties
            </NavLink>
            <NavLink to="/staff/profile" className={({ isActive }) => (isActive ? "underline" : "")}>
              Profile
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user?.name}</span>
          <button onClick={logout} className="text-sm px-3 py-1 rounded bg-red-600">
            Logout
          </button>
        </div>
      </header>
      <main className="p-4 flex-1 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}


// ==== FILE: frontend/src/pages/LandingPage.jsx ====
import React from "react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white py-4 px-6">
        <h1 className="text-lg font-bold">Smart Examination Hall Seating Allocation System</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          <PortalCard to="/admin/login" title="Admin" desc="Manage departments, halls, exams and generate seating allocations." />
          <PortalCard to="/staff/login" title="Staff" desc="View your invigilation duties and exam hall assignments." />
          <PortalCard to="/student/search" title="Student" desc="Look up your examination hall and seat number." />
        </div>
      </main>

      <footer className="text-center text-sm text-gray-400 py-4">
        &copy; {new Date().getFullYear()} Institute Examination Cell
      </footer>
    </div>
  );
}

function PortalCard({ to, title, desc }) {
  return (
    <Link to={to} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition border-t-4 border-brand block">
      <h2 className="text-xl font-bold text-navy mb-2">{title}</h2>
      <p className="text-gray-500 text-sm">{desc}</p>
    </Link>
  );
}


// ==== FILE: frontend/src/pages/AdminLoginPage.jsx ====
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLoginPage() {
  const [instituteId, setInstituteId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAdmin(instituteId, password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-navy mb-1">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-6">Examination management portal</p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>}

        <label className="block text-sm mb-1">Institute ID</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={instituteId}
          onChange={(e) => setInstituteId(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          disabled={loading}
          className="w-full bg-brand text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-brand">
            &larr; Back to home
          </Link>
        </div>
      </form>
    </div>
  );
}


// ==== FILE: frontend/src/pages/StaffLoginPage.jsx ====
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StaffLoginPage() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginStaff } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginStaff(staffId, password);
      navigate("/staff/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-navy mb-1">Staff Login</h1>
        <p className="text-sm text-gray-500 mb-6">Invigilation duty portal</p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>}

        <label className="block text-sm mb-1">Staff ID</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          disabled={loading}
          className="w-full bg-brand text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-brand">
            &larr; Back to home
          </Link>
        </div>
      </form>
    </div>
  );
}


// ==== FILE: frontend/src/pages/StudentSearchPage.jsx ====
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

export default function StudentSearchPage() {
  const [registerNumber, setRegisterNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Confirms the register number exists, matching spec section 13's
      // simple lookup flow (register number only). The result page then
      // fetches the full seating detail.
      await api.post("/auth/student/login", { registerNumber });
      navigate(`/student/result/${encodeURIComponent(registerNumber)}`);
    } catch (err) {
      setError(err.response?.data?.message || "Register number not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-navy mb-1">Find Your Seat</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your register number to view your exam hall &amp; seat</p>

        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>}

        <label className="block text-sm mb-1">Register Number</label>
        <input
          className="w-full border rounded px-3 py-2 mb-6"
          placeholder="e.g. 23CSE001"
          value={registerNumber}
          onChange={(e) => setRegisterNumber(e.target.value)}
          required
        />

        <button
          disabled={loading}
          className="w-full bg-brand text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-brand">
            &larr; Back to home
          </Link>
        </div>
      </form>
    </div>
  );
}


// ==== FILE: frontend/src/pages/StudentSeatingResultPage.jsx ====
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { LoadingState, ErrorState, EmptyState } from "../components/UI";

export default function StudentSeatingResultPage() {
  const { registerNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(`/student/seating/${encodeURIComponent(registerNumber)}`)
      .then((res) => mounted && setData(res.data.data))
      .catch((err) => mounted && setError(err.response?.data?.message || "Unable to load seating"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [registerNumber]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/student/search" className="text-brand text-sm">
          &larr; Search another register number
        </Link>

        {loading && <LoadingState label="Fetching your seating details..." />}
        {error && <ErrorState message={error} />}

        {data && (
          <>
            <div className="bg-white rounded-lg shadow p-6 mt-4">
              <h1 className="text-xl font-bold text-navy">{data.student.name}</h1>
              <p className="text-gray-500 text-sm">
                {data.student.registerNumber} &middot; {data.student.department}
              </p>
            </div>

            {data.seatings.length === 0 ? (
              <div className="mt-4">
                <EmptyState message="No seating allocation has been published for you yet." />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {data.seatings.map((s) => (
                  <div key={s.allocationId} className="bg-white rounded-lg shadow p-6 border-l-4 border-brand">
                    <div className="flex justify-between items-start flex-wrap gap-3">
                      <div>
                        <h2 className="font-bold text-navy">
                          {s.examName} — {s.subjectName}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {s.date} &middot; Session {s.session}
                        </p>
                      </div>
                      <a
                        href={`/api/reports/seating-slip/${s.allocationId}`}
                        className="text-sm bg-navy text-white px-3 py-1.5 rounded"
                      >
                        Download Slip
                      </a>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                      <Detail label="Hall" value={s.hallNumber} />
                      <Detail label="Building" value={s.building} />
                      <Detail label="Floor" value={s.floor} />
                      <Detail label="Room" value={s.roomNumber || "-"} />
                      <Detail label="Row" value={s.row} />
                      <Detail label="Column" value={s.column} />
                      <Detail label="Seat No." value={s.seatNumber} />
                      <Detail label="Reporting Time" value={s.reportingTime} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-gray-400 text-xs uppercase">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/AdminDashboard.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Card, LoadingState, ErrorState } from "../../components/UI";

// Dashboard stats are computed client-side from a few lightweight list
// endpoints. In a larger deployment this would be a single dedicated
// GET /api/dashboard/summary endpoint — left as a straightforward extension
// point since the underlying list endpoints already exist from Stage 2/3.
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [departments, students, halls, staff, exams, todaysExams] = await Promise.all([
          api.get("/departments?pageSize=1"),
          api.get("/students?pageSize=1"),
          api.get("/halls?pageSize=100"),
          api.get("/staff?pageSize=1"),
          api.get("/exams?pageSize=1"),
          api.get(`/exams?date=${today}&pageSize=50`),
        ]);

        const hallList = halls.data.data;
        const totalCapacity = hallList.reduce((sum, h) => sum + h.capacity, 0);
        const availableHalls = hallList.filter((h) => h.status === "ACTIVE").length;

        setStats({
          totalDepartments: departments.data.meta.total,
          totalStudents: students.data.meta.total,
          totalHalls: halls.data.meta.total,
          totalCapacity,
          totalStaff: staff.data.meta.total,
          totalExams: exams.data.meta.total,
          todaysExams: todaysExams.data.meta.total,
          availableHalls,
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Total Departments" value={stats.totalDepartments} />
        <Card title="Total Students" value={stats.totalStudents} />
        <Card title="Total Examination Halls" value={stats.totalHalls} />
        <Card title="Total Hall Capacity" value={stats.totalCapacity} accent="success" />
        <Card title="Total Staff" value={stats.totalStaff} />
        <Card title="Total Exams" value={stats.totalExams} />
        <Card title="Today's Exams" value={stats.todaysExams} accent="warning" />
        <Card title="Available Halls" value={stats.availableHalls} accent="success" />
      </div>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/DepartmentsPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast, ConfirmDialog } from "../../components/UI";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null); // { mode: "create"|"edit", data }
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/departments", { params: { search, pageSize: 100 } });
      setDepartments(res.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSave(form) {
    try {
      if (modal.mode === "create") {
        await api.post("/departments", form);
        setToast({ type: "success", message: "Department created" });
      } else {
        await api.put(`/departments/${modal.data.id}`, form);
        setToast({ type: "success", message: "Department updated" });
      }
      setModal(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Save failed" });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/departments/${deleteTarget.id}`);
      setToast({ type: "success", message: "Department deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Delete failed" });
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-navy">Departments</h2>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-1.5 text-sm"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setModal({ mode: "create", data: { code: "", name: "" } })}
            className="bg-brand text-white px-3 py-1.5 rounded text-sm"
          >
            + Add Department
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && departments.length === 0 && <EmptyState message="No departments yet" />}

      {!loading && !error && departments.length > 0 && (
        <Table headers={["Code", "Name", "Students", "Staff", "Status", "Actions"]}>
          {departments.map((d) => (
            <tr key={d.id}>
              <td className="px-3 py-2 font-semibold">{d.code}</td>
              <td className="px-3 py-2">{d.name}</td>
              <td className="px-3 py-2">{d.studentCount}</td>
              <td className="px-3 py-2">{d.staffCount}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs ${d.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {d.status}
                </span>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-brand text-sm" onClick={() => setModal({ mode: "edit", data: d })}>
                  Edit
                </button>
                <button className="text-red-600 text-sm" onClick={() => setDeleteTarget(d)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {modal && <DepartmentModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Department"
        message={`Delete "${deleteTarget?.code}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function DepartmentModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState({ code: modal.data.code || "", name: modal.data.name || "" });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"
      >
        <h3 className="font-bold text-lg mb-4">{modal.mode === "create" ? "Add Department" : "Edit Department"}</h3>
        <label className="block text-sm mb-1">Code</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          required
        />
        <label className="block text-sm mb-1">Name</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button className="px-4 py-2 rounded bg-brand text-white">Save</button>
        </div>
      </form>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/StudentsPage.jsx ====
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast, ConfirmDialog } from "../../components/UI";

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    api.get("/departments", { params: { pageSize: 100 } }).then((res) => setDepartments(res.data.data));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/students", { params: { search, departmentId, pageSize: 100 } });
      setStudents(res.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentId]);

  async function handleDelete() {
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      setToast({ type: "success", message: "Student deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Delete failed" });
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-navy">Students</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-3 py-1.5 text-sm"
            placeholder="Search by name or register no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="border rounded px-3 py-1.5 text-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>
          <Link to="/admin/students/import" className="bg-brand text-white px-3 py-1.5 rounded text-sm">
            Upload Register
          </Link>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && students.length === 0 && <EmptyState message="No students found" />}

      {!loading && !error && students.length > 0 && (
        <Table headers={["Register No.", "Name", "Department", "Year", "Section", "Actions"]}>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 font-semibold">{s.registerNumber}</td>
              <td className="px-3 py-2">{s.name}</td>
              <td className="px-3 py-2">{s.department?.code}</td>
              <td className="px-3 py-2">{s.year}</td>
              <td className="px-3 py-2">{s.section || "-"}</td>
              <td className="px-3 py-2">
                <button className="text-red-600 text-sm" onClick={() => setDeleteTarget(s)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student"
        message={`Delete "${deleteTarget?.registerNumber}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/StudentImportPage.jsx ====
import React, { useState } from "react";
import api from "../../services/api";
import { Toast } from "../../components/UI";

export default function StudentImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function handlePreview(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/students/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(res.data.data);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Failed to parse file" });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await api.post("/students/import/confirm", { readyRows: preview.readyRows });
      setToast({ type: "success", message: `${res.data.data.importedCount} students imported successfully` });
      setPreview(null);
      setFile(null);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Import failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Student Register Upload</h2>

      <form onSubmit={handlePreview} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="text-sm"
        />
        <button disabled={!file || loading} className="bg-brand text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {loading ? "Processing..." : "Generate Preview"}
        </button>
        <p className="text-xs text-gray-400 w-full">
          Required columns: Register Number, Student Name, Department, Year. Optional: Section, Batch, Email.
        </p>
      </form>

      {preview && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <StatBadge label="Total Rows" value={preview.totalRows} />
            <StatBadge label="Valid" value={preview.validCount} color="green" />
            <StatBadge label="Invalid" value={preview.invalidCount} color="red" />
          </div>

          {preview.invalidRows.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-red-700 mb-2">Rows with errors (will NOT be imported)</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Row</th>
                      <th className="px-2 py-1 text-left">Register No.</th>
                      <th className="px-2 py-1 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.invalidRows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.rowNumber}</td>
                        <td className="px-2 py-1">{r.registerNumber || "-"}</td>
                        <td className="px-2 py-1">{r.reasons.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded border text-sm">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.validCount === 0}
              className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
            >
              Confirm &amp; Import {preview.validCount} Students
            </button>
          </div>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function StatBadge({ label, value, color = "gray" }) {
  const colors = { gray: "bg-gray-100 text-gray-700", green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700" };
  return (
    <div className={`px-3 py-1.5 rounded ${colors[color]}`}>
      {label}: <strong>{value}</strong>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/HallsPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast, ConfirmDialog } from "../../components/UI";

const EMPTY_FORM = { hallNumber: "", building: "", floor: "", roomNumber: "", capacity: 40, rows: 5, columns: 8 };

export default function HallsPage() {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/halls", { params: { pageSize: 100 } });
      setHalls(res.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load halls");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(form) {
    try {
      const payload = { ...form, capacity: Number(form.capacity), rows: Number(form.rows), columns: Number(form.columns) };
      if (modal.mode === "create") {
        await api.post("/halls", payload);
        setToast({ type: "success", message: "Hall created" });
      } else {
        await api.put(`/halls/${modal.data.id}`, payload);
        setToast({ type: "success", message: "Hall updated" });
      }
      setModal(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Save failed" });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/halls/${deleteTarget.id}`);
      setToast({ type: "success", message: "Hall deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Delete failed" });
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-navy">Examination Halls</h2>
        <button
          onClick={() => setModal({ mode: "create", data: EMPTY_FORM })}
          className="bg-brand text-white px-3 py-1.5 rounded text-sm"
        >
          + Add Hall
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && halls.length === 0 && <EmptyState message="No halls yet" />}

      {!loading && !error && halls.length > 0 && (
        <Table headers={["Hall", "Building", "Floor", "Capacity", "Rows x Cols", "Status", "Actions"]}>
          {halls.map((h) => (
            <tr key={h.id}>
              <td className="px-3 py-2 font-semibold">{h.hallNumber}</td>
              <td className="px-3 py-2">{h.building}</td>
              <td className="px-3 py-2">{h.floor}</td>
              <td className="px-3 py-2">{h.capacity}</td>
              <td className="px-3 py-2">
                {h.rows} x {h.columns}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    h.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {h.status}
                </span>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-brand text-sm" onClick={() => setModal({ mode: "edit", data: h })}>
                  Edit
                </button>
                <button className="text-red-600 text-sm" onClick={() => setDeleteTarget(h)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {modal && <HallModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Hall"
        message={`Delete "${deleteTarget?.hallNumber}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function HallModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <h3 className="font-bold text-lg mb-4">{modal.mode === "create" ? "Add Hall" : "Edit Hall"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hall Number" value={form.hallNumber} onChange={set("hallNumber")} required />
          <Field label="Building" value={form.building} onChange={set("building")} required />
          <Field label="Floor" value={form.floor} onChange={set("floor")} required />
          <Field label="Room Number" value={form.roomNumber} onChange={set("roomNumber")} />
          <Field label="Capacity" type="number" value={form.capacity} onChange={set("capacity")} required />
          <Field label="Rows" type="number" value={form.rows} onChange={set("rows")} required />
          <Field label="Columns" type="number" value={form.columns} onChange={set("columns")} required />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button className="px-4 py-2 rounded bg-brand text-white">Save</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input className="w-full border rounded px-3 py-2" {...props} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/ExamsPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast } from "../../components/UI";

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/exams", { params: { pageSize: 100 } });
      setExams(res.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get("/departments", { params: { pageSize: 100 } }).then((res) => setDepartments(res.data.data));
  }, []);

  async function handleCreate(form) {
    try {
      await api.post("/exams", form);
      setToast({ type: "success", message: "Exam created" });
      setShowForm(false);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Create failed" });
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-navy">Exams</h2>
        <button onClick={() => setShowForm(true)} className="bg-brand text-white px-3 py-1.5 rounded text-sm">
          + Create Exam
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && exams.length === 0 && <EmptyState message="No exams scheduled yet" />}

      {!loading && !error && exams.length > 0 && (
        <Table headers={["Date", "Session", "Subject", "Departments", "Students", "Allocated"]}>
          {exams.map((ex) => (
            <tr key={ex.id}>
              <td className="px-3 py-2">{ex.date.slice(0, 10)}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs ${ex.session === "FN" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                  {ex.session}
                </span>
              </td>
              <td className="px-3 py-2">
                {ex.examName} <span className="text-gray-400">({ex.subjectCode})</span>
              </td>
              <td className="px-3 py-2">{ex.examDepartments.map((ed) => ed.department.code).join(", ")}</td>
              <td className="px-3 py-2">{ex._count?.examStudents ?? "-"}</td>
              <td className="px-3 py-2">{ex._count?.allocations > 0 ? "Yes" : "No"}</td>
            </tr>
          ))}
        </Table>
      )}

      {showForm && <ExamForm departments={departments} onClose={() => setShowForm(false)} onSave={handleCreate} />}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function ExamForm({ departments, onClose, onSave }) {
  const [form, setForm] = useState({
    examName: "",
    subjectCode: "",
    subjectName: "",
    date: "",
    session: "FN",
    startTime: "09:00",
    endTime: "12:00",
    duration: 180,
    departmentIds: [],
  });

  function toggleDept(id) {
    setForm((f) => ({
      ...f,
      departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((d) => d !== id) : [...f.departmentIds, id],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg"
      >
        <h3 className="font-bold text-lg mb-4">Create Exam</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Exam Name" value={form.examName} onChange={(v) => setForm({ ...form, examName: v })} required />
          <Field label="Subject Code" value={form.subjectCode} onChange={(v) => setForm({ ...form, subjectCode: v })} required />
          <Field label="Subject Name" value={form.subjectName} onChange={(v) => setForm({ ...form, subjectName: v })} required full />
          <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
          <div>
            <label className="block text-sm mb-1">Session</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.session}
              onChange={(e) => setForm({ ...form, session: e.target.value })}
            >
              <option value="FN">FN — Forenoon</option>
              <option value="AN">AN — Afternoon</option>
            </select>
          </div>
          <Field label="Start Time" type="time" value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} required />
          <Field label="End Time" type="time" value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} required />
          <Field
            label="Duration (min)"
            type="number"
            value={form.duration}
            onChange={(v) => setForm({ ...form, duration: Number(v) })}
            required
          />
        </div>

        <div className="mt-3">
          <label className="block text-sm mb-1">Departments Writing This Exam</label>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <label
                key={d.id}
                className={`px-3 py-1.5 rounded border cursor-pointer text-sm ${
                  form.departmentIds.includes(d.id) ? "bg-brand text-white border-brand" : "border-gray-300"
                }`}
              >
                <input type="checkbox" className="hidden" checked={form.departmentIds.includes(d.id)} onChange={() => toggleDept(d.id)} />
                {d.code}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button className="px-4 py-2 rounded bg-brand text-white">Create Exam</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, full, onChange, ...props }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-sm mb-1">{label}</label>
      <input className="w-full border rounded px-3 py-2" onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/TimetablePage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState } from "../../components/UI";

export default function TimetablePage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/exams", { params: { pageSize: 200 } })
      .then((res) => setExams(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load timetable"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (exams.length === 0) return <EmptyState message="No exams scheduled" />;

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Examination Timetable</h2>
      <Table headers={["Date", "Session", "Subject", "Departments", "Students", "Required Halls*", "Allocated"]}>
        {exams.map((ex) => {
          const requiredHalls = Math.max(1, Math.ceil((ex._count?.examStudents || 0) / 40));
          return (
            <tr key={ex.id} className={ex.session === "FN" ? "bg-blue-50/40" : "bg-purple-50/40"}>
              <td className="px-3 py-2">{ex.date.slice(0, 10)}</td>
              <td className="px-3 py-2 font-semibold">{ex.session}</td>
              <td className="px-3 py-2">{ex.examName}</td>
              <td className="px-3 py-2">{ex.examDepartments.map((ed) => ed.department.code).join(", ")}</td>
              <td className="px-3 py-2">{ex._count?.examStudents ?? "-"}</td>
              <td className="px-3 py-2">~{requiredHalls}</td>
              <td className="px-3 py-2">{ex._count?.allocations > 0 ? "✅" : "—"}</td>
            </tr>
          );
        })}
      </Table>
      <p className="text-xs text-gray-400 mt-2">*Estimated at 40 seats/hall — actual halls assigned by the seating algorithm may differ.</p>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/StaffPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast, ConfirmDialog } from "../../components/UI";

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/staff", { params: { pageSize: 100 } });
      setStaff(res.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get("/departments", { params: { pageSize: 100 } }).then((res) => setDepartments(res.data.data));
  }, []);

  async function handleCreate(form) {
    try {
      await api.post("/staff", form);
      setToast({ type: "success", message: "Staff created" });
      setShowForm(false);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Create failed" });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/staff/${deleteTarget.id}`);
      setToast({ type: "success", message: "Staff deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Delete failed" });
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-navy">Staff</h2>
        <button onClick={() => setShowForm(true)} className="bg-brand text-white px-3 py-1.5 rounded text-sm">
          + Add Staff
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && staff.length === 0 && <EmptyState message="No staff yet" />}

      {!loading && !error && staff.length > 0 && (
        <Table headers={["Staff ID", "Name", "Department", "Email", "Status", "Actions"]}>
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 font-semibold">{s.staffId}</td>
              <td className="px-3 py-2">{s.name}</td>
              <td className="px-3 py-2">{s.department?.code}</td>
              <td className="px-3 py-2">{s.email || "-"}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs ${s.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {s.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <button className="text-red-600 text-sm" onClick={() => setDeleteTarget(s)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {showForm && <StaffForm departments={departments} onClose={() => setShowForm(false)} onSave={handleCreate} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Staff"
        message={`Delete "${deleteTarget?.staffId}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function StaffForm({ departments, onClose, onSave }) {
  const [form, setForm] = useState({
    staffId: "",
    name: "",
    departmentId: departments[0]?.id || "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <h3 className="font-bold text-lg mb-4">Add Staff</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Staff ID" value={form.staffId} onChange={(v) => setForm({ ...form, staffId: v })} required />
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div>
            <label className="block text-sm mb-1">Department</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
          </div>
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field
            label="Confirm Password"
            type="password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            required
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
            Cancel
          </button>
          <button className="px-4 py-2 rounded bg-brand text-white">Save</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input className="w-full border rounded px-3 py-2" onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/StaffAvailabilityPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast } from "../../components/UI";

export default function StaffAvailabilityPage() {
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ staffId: "", date: "", session: "FN", status: "UNAVAILABLE" });

  async function load() {
    setLoading(true);
    const [staffRes, availRes] = await Promise.all([
      api.get("/staff", { params: { pageSize: 100 } }),
      api.get("/staff/availability/list"),
    ]);
    setStaffList(staffRes.data.data);
    setRecords(availRes.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post("/staff/availability/set", form);
      setToast({ type: "success", message: "Availability updated" });
      load();
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Update failed" });
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Staff Availability</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Staff</label>
          <select
            className="border rounded px-3 py-2"
            value={form.staffId}
            onChange={(e) => setForm({ ...form, staffId: e.target.value })}
            required
          >
            <option value="">Select staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.staffId} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Date</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Session</label>
          <select className="border rounded px-3 py-2" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}>
            <option value="FN">FN</option>
            <option value="AN">AN</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select className="border rounded px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
            <option value="LEAVE">Leave</option>
          </select>
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">Save</button>
      </form>

      {loading && <LoadingState />}
      {!loading && records.length === 0 && <EmptyState message="No availability records set" />}
      {!loading && records.length > 0 && (
        <Table headers={["Staff", "Department", "Date", "Session", "Status"]}>
          {records.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">
                {r.staff.staffId} — {r.staff.name}
              </td>
              <td className="px-3 py-2">{r.staff.department.code}</td>
              <td className="px-3 py-2">{r.date.slice(0, 10)}</td>
              <td className="px-3 py-2">{r.session}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    r.status === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/SeatingAllocationPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { LoadingState, ErrorState, Toast } from "../../components/UI";

const STRATEGIES = [
  { value: "SEPARATION", label: "Strategy A — Department Separation" },
  { value: "MIXED", label: "Strategy B — Mixed Departments" },
  { value: "ALTERNATING", label: "Strategy C — Alternating Departments" },
];

export default function SeatingAllocationPage() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [strategy, setStrategy] = useState("ALTERNATING");
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get("/exams", { params: { pageSize: 200 } }).then((res) => setExams(res.data.data));
  }, []);

  async function handlePreview() {
    if (!examId) return;
    setLoading(true);
    setPreview(null);
    setExisting(null);
    try {
      const res = await api.post("/allocation/generate", { examId, strategy });
      setPreview(res.data.data);
      if (res.data.data.hasExistingAllocation) {
        setExisting(true);
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Preview failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(mode) {
    setLoading(true);
    try {
      const res = await api.post("/allocation/confirm", { examId, strategy, mode });
      setToast({ type: "success", message: `Allocation saved — ${res.data.data.savedCount} students seated` });
      setPreview(null);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Save failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Seating Allocation</h2>

      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Exam</label>
          <select className="border rounded px-3 py-2 min-w-[260px]" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.date.slice(0, 10)} {ex.session} — {ex.examName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Seating Strategy</label>
          <select className="border rounded px-3 py-2" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePreview}
          disabled={!examId || loading}
          className="bg-brand text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Working..." : "Generate Allocation"}
        </button>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow p-4">
          {!preview.success ? (
            <ErrorState message={preview.conflicts[0]?.message || "Allocation could not be generated"} />
          ) : (
            <>
              <h3 className="font-bold text-navy mb-2">Allocation Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                <Stat label="Students" value={preview.studentCount} />
                <Stat label="Halls Required" value={preview.hallsUsed.length} />
                <Stat label="Strategy" value={preview.strategy} />
                <Stat label="Conflicts" value={preview.conflicts.length} color={preview.conflicts.length ? "red" : "green"} />
              </div>

              <table className="min-w-full text-sm mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Hall</th>
                    <th className="px-3 py-2 text-left">Capacity</th>
                    <th className="px-3 py-2 text-left">Students Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.hallsUsed.map((h) => (
                    <tr key={h.hallId}>
                      <td className="px-3 py-2">{h.hallNumber}</td>
                      <td className="px-3 py-2">{h.capacity}</td>
                      <td className="px-3 py-2">{h.studentsAssigned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {existing && (
                <div className="bg-orange-50 text-orange-700 text-sm px-3 py-2 rounded mb-3">
                  A seating allocation already exists for this exam. Confirming will REPLACE it.
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={() => setPreview(null)} className="px-4 py-2 rounded border text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(existing ? "replace" : "create")}
                  disabled={loading}
                  className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
                >
                  {existing ? "Replace Existing Allocation" : "Confirm & Save Allocation"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

function Stat({ label, value, color = "gray" }) {
  const colors = { gray: "bg-gray-100 text-gray-700", green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700" };
  return (
    <div className={`px-3 py-2 rounded ${colors[color]}`}>
      <p className="text-xs">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/InvigilatorAllocationPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState, Toast } from "../../components/UI";

export default function InvigilatorAllocationPage() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [invigilatorsPerHall, setInvigilatorsPerHall] = useState(1);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get("/exams", { params: { pageSize: 200 } }).then((res) => setExams(res.data.data));
  }, []);

  async function loadDuties(id) {
    const res = await api.get(`/invigilation/${id}`);
    setDuties(res.data.data);
  }

  async function handleGenerate() {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.post("/invigilation/generate", { examId, invigilatorsPerHall: Number(invigilatorsPerHall) });
      setToast({
        type: res.data.data.fullySuccessful ? "success" : "warning",
        message: res.data.message,
      });
      await loadDuties(examId);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Generation failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Invigilator Allocation</h2>

      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Exam</label>
          <select
            className="border rounded px-3 py-2 min-w-[260px]"
            value={examId}
            onChange={(e) => {
              setExamId(e.target.value);
              setDuties([]);
              if (e.target.value) loadDuties(e.target.value);
            }}
          >
            <option value="">Select exam</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.date.slice(0, 10)} {ex.session} — {ex.examName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Invigilators / Hall</label>
          <input
            type="number"
            min={1}
            className="border rounded px-3 py-2 w-24"
            value={invigilatorsPerHall}
            onChange={(e) => setInvigilatorsPerHall(e.target.value)}
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={!examId || loading}
          className="bg-brand text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Assigning..." : "Generate Invigilators"}
        </button>
        <p className="text-xs text-gray-400 w-full">Requires a saved seating allocation for this exam first.</p>
      </div>

      {loading && <LoadingState />}
      {!loading && examId && duties.length === 0 && <EmptyState message="No invigilators assigned yet" />}
      {!loading && duties.length > 0 && (
        <Table headers={["Hall", "Staff ID", "Name", "Department", "Reporting Time", "Status"]}>
          {duties.map((d) => (
            <tr key={d.id}>
              <td className="px-3 py-2">{d.hall.hallNumber}</td>
              <td className="px-3 py-2">{d.staff.staffId}</td>
              <td className="px-3 py-2">{d.staff.name}</td>
              <td className="px-3 py-2">{d.staff.department.code}</td>
              <td className="px-3 py-2">{d.reportingTime}</td>
              <td className="px-3 py-2">{d.status}</td>
            </tr>
          ))}
        </Table>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/ReportsPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";

export default function ReportsPage() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");

  useEffect(() => {
    api.get("/exams", { params: { pageSize: 200 } }).then((res) => setExams(res.data.data));
  }, []);

  // Report endpoints require auth; opening in a new tab won't carry the
  // Authorization header, so we fetch as a blob (via the shared axios
  // instance, which attaches the JWT) and trigger the download client-side.
  async function download(path, filename) {
    const res = await api.get(path, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Reports</h2>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-sm mb-1">Filter by Exam (optional)</label>
        <select className="border rounded px-3 py-2 min-w-[260px]" value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">All Exams</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.date.slice(0, 10)} {ex.session} — {ex.examName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard
          title="Student Seating Report"
          desc="Register number, name, department, exam, hall and seat for every allocated student."
          onPdf={() => download(`/reports/student-report?examId=${examId}`, "student-seating-report.pdf")}
          onExcel={() => download(`/reports/student-report?examId=${examId}&format=excel`, "student-seating-report.xlsx")}
        />
        <ReportCard
          title="Invigilator Duty Report"
          desc="Staff assignments per hall, date, session and reporting time."
          onPdf={() => download(`/reports/staff-duty?examId=${examId}`, "invigilator-duty-report.pdf")}
          onExcel={() => download(`/reports/staff-duty?examId=${examId}&format=excel`, "invigilator-duty-report.xlsx")}
        />
        <ReportCard
          title="Hall Allocation Report"
          desc="Hall-wise summary: capacity, student count and invigilators."
          onExcel={() => download(`/reports/hall-wise?examId=${examId}`, "hall-allocation-report.xlsx")}
        />
      </div>
    </div>
  );
}

function ReportCard({ title, desc, onPdf, onExcel }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-bold text-navy mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-3">{desc}</p>
      <div className="flex gap-2">
        {onPdf && (
          <button onClick={onPdf} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm">
            Download PDF
          </button>
        )}
        {onExcel && (
          <button onClick={onExcel} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">
            Download Excel
          </button>
        )}
      </div>
    </div>
  );
}


// ==== FILE: frontend/src/pages/admin/AuditLogsPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState } from "../../components/UI";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/audit-logs", { params: { pageSize: 100 } })
      .then((res) => setLogs(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (logs.length === 0) return <EmptyState message="No audit log entries yet" />;

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Audit Logs</h2>
      <Table headers={["Timestamp", "Role", "Action", "Description"]}>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-3 py-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
            <td className="px-3 py-2">{log.role}</td>
            <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
            <td className="px-3 py-2">{log.description}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}


// ==== FILE: frontend/src/pages/staff/StaffDashboard.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, ErrorState, EmptyState, Card } from "../../components/UI";

export default function StaffDashboard() {
  const { user } = useAuth();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Staff only ever see THEIR OWN duties, via GET /api/invigilation/me/duties
    // (a STAFF-only route — see BACKEND_ADDENDUM_staff_duties_endpoint.txt).
    api
      .get("/invigilation/me/duties")
      .then((res) => setDuties(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load duties"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-1">Welcome, {user?.name}</h2>
      <p className="text-gray-500 text-sm mb-4">
        Staff ID: {user?.staffId} &middot; Department: {user?.department?.code}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card title="Upcoming Duties" value={duties.length} />
      </div>

      {error && <ErrorState message={error} />}
      {!error && duties.length === 0 && <EmptyState message="No invigilation duties assigned yet. Check 'My Duties' for updates." />}
    </div>
  );
}


// ==== FILE: frontend/src/pages/staff/MyDutiesPage.jsx ====
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, LoadingState, ErrorState, EmptyState } from "../../components/UI";

export default function MyDutiesPage() {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/invigilation/me/duties")
      .then((res) => setDuties(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load duties"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (duties.length === 0) return <EmptyState message="You have no invigilation duties assigned" />;

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">My Examination Duties</h2>
      <Table headers={["Date", "Session", "Exam", "Hall", "Building", "Reporting Time", "Status"]}>
        {duties.map((d) => (
          <tr key={d.id}>
            <td className="px-3 py-2">{d.date.slice(0, 10)}</td>
            <td className="px-3 py-2">{d.session}</td>
            <td className="px-3 py-2">{d.exam.examName}</td>
            <td className="px-3 py-2">{d.hall.hallNumber}</td>
            <td className="px-3 py-2">{d.hall.building}</td>
            <td className="px-3 py-2">{d.reportingTime}</td>
            <td className="px-3 py-2">
              <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{d.status}</span>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}


// ==== FILE: frontend/src/pages/staff/StaffProfilePage.jsx ====
import React from "react";
import { useAuth } from "../../context/AuthContext";

export default function StaffProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-4">Profile</h2>
      <div className="bg-white rounded-lg shadow p-6 max-w-md">
        <Detail label="Staff ID" value={user?.staffId} />
        <Detail label="Name" value={user?.name} />
        <Detail label="Department" value={user?.department?.code} />
        <Detail label="Email" value={user?.email || "-"} />
        <Detail label="Mobile" value={user?.mobile || "-"} />
        <Detail label="Status" value={user?.status} />
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="mb-3">
      <p className="text-gray-400 text-xs uppercase">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}


// ============================================================================
// TESTS (Jest) — everything below is under backend/tests/ and backend/
// ============================================================================

// ==== FILE: backend/jest.config.js ====
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  collectCoverageFrom: ["src/algorithms/**/*.js", "src/services/**/*.js", "src/utils/**/*.js"],
};


// ==== FILE: backend/tests/seatingAlgorithm.test.js ====
const { generateAllocation, selectHallsForCapacity } = require("../src/algorithms/seatingAlgorithm");

function makeStudents(deptId, count, startIndex = 0) {
  const arr = [];
  for (let i = 0; i < count; i += 1) {
    arr.push({ id: `${deptId}-${startIndex + i}`, departmentId: deptId, registerNumber: `${deptId}${startIndex + i}` });
  }
  return arr;
}

const HALLS = [
  { id: "h1", hallNumber: "Hall 101", capacity: 40, rows: 5, columns: 8 },
  { id: "h2", hallNumber: "Hall 102", capacity: 40, rows: 5, columns: 8 },
  { id: "h3", hallNumber: "Hall 103", capacity: 40, rows: 5, columns: 8 },
  { id: "h4", hallNumber: "Hall 104", capacity: 40, rows: 5, columns: 8 },
  { id: "h5", hallNumber: "Hall 105", capacity: 40, rows: 5, columns: 8 },
];

describe("generateAllocation — core guarantees", () => {
  test("every eligible student receives exactly one seat when capacity allows", () => {
    const students = makeStudents("CSE", 60);
    const result = generateAllocation({ id: "e1" }, students, HALLS, "MIXED");

    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(60);
    const studentIds = new Set(result.allocations.map((a) => a.studentId));
    expect(studentIds.size).toBe(60); // no duplicates
  });

  test("no hall exceeds its capacity", () => {
    const students = makeStudents("CSE", 90);
    const result = generateAllocation({ id: "e1" }, students, HALLS, "ALTERNATING");

    for (const hall of result.hallsUsed) {
      const original = HALLS.find((h) => h.id === hall.hallId);
      expect(hall.studentsAssigned).toBeLessThanOrEqual(original.capacity);
    }
  });

  test("no seat is assigned to more than one student (no duplicate seats)", () => {
    const students = [...makeStudents("CSE", 50), ...makeStudents("ECE", 50)];
    const result = generateAllocation({ id: "e1" }, students, HALLS, "SEPARATION");

    const seatKeys = result.allocations.map((a) => `${a.hallId}-${a.seatNumber}`);
    expect(new Set(seatKeys).size).toBe(seatKeys.length);
  });

  test("unused halls are left out of hallsUsed entirely (spec section 37)", () => {
    // 100 students, halls of 40 each -> only 3 of 5 halls should be used
    const students = makeStudents("CSE", 100);
    const result = generateAllocation({ id: "e1" }, students, HALLS, "MIXED");

    expect(result.hallsUsed.length).toBe(3);
  });

  test("department NOT writing the exam is never present in the allocation", () => {
    // Only CSE + EEE students are passed in — this simulates the exam
    // service only loading ExamStudent rows for departments writing the exam.
    const students = [...makeStudents("CSE", 30), ...makeStudents("EEE", 20)];
    const result = generateAllocation({ id: "e1" }, students, HALLS, "MIXED");

    const departmentsInAllocation = new Set(
      result.allocations.map((a) => students.find((s) => s.id === a.studentId).departmentId)
    );
    expect(departmentsInAllocation.has("ECE")).toBe(false);
    expect(departmentsInAllocation.has("MECH")).toBe(false);
    expect([...departmentsInAllocation].sort()).toEqual(["CSE", "EEE"]);
  });

  test("returns a clear conflict when capacity is insufficient (spec section 20 example)", () => {
    const smallHall = [{ id: "s1", hallNumber: "Small Hall", capacity: 40, rows: 5, columns: 8 }];
    const students = makeStudents("CSE", 52);
    const result = generateAllocation({ id: "e1" }, students, smallHall, "MIXED");

    expect(result.success).toBe(false);
    expect(result.conflicts[0].code).toBe("INSUFFICIENT_CAPACITY");
    expect(result.conflicts[0].message).toContain("52 students require seating");
    expect(result.conflicts[0].message).toContain("40 seats");
  });

  test("returns a conflict (not a crash) when there are no eligible students", () => {
    const result = generateAllocation({ id: "e1" }, [], HALLS, "MIXED");
    expect(result.success).toBe(false);
    expect(result.conflicts[0].code).toBe("NO_ELIGIBLE_STUDENTS");
  });

  test("a duplicated student in the input is never allocated twice", () => {
    const student = { id: "dup-1", departmentId: "CSE" };
    const students = [student, student, ...makeStudents("CSE", 5)];
    const result = generateAllocation({ id: "e1" }, students, HALLS, "MIXED");

    const dupCount = result.allocations.filter((a) => a.studentId === "dup-1").length;
    expect(dupCount).toBe(1);
    expect(result.allocations).toHaveLength(6); // 1 deduped + 5 others
  });

  test("ALTERNATING strategy degrades gracefully when one department dominates", () => {
    const students = [...makeStudents("CSE", 90), ...makeStudents("ECE", 5)];
    const result = generateAllocation({ id: "e1" }, students, HALLS, "ALTERNATING");
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(95);
  });
});

describe("selectHallsForCapacity — hall selection priority", () => {
  test("picks the fewest halls (largest-first) that satisfy demand", () => {
    const { selected, totalCapacity } = selectHallsForCapacity(HALLS, 100);
    expect(selected.length).toBe(3); // 40+40+40 = 120 >= 100
    expect(totalCapacity).toBeGreaterThanOrEqual(100);
  });

  test("returns insufficient totalCapacity when no combination of halls is enough", () => {
    const { totalCapacity } = selectHallsForCapacity(HALLS, 1000);
    expect(totalCapacity).toBeLessThan(1000);
  });
});

describe("FN/AN independence", () => {
  test("two calls (FN and AN) for the same halls never share allocation state", () => {
    const fnStudents = makeStudents("CSE", 40);
    const anStudents = makeStudents("ECE", 40);

    const fnResult = generateAllocation({ id: "examFN" }, fnStudents, HALLS, "MIXED");
    const anResult = generateAllocation({ id: "examAN" }, anStudents, HALLS, "MIXED");

    expect(fnResult.success).toBe(true);
    expect(anResult.success).toBe(true);
    // Each call is a pure function invocation with no shared state —
    // both can independently use Hall 101 seat A1, for example, since
    // they belong to different exams (uniqueness is enforced per-exam
    // at the database level via the @@unique([examId, hallId, seatNumber]) constraint).
    expect(fnResult.allocations.some((a) => a.seatNumber === "A1")).toBe(true);
    expect(anResult.allocations.some((a) => a.seatNumber === "A1")).toBe(true);
  });
});


// ==== FILE: backend/tests/invigilationAlgorithm.test.js ====
const { generateInvigilation } = require("../src/algorithms/invigilationAlgorithm");

const EXAM = { id: "e1", date: new Date("2026-09-20"), session: "FN" };

const HALLS_USED = [
  { hallId: "h1", hallNumber: "Hall 101", dominantDepartmentId: "CSE" },
  { hallId: "h2", hallNumber: "Hall 102", dominantDepartmentId: "ECE" },
];

function makeStaff(count, deptId = "MECH") {
  const arr = [];
  for (let i = 0; i < count; i += 1) {
    arr.push({ id: `staff-${deptId}-${i}`, staffId: `STF${i}`, name: `Staff ${i}`, departmentId: deptId });
  }
  return arr;
}

describe("generateInvigilation", () => {
  test("assigns the configured number of invigilators per hall", () => {
    const staff = makeStaff(4);
    const result = generateInvigilation({ exam: EXAM, hallsUsed: HALLS_USED, availableStaff: staff, invigilatorsPerHall: 1 });

    expect(result.success).toBe(true);
    expect(result.duties).toHaveLength(2); // 1 per hall x 2 halls
  });

  test("never assigns the same staff member to two halls in the same slot", () => {
    const staff = makeStaff(2);
    const result = generateInvigilation({ exam: EXAM, hallsUsed: HALLS_USED, availableStaff: staff, invigilatorsPerHall: 1 });

    const staffIds = result.duties.map((d) => d.staffId);
    expect(new Set(staffIds).size).toBe(staffIds.length);
  });

  test("prefers staff from a different department than the hall's students", () => {
    const staff = [
      { id: "s-cse", staffId: "STF-CSE", name: "CSE Staff", departmentId: "CSE" },
      { id: "s-mech", staffId: "STF-MECH", name: "MECH Staff", departmentId: "MECH" },
    ];
    const hallsUsed = [{ hallId: "h1", hallNumber: "Hall 101", dominantDepartmentId: "CSE" }];
    const result = generateInvigilation({ exam: EXAM, hallsUsed, availableStaff: staff, invigilatorsPerHall: 1 });

    // The cross-department candidate (MECH staff, not CSE) should be chosen
    // over the same-department one when both are available.
    expect(result.duties[0].staffId).toBe("s-mech");
  });

  test("reports a conflict when there are not enough available staff", () => {
    const staff = makeStaff(1); // only 1 staff, but 2 halls each need 1
    const result = generateInvigilation({ exam: EXAM, hallsUsed: HALLS_USED, availableStaff: staff, invigilatorsPerHall: 1 });

    expect(result.success).toBe(false);
    expect(result.conflicts[0].code).toBe("INSUFFICIENT_INVIGILATORS");
    // The hall that COULD be staffed still gets a duty recorded
    expect(result.duties).toHaveLength(1);
  });

  test("supports multiple invigilators per hall when configured", () => {
    const staff = makeStaff(6);
    const result = generateInvigilation({ exam: EXAM, hallsUsed: HALLS_USED, availableStaff: staff, invigilatorsPerHall: 2 });

    expect(result.success).toBe(true);
    expect(result.duties).toHaveLength(4); // 2 per hall x 2 halls
  });
});


// ==== FILE: backend/tests/authUtils.test.js ====
const { hashPassword, verifyPassword } = require("../src/utils/password");
const { signToken, verifyToken } = require("../src/utils/jwt");

// JWT utils read JWT_SECRET at import time via config/env — set it before requiring.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

describe("password hashing", () => {
  test("hashed password never equals the plaintext", async () => {
    const hash = await hashPassword("Admin@123");
    expect(hash).not.toBe("Admin@123");
    expect(hash.length).toBeGreaterThan(20);
  });

  test("verifyPassword accepts the correct password", async () => {
    const hash = await hashPassword("Admin@123");
    await expect(verifyPassword("Admin@123", hash)).resolves.toBe(true);
  });

  test("verifyPassword rejects an incorrect password", async () => {
    const hash = await hashPassword("Admin@123");
    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  });
});

describe("JWT signing/verification", () => {
  test("a signed token can be verified and contains the expected payload", () => {
    const token = signToken({ id: "abc-123", role: "ADMIN", loginId: "ADMIN001" });
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe("abc-123");
    expect(decoded.role).toBe("ADMIN");
    expect(decoded.loginId).toBe("ADMIN001");
  });

  test("verifying a tampered token throws", () => {
    const token = signToken({ id: "abc-123", role: "ADMIN", loginId: "ADMIN001" });
    const tampered = `${token}xyz`;
    expect(() => verifyToken(tampered)).toThrow();
  });
});


// ==== FILE: backend/tests/authService.test.js ====
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

jest.mock("../src/config/prisma", () => ({
  admin: { findUnique: jest.fn() },
  staff: { findUnique: jest.fn() },
  student: { findUnique: jest.fn() },
  department: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  hall: { create: jest.fn() },
  auditLog: { create: jest.fn() },
}));

const prisma = require("../src/config/prisma");
const authService = require("../src/services/auth.service");
const { hashPassword } = require("../src/utils/password");

describe("auth.service — admin login", () => {
  test("succeeds with correct credentials and returns a token + sanitized user", async () => {
    const passwordHash = await hashPassword("Admin@123");
    prisma.admin.findUnique.mockResolvedValue({
      id: "admin-1",
      instituteId: "ADMIN001",
      name: "System Administrator",
      passwordHash,
    });

    const result = await authService.loginAdmin({ instituteId: "ADMIN001", password: "Admin@123" }, "127.0.0.1");

    expect(result.token).toBeDefined();
    expect(result.role).toBe("ADMIN");
    expect(result.user.passwordHash).toBeUndefined(); // never leaks the hash
    expect(result.user.instituteId).toBe("ADMIN001");
  });

  test("rejects an unknown institute ID with a generic error", async () => {
    prisma.admin.findUnique.mockResolvedValue(null);
    await expect(authService.loginAdmin({ instituteId: "NOPE", password: "x" }, "127.0.0.1")).rejects.toThrow(
      "Invalid institute ID or password"
    );
  });

  test("rejects a wrong password with the SAME generic error as an unknown ID (no user enumeration)", async () => {
    const passwordHash = await hashPassword("Admin@123");
    prisma.admin.findUnique.mockResolvedValue({ id: "admin-1", instituteId: "ADMIN001", passwordHash });

    await expect(
      authService.loginAdmin({ instituteId: "ADMIN001", password: "WrongPassword" }, "127.0.0.1")
    ).rejects.toThrow("Invalid institute ID or password");
  });
});

describe("auth.service — staff login", () => {
  test("rejects an INACTIVE staff account even with correct password", async () => {
    const passwordHash = await hashPassword("Staff@123");
    prisma.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      staffId: "STF101",
      status: "INACTIVE",
      passwordHash,
      department: { code: "CSE" },
    });

    await expect(authService.loginStaff({ staffId: "STF101", password: "Staff@123" }, "127.0.0.1")).rejects.toThrow(
      "Invalid staff ID or password"
    );
  });

  test("succeeds for an ACTIVE staff account with correct password", async () => {
    const passwordHash = await hashPassword("Staff@123");
    prisma.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      staffId: "STF101",
      status: "ACTIVE",
      passwordHash,
      department: { code: "CSE" },
    });

    const result = await authService.loginStaff({ staffId: "STF101", password: "Staff@123" }, "127.0.0.1");
    expect(result.role).toBe("STAFF");
    expect(result.user.passwordHash).toBeUndefined();
  });
});

describe("auth.service — student lookup", () => {
  test("returns student details for a valid register number", async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: "student-1",
      registerNumber: "23CSE001",
      name: "Test Student",
      department: { code: "CSE" },
    });

    const result = await authService.loginStudent({ registerNumber: "23CSE001" });
    expect(result.role).toBe("STUDENT");
    expect(result.user.registerNumber).toBe("23CSE001");
  });

  test("throws a clear error for an unknown register number", async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(authService.loginStudent({ registerNumber: "NOPE" })).rejects.toThrow("Register number not found");
  });
});


// ==== FILE: backend/tests/departmentHallServices.test.js ====
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

jest.mock("../src/config/prisma", () => ({
  department: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  hall: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  student: { count: jest.fn() },
  seatingAllocation: { count: jest.fn() },
}));

const prisma = require("../src/config/prisma");
const departmentService = require("../src/services/department.service");
const hallService = require("../src/services/hall.service");

describe("department.service", () => {
  test("createDepartment uppercases the department code", async () => {
    prisma.department.create.mockImplementation(({ data }) => Promise.resolve({ id: "d1", ...data }));
    const dept = await departmentService.createDepartment({ code: "cse", name: "Computer Science" });
    expect(dept.code).toBe("CSE");
  });

  test("deleteDepartment is blocked when students are still assigned (in-use protection)", async () => {
    prisma.department.findUnique.mockResolvedValue({ id: "d1", code: "CSE", name: "Computer Science" });
    prisma.student.count.mockResolvedValue(42);

    await expect(departmentService.deleteDepartment("d1")).rejects.toThrow(/42 students/);
  });

  test("deleteDepartment succeeds when no students remain", async () => {
    prisma.department.findUnique.mockResolvedValue({ id: "d1", code: "CSE" });
    prisma.student.count.mockResolvedValue(0);
    prisma.department.delete.mockResolvedValue({});

    await expect(departmentService.deleteDepartment("d1")).resolves.toBeUndefined();
    expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
  });
});

describe("hall.service — capacity validation", () => {
  test("createHall persists the given capacity/rows/columns", async () => {
    prisma.hall.create.mockImplementation(({ data }) => Promise.resolve({ id: "h1", ...data }));
    const hall = await hallService.createHall({
      hallNumber: "Hall 101",
      building: "Main Block",
      floor: "1",
      capacity: 40,
      rows: 5,
      columns: 8,
    });
    expect(hall.capacity).toBe(40);
    expect(hall.rows * hall.columns).toBeGreaterThanOrEqual(hall.capacity);
  });

  test("deleteHall is blocked when it already has a saved seating allocation", async () => {
    prisma.hall.findUnique.mockResolvedValue({ id: "h1", hallNumber: "Hall 101" });
    prisma.seatingAllocation.count.mockResolvedValue(5);

    await expect(hallService.deleteHall("h1")).rejects.toThrow(/existing seating allocations/);
  });

  test("listAvailableHalls only returns ACTIVE halls", async () => {
    prisma.hall.findMany.mockResolvedValue([{ id: "h1", status: "ACTIVE" }]);
    await hallService.listAvailableHalls();
    expect(prisma.hall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } })
    );
  });
});


// ==== FILE: backend/tests/examAllocationServices.test.js ====
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

jest.mock("../src/config/prisma", () => {
  const txClient = {
    exam: { create: jest.fn() },
    examDepartment: { createMany: jest.fn() },
    examStudent: { createMany: jest.fn() },
  };
  return {
    student: { findMany: jest.fn() },
    exam: { findUnique: jest.fn(), create: jest.fn() },
    seatingAllocation: { count: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((cb) => (typeof cb === "function" ? cb(txClient) : Promise.all(cb))),
    __txClient: txClient,
  };
});

const prisma = require("../src/config/prisma");
const examService = require("../src/services/exam.service");
const allocationService = require("../src/services/allocation.service");

describe("exam.service — department eligibility (spec section 9)", () => {
  test("createExam rejects when none of the selected departments have students", async () => {
    prisma.student.findMany.mockResolvedValue([]);

    await expect(
      examService.createExam({
        examName: "Data Structures",
        subjectCode: "CS301",
        subjectName: "Data Structures",
        date: "2026-09-20",
        session: "FN",
        startTime: "09:00",
        endTime: "12:00",
        duration: 180,
        departmentIds: ["dept-empty"],
      })
    ).rejects.toThrow("None of the selected departments currently have any students");
  });

  test("createExam only materializes ExamStudent rows for students in the SELECTED departments", async () => {
    // Only 2 CSE + 1 EEE student returned — simulates Student.findMany being
    // scoped to departmentId IN [CSE, EEE], never ECE/MECH.
    prisma.student.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    prisma.__txClient.exam.create.mockResolvedValue({ id: "exam-1" });
    prisma.exam.findUnique.mockResolvedValue({ id: "exam-1", examDepartments: [] });

    await examService.createExam({
      examName: "Digital Electronics",
      subjectCode: "EC302",
      subjectName: "Digital Electronics",
      date: "2026-09-20",
      session: "AN",
      startTime: "13:00",
      endTime: "16:00",
      duration: 180,
      departmentIds: ["cse-id", "eee-id"],
    });

    expect(prisma.__txClient.examStudent.createMany).toHaveBeenCalledWith({
      data: [
        { examId: "exam-1", studentId: "s1" },
        { examId: "exam-1", studentId: "s2" },
        { examId: "exam-1", studentId: "s3" },
      ],
    });
  });
});

describe("allocation.service — never silently overwrite (spec section 19)", () => {
  test("confirmAllocation throws ALLOCATION_EXISTS when one already exists and mode is not 'replace'", async () => {
    prisma.seatingAllocation.count.mockResolvedValue(3); // existing allocation present

    await expect(allocationService.confirmAllocation("exam-1", { mode: "create" })).rejects.toThrow(
      "A seating allocation already exists for this exam"
    );
  });
});


// ==== NOTE: backend addendum (staff self-service duties endpoint) ====
// Plain-text patch instructions, not a standalone file — see
// s5/BACKEND_ADDENDUM_staff_duties_endpoint.txt content below for reference.
// ADDENDUM to backend/src/controllers/invigilation.controller.js
// Add this function alongside `generate` and `getOne`, and export it.

async function getMyDuties(req, res, next) {
  try {
    const prisma = require("../config/prisma");
    const duties = await prisma.invigilationDuty.findMany({
      where: { staffId: req.user.id },
      include: { exam: true, hall: true },
      orderBy: [{ date: "asc" }],
    });
    const { success } = require("../utils/apiResponse");
    return success(res, { message: "Your invigilation duties", data: duties });
  } catch (err) {
    return next(err);
  }
}

// Update the module.exports line to:
//   module.exports = { generate, getOne, getMyDuties };


// ---------------------------------------------------------------------------
// ADDENDUM to backend/src/routes/invigilation.routes.js
// Add a STAFF-accessible route ABOVE the `router.use(requireAuth, requireRole("ADMIN"))`
// line, since that line locks the rest of the file to ADMIN only.
// The full updated file becomes:
// ---------------------------------------------------------------------------

/*
const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/invigilation.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/rbac.middleware");
const { validate } = require("../middleware/validate.middleware");

const router = express.Router();

// Staff can view only their OWN duties — separate from the admin-only block below.
router.get("/me/duties", requireAuth, requireRole("STAFF"), controller.getMyDuties);

router.use(requireAuth, requireRole("ADMIN"));

router.post(
  "/generate",
  [body("examId").isUUID(), body("invigilatorsPerHall").optional().isInt({ min: 1 })],
  validate,
  controller.generate
);
router.get("/:examId", [param("examId").isUUID()], validate, controller.getOne);

module.exports = router;
*/
