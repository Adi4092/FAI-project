# MedStock AI — Session Handoff & Progress Report

**Current Local Time:** 2026-10-14T23:05:45+05:30  
**Repository Path:** `c:\Users\sbhoe\OneDrive\Desktop\FAI project`  

---

## 1. Phases Status

- **Phase 1 (Requirements and Architecture):** ✅ **Completed**
- **Phase 2 (Frontend Foundation):** ✅ **Completed**
- **Phase 3 (Inventory Backend):** ✅ **Completed**
- **Phase 4 (Inventory Frontend Integration):** ✅ **Completed & Manually Tested E2E**
- **Phase 5 (AI Service):** ⏳ **Not Started (Next Task)**
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
  - `auth.test.js`, `stockLogic.test.js`, `seed.test.js` (14/14 tests passing)

---

## 4. Phase 4: Frontend Integration Architecture (`client/`)

### 4.1 Network Layer & Auth Bridge
- **`services/api.js`:**
  - Axios instance configured with `withCredentials: true` and base URL pointing to Express API (`http://localhost:5000/api`).
  - Request interceptor extracts the double-submit CSRF cookie (`csrf_token`) or in-memory fallback, automatically fetching `/api/auth/csrf` on state-changing requests if no token is present.
  - Response interceptor implements queue-based automatic refresh token rotation when receiving `401 TOKEN_EXPIRED`, seamlessly retrying failed requests.
