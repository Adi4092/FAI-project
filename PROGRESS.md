# MedStock AI — Session Handoff & Progress Report

**Current Local Time:** 2026-10-14T11:15:00+05:30  
**Repository Path:** `c:\Users\sbhoe\OneDrive\Desktop\FAI project`  

---

## 1. Phases Status

- **Phase 1 (Requirements and Architecture):** ✅ **Completed**
- **Phase 2 (Frontend Foundation):** ✅ **Completed**
- **Phase 3 (Inventory Backend):** ✅ **Completed**
- **Phase 4 (Inventory Frontend Integration):** ⏳ **Not Started (Next Task)**
- **Phase 5 (AI Service):** ⏳ **Not Started**
- **Phase 6 (Inventory Intelligence):** ⏳ **Not Started**
- **Phase 7 (Remaining Screens):** ⏳ **Not Started**
- **Phase 8 (Integration and QA):** ⏳ **Not Started**

---

## 2. MongoDB Atlas Connection & DNS Resolution

- **Connection Status:** Fully operational and tested.
- **Resolution of Previous SRV DNS Issue:** On Windows environments (especially mobile hotspot or router DNS proxies), Node.js `c-ares` resolver throws `querySrv ECONNREFUSED` when resolving `mongodb+srv://` URIs.
- **Fix Applied:** Configured standard direct replica set hosts in `server/.env` with `ssl=true&replicaSet=atlas-ovwwa5-shard-0&authSource=admin`. This bypasses SRV lookup and resolves hostnames via standard OS DNS (`dns.lookup`).

---

## 3. Backend Inventory Architecture (`server/`)

### 3.1 Implemented Components
- **Configuration & Setup:**
  - `src/app.js` & `src/server.js` (Express ES modules bootstrap, port 5000)
  - `src/config/env.js` (Environment parser)
  - `src/config/db.js` (Mongoose connection management)
  - `src/config/logger.js` (Structured logger)
- **Middleware:**
  - `src/middleware/auth.js` (JWT cookie verification)
  - `src/middleware/authorize.js` (RBAC checking `admin`, `inventory_manager`, `staff`)
  - `src/middleware/csrf.js` (Double-submit `csrf_token` cookie vs `X-CSRF-Token` header)
  - `src/middleware/rateLimit.js` (Global + auth brute-force limiter)
  - `src/middleware/validate.js` (Zod schema validation)
  - `src/middleware/errorHandler.js` (Centralized error handler, standard envelopes, no stack leaks)
  - `src/middleware/notFound.js` (404 handler)
- **Data Models (`src/models/`):**
  - `User.js`, `RefreshToken.js` (TTL index, rotation)
  - `Medicine.js` (Unique code, active archive rule)
  - `Supplier.js`, `MedicineSupplier.js` (Compound unique index)
  - `Batch.js` (Compound unique index, date checks, computed `isExpired`/`daysToExpiry`)
  - `StockMovement.js` (Immutable ledger; pre-hooks strictly block `update`, `delete`, `replace`)
  - `DailyUsage.js` (Unique `[medicineId, date]` index, stockout flag)
  - `Setting.js` (System settings single document)
  - `AuditLog.js` (Append-only audit trail)
- **Services (`src/services/`):**
  - `authService.js` (Login, token rotation, revocation, cookie attachment)
  - `fefoService.js` (FEFO allocation algorithm; earliest expiry first, excludes expired)
  - `stockService.js` (Transactional receipt, dispense, return, adjust, write-off, compensating correction, ledger reconciliation)
  - `auditService.js` (Append-only audit logger)
- **Validators (`src/validators/`):**
  - `authValidator.js`, `medicineValidator.js`, `batchValidator.js`, `inventoryValidator.js`, `supplierValidator.js`
- **Controllers & Routes (`src/controllers/` & `src/routes/`):**
  - `authRoutes.js` (`/login`, `/refresh`, `/logout`, `/me`, `/csrf`)
  - `medicineRoutes.js` (CRUD, status archive, supplier associations)
  - `batchRoutes.js` (List, create, view, metadata-only PUT, history)
  - `inventoryRoutes.js` (`/summary`, `/fefo-preview`, `/receive`, `/dispense`, `/return`, `/adjust`, `/write-off`, `/reconcile`)
  - `stockMovementRoutes.js` (List ledger, CSV export, `/correct`)
  - `supplierRoutes.js` (CRUD, status, batches)
  - `userRoutes.js` (Admin user management, role modification, last-admin demote protection)
  - `settingRoutes.js` (Admin settings, CSV template download)
  - `auditLogRoutes.js` (Admin audit trail query)
- **Seed Script (`src/seed/seed.js`):**
  - Idempotent database seeder (`npm run seed`, `--reset-demo`).
- **Tests (`tests/`):**
  - `setup.js` (MongoMemoryReplSet test harness)
  - `auth.test.js`, `stockLogic.test.js`, `seed.test.js`

