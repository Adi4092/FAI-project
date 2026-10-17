# MedStock AI — Session Handoff & Progress Report

**Current Local Time:** 2026-10-17T17:29:09+05:30  
**Repository Path:** `c:\Users\sbhoe\OneDrive\Desktop\FAI project`  

---

## 1. Phases Status

- **Phase 1 (Requirements and Architecture):** ✅ **Completed**
- **Phase 2 (Frontend Foundation):** ✅ **Completed**
- **Phase 3 (Inventory Backend):** ✅ **Completed**
- **Phase 4 (Inventory Frontend Integration):** ✅ **Completed & Manually Tested E2E**
- **Phase 5 (AI Service):** ✅ **Completed & Verified (31/31 Pytest Passing)**
- **Phase 6 (Inventory Intelligence):** ✅ **Completed & Verified (Manually Tested E2E; 27/27 Server Vitest, 31/31 AI Pytest, 9/9 Client Vitest Passing)**
- **Phase 7 (Purchase Orders, Reports, Notifications Screen, Users, Settings, CSV Import):** ⏳ **Next Task**
- **Phase 8 (Integration and QA):** ⏳ **Not Started**

---

## 2. Run Everything (Automation Scripts)

Root Windows batch scripts automate launching and stopping the three application tiers:

1. **`start-all.bat`:**
   - Validates existence of `ai-service\.venv`, `server\node_modules`, `client\node_modules`, and `server\.env`. If missing, prints exact setup commands and halts.
   - Reads target ports (`8000` for AI Service, `5000` from `server/.env`, and `5173` for Vite client).
   - Opens three independent, titled `cmd /k` windows:
     - `"AI Service (8000)"`: runs `uvicorn app.main:app --reload --reload-dir app --port 8000` in `ai-service\.venv`.
     - `"Server (5000)"`: runs Express API server (`npm run dev`) in `server/`.
     - `"Client (5173)"`: runs Vite React frontend (`npm run dev`) in `client/`.
   - Waits 8 seconds for server initialization and opens `http://localhost:5173` in the default browser.
2. **`stop-all.bat`:**
   - Scans `netstat -ano` for listening ports (`8000`, `5000`, `5173`).
   - Kills only the specific PIDs found via `taskkill /F /T /PID <PID>`. Does not kill other Node or Python processes.
   - Verifies that all three ports are free.

---

## 3. MongoDB Atlas Connection & DNS Resolution

- **Connection Status:** Fully operational and tested.
- **Resolution of Previous SRV DNS Issue:** On Windows environments (especially mobile hotspot or router DNS proxies), Node.js `c-ares` resolver throws `querySrv ECONNREFUSED` when resolving `mongodb+srv://` URIs.
- **Fix Applied:** Configured standard direct replica set hosts in `server/.env` with `ssl=true&replicaSet=atlas-ovwwa5-shard-0&authSource=admin`. This bypasses SRV lookup and resolves hostnames via standard OS DNS (`dns.lookup`).
- **Test Database Isolation:** Server tests in `server/tests/setup.js` strictly use an isolated test database (`medstock_test`) on an ephemeral in-memory MongoDB replica set (`MongoMemoryReplSet`). `tests/setup.js` overrides `process.env.MONGODB_URI` and `env.MONGODB_URI`, includes a critical safety abort halting if any test attempts to connect to the development `medstock` database, clears collections between tests (`beforeEach`), and drops the test database on teardown (`afterAll`). The development database is completely untouched during `npm test`.

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

## 5. Phase 5: AI Service Architecture (`ai-service/`)

### 5.1 Components Implemented
- **Environment & Configuration:**
  - Python 3.12 virtual environment at `ai-service/.venv/`.
  - Pinned `requirements.txt` (`fastapi==0.115.6`, `uvicorn[standard]==0.34.0`, `scikit-learn==1.6.1`, `pandas==2.2.3`, `numpy==2.2.1`, `joblib==1.4.2`, `pydantic==2.10.4`, `pytest==8.3.4`).
  - `.env` & `.env.example` (`MODEL_DIR=./trained_models`, `LOG_LEVEL=info`, `PORT=8000`).