- **`services/authService.js` & `context/AuthContext.jsx`:**
  - Removed all mock session fallbacks (`medstock_demo_user` localStorage).
  - Wired directly to `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, and `GET /api/auth/csrf`.
  - Added redirect guard on `LoginPage.jsx` when user is already authenticated.

### 4.2 API Client Services (`services/`)
- **`services/medicineService.js`:**
  - `getMedicines(params)` (with pagination, search, category, status, low stock filters)
  - `getMedicineById(id)`
  - `createMedicine(payload)`
  - `updateMedicine(id, payload)`
  - `updateMedicineStatus(id, isActive)`
  - `getMedicineBatches(id)`
  - `getMedicineSuppliers(id)`
  - `updateMedicineSuppliers(id, suppliers)`
- **`services/batchService.js`:**
  - `getBatches(params)` (pagination, search, medicineId, supplierId, expiryStatus, status)
  - `getBatchById(id)`
  - `createBatch(payload)`
  - `updateBatch(id, payload)`
  - `getBatchHistory(id)` (ledger entries)
- **`services/inventoryService.js`:**
  - `getInventorySummary()` (KPIs: usable stock, expired units, active batches, 30d expiries)
  - `getFefoPreview(medicineId, quantity)` (live First-Expiry-First-Out preview)
  - `receiveStock(payload)`
  - `dispenseStock(payload)`
  - `returnStock(payload)`
  - `adjustStock(payload)`
  - `writeOffStock(payload)`
  - `reconcileInventory()`
- **`services/stockMovementService.js`:**
  - `getStockMovements(params)`
  - `exportStockMovementsCsv(params)` (downloads CSV blob directly in browser)
  - `correctStockMovement(id, reason)` (compensating ledger correction)
- **`services/supplierService.js`:**
  - `getSuppliers(params)`
  - `getSupplierById(id)`
  - `createSupplier(payload)`
  - `updateSupplier(id, payload)`
  - `updateSupplierStatus(id, isActive)`
  - `getSupplierBatches(id)`
  - `getSupplierPurchaseOrders(id)`

### 4.3 Screen Implementations & Reusable Modals
- **Medicines Catalogue (`pages/MedicinesPage.jsx`):**
  - Live table bound to MongoDB Atlas via Express API.
  - Search input with debounce, Category filter, Status filter (Active/Archived/All), and Low Stock Alert filter.
  - Pagination controls.
  - `MedicineFormModal.jsx`: Modal for adding and editing medicines with threshold validation.
  - `MedicineDetailModal.jsx`: Modal displaying medicine details, stock summary, and associated active batches.
  - `ConfirmDialog.jsx`: Confirmation workflow for archiving and reactivating medicines.
  - RBAC protection: only `admin` and `inventory_manager` can add, edit, or archive.
- **Batches & Inventory (`pages/InventoryPage.jsx`):**
  - KPI overview banner displaying live data from `/api/inventory/summary`.
  - Tabs switching between Usable Stock (`status=active`) and Expired/Quarantined Batches (`status=expired`).
  - Search input, Medicine filter, Expiry status filter (Healthy / Expiring Soon ≤30d).
  - `ReceiveStockModal.jsx`: Allows receiving new stock batches, selecting from active medicines and suppliers.
  - `DispenseModal.jsx`: FEFO dispensing dialog with interactive real-time allocation breakdown, remaining balance projection, and safety block on insufficient or expired stock.
  - `AdjustStockModal.jsx`: Cycle adjustment with mandatory audit reason.
  - `WriteOffModal.jsx`: Quarantined batch write-off with realized wastage calculation.
  - `BatchHistoryModal.jsx`: Displays chronological ledger trail for any batch.
  - Admin Reconcile Ledger action: runs `/api/inventory/reconcile` and confirms 0 ledger mismatches.
- **Stock Movement History (`pages/StockMovementsPage.jsx`):**
  - Immutable audit ledger table connected to `GET /api/stock-movements`.
  - Filters: search query, movement type, Date From / Date To range.
  - CSV export button streaming and downloading `stock-movements.csv`.
  - `CorrectMovementModal.jsx`: Posts compensating correction entries for managers and admins.
- **Supplier Management (`pages/SuppliersPage.jsx`):**
  - Vendor directory connected to `GET /api/suppliers`.
  - Search query and active/inactive status filter.
  - `SupplierFormModal.jsx`: Add and edit supplier records with contracted lead times.
  - `SupplierDetailModal.jsx`: View vendor details and inventory batches supplied by that vendor.
  - ConfirmDialog for activating/deactivating suppliers.

---

## 5. What Was Actually Tested vs. Not Tested

### 5.1 Tested & Passing:
1. **Manual End-to-End Testing (Phase 4 Verified & Working):**
   - **Add Medicine:** Created new medicine in the catalogue via `MedicineFormModal`; verified catalogue updates and appears in listings.
   - **Receive Batch:** Received new stock batch via `ReceiveStockModal`; verified batch creation in inventory and initial `receipt` movement logged to ledger.
   - **FEFO Dispense across Two Batches:** Dispensed quantity requiring allocation from two distinct batches; verified First-Expiry-First-Out logic allocated from earliest-expiring active batches first and deducted correct balances.
   - **Rejected Over-Dispense:** Tested dispensing exceeding available usable stock; verified rejection and negative-stock prevention.
   - **Return:** Recorded stock return with mandatory reason; verified stock increment and ledger entry.
   - **Adjustment:** Adjusted stock count with mandatory audit reason; verified batch balance updated and adjustment movement posted.
   - **Ledger Balances:** Verified batch balances match the sum of immutable ledger entries with zero mismatches.
2. **Frontend Build (`npm run build` in `client/`):**
   - Built cleanly with Vite; 0 compilation or syntax errors.
3. **Frontend Linter (`npm run lint` in `client/`):**
   - Oxlint passed across 74 files with 0 errors.
4. **Backend Test Suite (`npm test` in `server/`):**
   - 14/14 automated tests passing in Vitest (auth, stock logic, seed, reconciliation).
5. **Live Express Server & Atlas MongoDB:**
   - Healthy on port 5000 (`/health` returns `200 OK`).

### 5.2 What Was NOT Tested / Scope Boundaries:
- **Phase 5 (AI Service):** Not started yet. No FastAPI endpoints, Python models, or synthetic dataset training have been initiated or tested.
- **Phase 6 (Inventory Intelligence):** Not started yet. Demand forecasts, expiry-risk simulation, and stockout predictions are not connected to AI services.
- **Phase 7 (Remaining Screens):** Full purchase order approval lifecycle, notification dispatch, system settings CSV import, and user management remain for Phase 7.

---

## 6. Seeded Demo Accounts

The following demo accounts exist in the database:
- `admin@medstock.local` (Password: `password123`, Role: `admin`)
- `manager@medstock.local` (Password: `password123`, Role: `inventory_manager`)
- `staff@medstock.local` (Password: `password123`, Role: `staff`)

---

## 7. Next Task: Phase 5 (AI Service)

Reference: [MedStock_AI_Project_Spec.md](file:///c:/Users/sbhoe/OneDrive/Desktop/FAI%20project/MedStock_AI_Project_Spec.md) Section 19
1. Set up `ai-service/` directory with Python 3.11+ venv, FastAPI, Uvicorn, Pandas, scikit-learn.
2. Build synthetic data generator with masked stockout days.
3. Implement feature engineering (lags, rolling statistics, calendar signals) with strict no-leakage guarantees.
4. Implement baseline model (moving average) and Random Forest recursive forecaster.
5. Implement evaluation metrics (MAE, RMSE, WAPE) with chronological backtesting.
6. Persist models via Joblib and implement FastAPI endpoints (`/health`, `/model-info`, `/forecast`, `/evaluate`, `/train`).
7. Write and run pytest test suite.