### 3.2 Specification Checklist & Scope Boundaries
- **Phase 3 Scope Complete:** All Phase 3 requirements defined in `MedStock_AI_Project_Spec.md` Section 19 are implemented.
- **Intentionally Deferred to Later Phases:**
  - Purchase Orders lifecycle (`/api/purchase-orders` full workflow): Scheduled for Phase 7. `GET /api/suppliers/:id/purchase-orders` returns empty array for now.
  - FastAPI AI Service integration (`/api/forecasts`, `/api/expiry-risk` via FastAPI): Scheduled for Phases 5 and 6.

---

## 4. Run Commands and Environment Variables

### 4.1 Exact Commands
```bash
# In server/
cd server

# Install dependencies
npm install

# Run automated tests (runs in-memory replica set)
npm test

# Seed database to Atlas (idempotent)
npm run seed

# Seed with full wipe of demo data
npm run seed -- --reset-demo

# Start Express server in development mode (port 5000)
npm run dev
```

### 4.2 Required Environment Variables in `server/.env`
*(Variable names only — never commit credentials)*
- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL_DAYS`
- `CLIENT_ORIGIN`
- `AI_SERVICE_URL`
- `AI_SERVICE_TIMEOUT_MS`
- `BCRYPT_COST`

---

## 5. What Was Actually Tested vs. Not Tested

### 5.1 Tested & Passing (14/14 automated tests):
1. **Authentication (`tests/auth.test.js`):**
   - Valid login returns 200, user object, and sets HTTP-only cookies.
   - Invalid password rejected with 401.
   - `GET /api/auth/me` returns current user session.
   - CSRF double-submit token check rejects mutations when `X-CSRF-Token` is missing (403).
   - RBAC restricts `staff` role from admin endpoints (403).
2. **Stock Logic & Ledger (`tests/stockLogic.test.js`):**
   - Duplicate medicine code rejected (409).
   - Stock receipt creates batch and immutable `receipt` movement (+).
   - FEFO allocation dispenses from earliest-expiring active batches first.
   - Dispensing from expired batches is blocked (409 BATCH_EXPIRED).
   - Negative stock prevented (409 INSUFFICIENT_STOCK).
   - Stock adjustments require mandatory reason and write adjustment movement.
   - Write-offs remove remaining quantity and calculate realized wastage financial cost.
   - Reconcile endpoint verifies batch `currentQuantity` matches ledger sum with 0 mismatches.
3. **Database Seeding (`tests/seed.test.js` & live run):**
   - Seed ran against both in-memory replica set and live Atlas cluster.
   - Live Atlas seed verified: 3 users, 5 suppliers, 30 medicines, 65 batches, 10,950 daily usage records, reconciliation verified with 0 mismatches.

### 5.2 What Was NOT Tested (Do Not Assume Working):
- Live frontend integration with Express API (Phase 4 scope).
- Live FastAPI AI communication (Phase 5/6 scope).
- Purchase order approval / multi-line PO receiving workflow (Phase 7 scope).

---

## 6. Seeded Demo Accounts

The following demo accounts exist in the database (passwords are set via local bcrypt in `server/.env` / `seed.js`):
- `admin@medstock.local` (Role: `admin`)
- `manager@medstock.local` (Role: `inventory_manager`)
- `staff@medstock.local` (Role: `staff`)

---

## 7. Decisions, Differences & Shortcuts

1. **Direct Replica Set Connection String:** Standard 3-host URI format is used in `server/.env` instead of `mongodb+srv://` to avoid the Node.js/Windows DNS SRV `ECONNREFUSED` issue on personal hotspot/local router DNS proxies.
2. **Atomic Conditional Updates with Fallback:** `withTransaction` detects replica set transaction support. If standalone MongoDB is ever used without a replica set, operations fall back to atomic conditional `$inc` updates.
3. **Phase 2 Frontend Demo Session Bridge:** React client currently uses an in-memory / local storage demo fallback for screen inspection. Live network wiring begins in Phase 4.

---

## 8. Mock Data in Frontend (To Be Replaced in Phase 4)

In `client/src/`:
- `MedicinesPage.jsx`: In-memory `mockMedicines` array.
- `InventoryPage.jsx`: In-memory `mockBatches` array.
- `StockMovementsPage.jsx`: In-memory `mockMovements` array.
- `SuppliersPage.jsx`: In-memory `mockSuppliers` array.
- `authService.js`: Mock session fallback when network returns offline.

---

## 9. Next Task: Phase 4 (Inventory Frontend Integration)

Reference: [docs/api-contract.md](file:///c:/Users/sbhoe/OneDrive/Desktop/FAI%20project/docs/api-contract.md)
1. Wire React `api.js` (Axios with `withCredentials: true`, CSRF extraction) to Express.
2. Replace mock login with real `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
3. Connect `MedicinesPage.jsx` to `GET/POST/PUT /api/medicines`.
4. Connect `InventoryPage.jsx` to `GET /api/batches` and `POST /api/inventory/receive`, `/dispense` (FEFO modal), `/write-off`.
5. Connect `StockMovementsPage.jsx` to `GET /api/stock-movements` and CSV export.
6. Connect `SuppliersPage.jsx` to `GET/POST /api/suppliers`.