- **Synthetic Data Generator (`app/data/synthetic_generator.py`):**
  - Seed 42 for 100% reproducibility.
  - 30 medicines (`MED-001` to `MED-030`), 410 daily history records each (12,300 total records from 2025-09-01 to 2026-10-15).
  - Patterns: stable high-demand, stable low-demand, increasing trend (+40%), seasonal winter sinusoidal cycles, intermittent/zero-inflated (70% zeros).
  - Deliberate 5-10 day stockout runs flagged with `stockoutObserved=True`.
  - Output files in `data/synthetic/`: `daily_usage.csv`, `medicines.csv`, `batches.csv`, `suppliers.csv`, `purchase_orders.csv`.
- **Censored Demand Masking (`app/forecasting/masking.py`):**
  - Daily series continuous alignment.
  - Stockout days (`stockoutObserved=True`) are masked (`NaN` in `target_demand`) and strictly excluded from training and holdout evaluation targets; never treated as zero demand.
  - Intermittent legitimate zero-dispensing days (`stockoutObserved=False`) are preserved as 0.0.
- **Zero-Leakage Feature Engineering (`app/forecasting/features.py`):**
  - Features: `lag_1, lag_2, lag_3, lag_7, lag_14, lag_28`, `roll_mean_7, roll_mean_14, roll_mean_28` (with `shift(1)`), `roll_std_7` (with `shift(1)`), `day_of_week`, `dow_sin`, `dow_cos`, `month`, `day_of_month`, `is_weekend`, `days_since_last_nonzero`, `medicine_scale` (trailing 28-day mean with `shift(1)`).
  - Strictly no future leakage: modifying future data points has zero effect on features or predictions at time $t$.
- **Forecasting Models (`app/forecasting/`):**
  - `MovingAverageBaseline`: 7-day trailing non-masked moving average projected flat.
  - `GlobalRandomForestModel`: Global model across medicines (`n_estimators=150, min_samples_leaf=3, random_state=42`) with scale-invariant normalization.
  - `forecast_recursive`: Multi-step recursive forecasting engine predicting $t+1$, appending prediction to history buffer, updating lags and rolling stats, and projecting up to horizon $H \in \{7, 15, 30\}$.
- **Chronological Holdout Evaluation & Metrics (`app/evaluation/`):**
  - Chronological split only (last 30 days held out, never shuffled).
  - Metrics: MAE, RMSE, WAPE ($\sum |y-\hat{y}| / \sum y$, returns `null` when $\sum y = 0$).
  - Auto mode selection: selects lower WAPE (or lower MAE if WAPE is null).
- **Minimum History Rules & Guardrails (Section 9.6):**
  - $< 14$ non-masked days: Rejected with `INSUFFICIENT_HISTORY` (HTTP 422).
  - $14 - 59$ non-masked days: Baseline only, `provisional: True`, warning attached.
  - $\ge 60$ non-masked days: Full RF vs Baseline comparison, `provisional: False`.
  - Intermittent demand warning when zeros $\ge 50\%$.
- **Model Registry & Persistence (`app/services/`):**
  - `model_registry.py`: Thread-safe model container loaded once at startup.
  - `trainer.py`: Two-phase training pipeline: evaluates out-of-sample on a 30-day chronological holdout, then refits the final production model on 100% of data. Persists Joblib artifact (`active_model.joblib`) and metadata JSON to `trained_models/` with standard version tag `rf-2026.10.1`.
- **FastAPI Endpoints (`app/api/routes.py` & `app/main.py`):**
  - `GET /health` -> `{status: "ok", modelLoaded: bool, version: str}`
  - `GET /model-info` -> model metadata, feature list, training window, last evaluation metrics.
  - `POST /forecast` -> validates horizon (7, 15, 30), generates forecast, totalPredicted, metrics, provisional flag, dataWindow, warnings.
  - `POST /evaluate` -> chronological holdout evaluation returning RF vs baseline comparative metrics.
  - `POST /train` -> retrains global model from multi-medicine history, bumps version, saves artifact.
  - Clean error handlers without stack trace exposure.
- **Documentation (`docs/ai-evaluation.md`):**
  - Real metrics documented from synthetic holdout backtest (RF MAE 2.264 vs Baseline 4.389; RF WAPE 12.30% vs Baseline 23.84%).
  - Detailed explanation of chronological holdout evaluation and confirmation that the production model is refitted on all data.
  - Prominent synthetic data caveat stating results do not prove real-world hospital performance.

---

## 6. What Was Actually Tested vs. Not Tested

### 6.1 Tested & Passing:
1. **AI Service Pytest Test Suite (`ai-service/`):**
   - **25/25 automated tests passing** across 7 test suites:
     - `test_validation.py` (horizons 7, 15, 30 accepted; invalid horizons 0, 5, 10, 14, 16, 28, 45, 60 rejected with 422; missing fields rejected; clean JSON without stack traces)
     - `test_history_rules.py` (<14 days rejected `INSUFFICIENT_HISTORY`; masked stockout days reduce valid count; 14-59 days provisional baseline; >=60 days full model; intermittent demand warning)
     - `test_masking.py` (stockout days masked with NaN and never treated as zero; intermittent zeros preserved; missing calendar days filled; metrics ignore masked days)
     - `test_no_leakage.py` (`shift(1)` verified; changing future values does not affect past features or predictions)
     - `test_chronological_split.py` (strict chronological order preserved; WAPE formula verified; zero-demand returns `null`)
     - `test_model_persistence.py` (Joblib save/load round-trip; loaded predictions match identically; model registry loads active model)
     - `test_api_endpoints.py` (`GET /health`, `GET /model-info`, `POST /forecast`, `POST /evaluate`, `POST /train` all verified end-to-end)
2. **Live FastAPI Service End-to-End Verification (`tests/verify_ai_service.py`):**
   - Executed against live uvicorn server on `http://127.0.0.1:8000` using synthetic history for `MED-001` ending `2026-10-14`:
     - **`GET /health` & `GET /model-info` (200 OK):** Verified `status: "ok"`, `modelLoaded: true`, `activeModelName: "random_forest"`, `modelVersion: "rf-2026.10.1"`, 18 features registered.
     - **`POST /forecast` 90-day history, horizon 15 (200 OK):** `provisional: false`, exactly 15 rows starting `2026-10-15` through `2026-10-29`, all predictions non-negative (34.13–67.21), RF MAE 4.528 vs Baseline MAE 13.647, `warnings: []`.
     - **Idempotency Check (200 OK):** Identical request repeated back-to-back returned byte-for-byte identical response (`totalPredicted: 841.1`).
     - **Variable Horizons 7 and 30 (200 OK):** Horizon 7 returned exactly 7 daily rows (`2026-10-15` to `2026-10-21`); horizon 30 returned exactly 30 daily rows (`2026-10-15` to `2026-11-13`).
     - **30-day History Guardrail (200 OK):** Short history (30 valid days) automatically enforced `provisional: true`, switched to `moving_average_baseline`, and attached warning `Insufficient history for Random Forest (minimum 60 days required)`.
     - **10-day Insufficient History Guardrail (422 Unprocessable Entity):** Clean rejection with error code `INSUFFICIENT_HISTORY` and message `Insufficient history (10 valid non-masked days). A minimum of 14 days is required for forecasting.` — zero stack trace exposure.
     - **Invalid Horizon Validation (422 Unprocessable Entity):** Request with `horizonDays: 10` rejected with `VALIDATION_ERROR` on field `body.horizonDays` — zero stack trace exposure.
     - **Stockout Masking Verification (200 OK):** 90-day history with 6 consecutive stockout zeros (`stockoutObserved: true`) reported `maskedDays: 6` in `dataWindow` and maintained mean daily forecast of 54.04 units/day (total 810.59), confirming demand was NOT dragged toward zero.
     - **Zero Denominator Robustness (200 OK):** 90-day all-zero history handled cleanly with 0 crashes: `totalPredicted: 0.0`, `metrics.wape: null` (safe null handling), and attached warning `intermittent demand — forecast less reliable`.
3. **Multi-Horizon Recursive Evaluation (`docs/ai-evaluation.md`):**
   - Out-of-sample recursive multi-step backtest across all 30 medicines with zero actual holdout values used:
     - **Horizon 7:** RF MAE 2.374, WAPE 13.07% vs Baseline MAE 4.383, WAPE 24.13%.
     - **Horizon 15:** RF MAE 2.238, WAPE 12.11% vs Baseline MAE 4.301, WAPE 23.27%.
     - **Horizon 30:** RF MAE 2.292, WAPE 12.45% vs Baseline MAE 4.389, WAPE 23.84%.
   - Full 100% historical refit performed after out-of-sample evaluation for final production model (`rf-2026.10.1`).
   - Pytest test isolation confirmed: running test suite uses temporary directories for training tests and does not alter `trained_models/active_model.joblib` or bump `modelVersion`/`trainedAt`.
4. **Manual End-to-End Testing (Phase 4 Verified & Working):**
   - Add medicine, receive batch, FEFO dispense across two batches, rejected over-dispense, return, adjustment, and ledger balances.
5. **Backend Test Suite (`npm test` in `server/`):**
   - 14/14 automated tests passing in Vitest.
6. **Frontend Build & Linter (`client/`):**
   - Vite build clean; Oxlint clean across 74 files.

### 6.2 What Was NOT Done / Scope Boundaries:
- **Phase 6 (Inventory Intelligence):** Not started yet.
  - Expiry-risk simulation (`POST /expiry-risk`, `expiry/simulator.py`) was not built yet (deferred to Phase 6 per spec).
  - Express-to-FastAPI integration (Express calling FastAPI `/forecast` and `/evaluate`) was not built yet (deferred to Phase 6 per spec).
  - Stockout prediction service and reorder recommendation service are deferred to Phase 6.
- **Client & Server Code:** Remained completely untouched as instructed.

---

## 7. Seeded Demo Accounts

The following demo accounts exist in the database:
- `admin@medstock.local` (Password: `password123`, Role: `admin`)
- `manager@medstock.local` (Password: `password123`, Role: `inventory_manager`)
- `staff@medstock.local` (Password: `password123`, Role: `staff`)

---

## 8. Phase 6: Inventory Intelligence (Completed)

Reference: [MedStock_AI_Project_Spec.md](file:///c:/Users/sbhoe/OneDrive/Desktop/FAI%20project/MedStock_AI_Project_Spec.md) Sections 7, 8, 9, 14, and [docs/api-contract.md](file:///c:/Users/sbhoe/OneDrive/Desktop/FAI%20project/docs/api-contract.md)

### 8.1 Backend Implementation Details
1. **Express `aiClient` Service (`server/src/services/aiClient.js`):**
   - Implemented with Node.js native `fetch` and `AbortSignal.timeout` (configured timeout `AI_SERVICE_TIMEOUT_MS`, default 30,000ms).
   - Clean error normalization: on ECONNREFUSED, timeout, or network drop, throws `503 AI_SERVICE_UNAVAILABLE` with clear user-friendly explanation and zero stack leaks.
2. **`DailyUsage` Aggregation (`server/src/services/usageService.js`):**
   - Aggregates strictly `dispense` movements (`receipt` movements are never counted as consumption).
   - Computes `stockoutObserved = true` if `balanceAfter <= 0` at any point that day.
   - Endpoint: `POST /api/forecasts/refresh-usage` for on-demand ledger aggregation.
   - Database seed script provides 365 days of continuous daily history per medicine (exceeding the 90-day minimum requirement).
3. **Forecast Generation and Persistence (`server/src/services/forecastService.js`):**
   - `Forecast` Mongoose model (`server/src/models/Forecast.js`) capturing `modelName`, `modelVersion`, `generatedAt`, holdout validation metrics (`mae`, `rmse`, `wape`, `baselineMae`, `baselineRmse`, `baselineWape`, `holdoutDays`), `provisional` baseline flag, `dataWindow` (`from`, `to`, `days`, `maskedDays`), and `warnings`.
   - Generates `"forecast ready"` notification with dedupeKey `FORECAST_READY:<medicineId>`.
   - Endpoints: `POST /api/forecasts/generate`, `GET /api/forecasts`, `GET /api/forecasts/:id`, `GET /api/forecasts/usage/:medicineId`, `POST /api/forecasts/refresh-usage`, `POST /api/forecasts/retrain`, `GET /api/forecasts/model-info`, `GET /api/forecasts/health`.
4. **Expiry-Risk Simulation (`ai-service/app/expiry/simulator.py` & `server/src/services/expiryRiskService.js`):**
   - FastAPI `POST /expiry-risk`: day-by-day FEFO inventory consumption simulation across usable batches and confirmed incoming lots.
   - Extrapolates beyond forecast horizon using average daily demand and flags `extrapolated: true, confidence: 'low'`.
   - Risk classification thresholds: Critical (leftoverPct >= 60% or leftoverPct >= 30% with <= 14 days), High (30-60%), Medium (10-30%), Low (<10%).
   - Generates factual reasons and non-clinical suggested actions.
   - Express endpoints: `GET /api/expiry-risk`, `GET /api/expiry-risk/batch/:batchId` (usable batches only; expired batches strictly excluded).
5. **Stockout Prediction Service (`server/src/services/stockoutService.js`):**
   - Inputs: usable stock (strictly excluding expired batches), forecast demand, lead time $L$, safety stock $SS$, confirmed incoming POs only (`approved` or `partially_received`).
   - Risk classification: Critical (stockout date < $L$ without incoming PO), High (stock projected below $SS$ before replenishment), Medium (ending buffer < $SS \times 1.5$), Low (otherwise).
   - Rule-based transparent fallback with visible badge when forecast data is provisional or limited.
   - Endpoint: `GET /api/stockout-predictions`.
6. **Reorder Recommendation Service (`server/src/services/reorderService.js`):**
   - Implements exact mathematical formulas from Section 9.9.
   - Persists all inputs and the full `formulaText` string on each recommendation for transparency.
   - Endpoints: `GET /api/reorders`, `POST /api/reorders/generate`, `POST /api/reorders/:id/approve` (creates draft `PurchaseOrder`), `POST /api/reorders/:id/reject` (with required reason), `POST /api/reorders/:id/adjust` (with quantity and note).
7. **Alert Job & Notification Service (`server/src/services/notificationService.js` & `server/src/jobs/alertJob.js`):**
   - Dedupe keys: `LOW_STOCK:<medicineId>`, `EXPIRY:<batchId>:<band>`, `STOCKOUT:<medicineId>`, `FORECAST_READY:<medicineId>`.
   - Partial unique index on `dedupeKey` where `resolvedAt: null` in MongoDB strictly blocks duplicate notifications for active conditions.
   - Auto-resolves notifications when conditions clear (e.g. stock replenished or stockout risk mitigated).
   - Endpoint: `POST /api/notifications/run-alerts`.

### 8.2 Frontend Integration Details (`client/`)
1. **Forecasting (`client/src/pages/ForecastingPage.jsx`):**
   - Connected to real backend endpoints. Medicine selector, horizon dropdown (7, 15, 30 days), and Generate Forecast action.
   - Demand projection chart (Recharts): actual dispensing history (solid) vs recursive machine learning predictions (dashed).
   - Model info card displaying model name, version, generated-at timestamp, and provisional badge.
   - Model performance metrics (MAE, RMSE, WAPE vs baseline) and training data window info.
2. **Expiry Risk (`client/src/pages/ExpiryRiskPage.jsx`):**
   - Connected to real backend API with review horizon tabs (7, 30, 60, 90 days) and risk severity filter.
   - Estimated wastage units and estimated value-at-risk KPI cards.
   - "Why flagged?" modal detailing simulation factual reasons, non-clinical suggested actions, and extrapolation confidence.
   - Visible mandatory disclaimer: *"Estimated — based on forecasts and assumptions, not guaranteed."*
3. **Stockout Predictions (`client/src/pages/StockoutPage.jsx`):**
   - Connected to real backend API with search and risk filters.
   - Displays current usable stock, lead time, lead-time demand, days to stockout, incoming confirmed POs, explanation, and recommended action.
   - Transparent badge *"Fallback Rule"* rendered when rule-based estimation is active due to limited forecast data.
4. **Reorders (`client/src/pages/ReordersPage.jsx`):**
   - Connected to real backend API with summary cards (total suggested units, estimated replenishment cost).
   - "Why this quantity?" modal displaying the complete mathematical formula breakdown and inputs.
   - Action buttons: Approve (creates draft Purchase Order), Adjust (modal with custom quantity and justification note), and Reject (modal requiring reason).

### 8.3 Manual End-to-End Verification (Checked by Hand)
The following workflows were manually tested and verified in the running application:
1. **Demand Forecasting (`client/src/pages/ForecastingPage.jsx`):**
   - **Generate Forecast:** Successfully triggered Random Forest demand forecasting with recursive multi-step predictions.
   - **Forecast History:** History table lists previous forecasts (timestamp, horizon, model name/version, total predicted demand, provisional badge).
   - **Reopen Saved Forecast:** Clicking any history row loads the saved projection into the chart, KPI cards, and daily breakdown table without calling the AI service, displaying the "Viewing saved forecast" banner and functioning "Back to latest" button.
2. **Expiry Risk Simulation (`client/src/pages/ExpiryRiskPage.jsx`):**
   - **Review Horizon Windows:** Tested 7, 30, 60, and 90-day review windows displaying **3, 16, 22, and 27 batches** respectively.
   - **Pagination Controls:** Verified pagination controls across pages ("Showing 1-20 of 22 batches" $\rightarrow$ "Showing 21-22 of 22 batches") and verified page index resets to 1 when switching review windows or risk severity filters.
   - **Why Flagged Modal:** Verified simulation factual reasons, non-clinical suggested actions, and trailing average demand explanation (`"No saved forecast; estimated from the last 28 days of average usage"`).
3. **Stockout Predictions (`client/src/pages/StockoutPage.jsx`):**
   - Verified simulated depletion timelines, lead-time demand calculations, incoming confirmed PO delivery impact, fallback rule indicators, and pagination controls.
4. **Reorders (`client/src/pages/ReordersPage.jsx`):**
   - **Formula Popup:** "Why this quantity?" modal displays complete mathematical formula breakdown and all inputs.
   - **Approve Action:** Approving a recommendation created draft purchase order **`PO-2026-0001`**, verified directly in MongoDB Atlas.
   - **Reject Action:** Verified rejection modal requiring mandatory justification reason.
   - **Adjust Action:** Verified adjustment modal updating quantity with custom justification note.

### 8.4 Automated Test Suite Results (Final Counts)
- **AI Service pytest:** **31/31 passing** (`ai-service/tests/test_expiry_risk.py` verified worked example 100 units, 3/day, 10d $\rightarrow$ 70 leftover, 70.0%, Critical; multi-batch FEFO; incoming lot demand absorption; extrapolation confidence; trailing average demand note).
- **Server Vitest:** **27/27 passing** across 4 test suites:
  - `server/tests/phase6.test.js`: 12/12 passing (including 60-day window two-page pagination across 22 batches with 0 duplicates/missing, window filtering for 5/45/75 days, expired stock exclusion, stockout with/without incoming POs, hand-checked reorder formula math, duplicate alert prevention, and 503 AI service down handling).
  - `server/tests/stockLogic.test.js`: 8/8 passing.
  - `server/tests/auth.test.js`: 5/5 passing.
  - `server/tests/seed.test.js`: 2/2 passing (including `spreadBatchExpiry` 5-200 day distribution and inventory ledger reconciliation).
- **Client Vitest:** **9/9 passing** across `ForecastingPage.test.jsx` (6 tests) and `ExpiryRiskPage.test.jsx` (3 tests covering demand source labeling, pagination navigation, page counts, and filter reset).
- **Client Build:** Vite production build compiles cleanly with 0 errors (`npm run build`).

### 8.5 What Is NOT Done (Scope Boundaries)
- **Purchase Order Receiving (Phase 7):** Receiving stock against open purchase orders with receipt batch creation, partial & full receipts, status transitions.
- **Reports & Analytics (Phase 7):** Consumption trends, realized wastage vs projected exposure, purchase history, valuation reports.
- **Notifications Screen (Phase 7):** Dedicated `/notifications` list view with status filtering, pagination, and mark-as-read.
- **Users Management (Phase 7):** Admin user management interface, role assignment, active/inactive toggle.
- **Settings (Phase 7):** Tabbed settings interface for lead times, safety stocks, service level Z, target coverage days.
- **CSV Import (Phase 7):** Bulk data import and reconciliation.

---

## 9. Next Task: Phase 7 (Purchase Orders, Reports, Notifications Screen, Users, Settings, CSV Import)


