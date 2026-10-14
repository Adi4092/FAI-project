# MedStock AI — Complete Project Specification and Build Guide

**Audience:** an AI coding agent (Antigravity) and the developer supervising it.
**Project type:** Fundamentals of Artificial Intelligence (FAI) mini-project.
**Product:** AI-powered medicine inventory, expiry-risk prediction and demand forecasting for hospitals, clinics and pharmacies.

---

## 0. How the agent must work (read first)

1. Read this entire document before writing code.
2. Build **phase by phase** (Section 19). Finish, test and report each phase before starting the next. Never generate the whole project in one pass.
3. Keep the three-component architecture (React → Express → FastAPI). Do not merge them.
4. Do **not** introduce TypeScript, Next.js, PostgreSQL, Streamlit, or any second frontend framework. Do not swap the stack.
5. Write real, runnable code. No `// TODO implement later` for anything the current phase needs.
6. Every stock-changing operation must write a ledger entry. Every business rule in Section 8 must be enforced **on the server**.
7. Never fabricate AI results. UI values from models must come from the real FastAPI service. Anything demonstrational must be labelled "Demonstration data".
8. Never commit secrets. Provide `.env.example` files only.
9. After each phase, output: what was built, how to run it, what was tested, what remains.
10. If a decision is genuinely needed, choose the best practical option, state it in one or two sentences, and continue.
11. Keep controllers thin, business logic in `services/`, validation in `validators/`.
12. Distinguish implemented from planned functionality in the README.

---

## 1. Project summary

Traditional inventory systems track quantity, expiry and purchases. MedStock AI adds machine learning and explainable decision support on top of normal inventory management:

- Medicine catalogue and **batch-level** stock tracking with an immutable **stock ledger**.
- **Demand forecasting** (moving-average baseline vs Random Forest, chronological evaluation).
- **Expiry-risk simulation**: estimates how much of each batch will remain unused at its expiry date (FEFO-aware).
- **Stockout prediction** using lead time, safety stock and incoming orders.
- **Reorder recommendations** with a visible formula, reviewable before any order is created.
- Dashboards, notifications, reports, CSV import/export, role-based access, audit trail.

**Problems it addresses:** medicines expiring unused; fast-moving medicines running out; over/under ordering; history not turned into forecasts; staff not noticing batches that will likely go unused; purchases made without lead times, existing batches or incoming deliveries in mind.

**It is decision support and an educational project.** It must never make clinical decisions, recommend treatments, or allow expired medicine to be dispensed.

### Non-goals
- No clinical recommendations, patient records, prescriptions or billing.
- No claim that results on synthetic data prove real-world performance.
- No claim of a specific percentage reduction in wastage unless measured in a valid evaluation.

---

## 2. Technology stack (fixed)

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, React Router, Tailwind CSS (v3), Recharts, Lucide React, Axios, React Hook Form, Zod |
| Backend | Node.js, Express.js (ES modules), Mongoose, MongoDB Atlas, JWT, bcrypt, express-validator (or Zod), helmet, cors, cookie-parser, express-rate-limit, pino (or morgan) for logging |
| AI service | Python 3.11+, FastAPI, Uvicorn, Pydantic v2, Pandas, NumPy, scikit-learn, Joblib |
| Testing | Backend: Jest or Vitest + Supertest + mongodb-memory-server (replica set mode) or a dedicated Atlas test database. Frontend: Vitest + React Testing Library. AI: pytest |
| Tools | Git, npm, Python venv, Postman/Thunder Client, `.env` files |

**Database:** MongoDB **Atlas** (free M0 cluster). Atlas is a replica set, so **multi-document transactions are supported**. Use them for receipts, dispensing, adjustments and PO receiving.

---

## 3. Architecture

```
React (Vite)  --Axios, cookies-->  Express API  --Mongoose-->  MongoDB Atlas
                                       |   ^
                          JSON / HTTP  |   |  forecasts, risk results
                                       v   |
                                 FastAPI AI service
                       (stateless, no DB access, Joblib models)
```

### 3.1 Responsibilities

**React frontend**
- Renders all screens, tables, filters, charts, forms, notifications.
- Calls only the Express API through service modules. Never talks to MongoDB or FastAPI. Holds no secrets.
- Shows loading skeletons, empty states, validation errors, error states.

**Express backend (owns all state)**
- Authentication, authorization (RBAC), validation.
- Medicines, batches, suppliers, purchase orders, stock ledger, daily usage, forecasts, notifications, audit log, settings.
- Stock calculations and rule enforcement; transactions.
- Orchestrates AI calls: gathers history/batches → calls FastAPI → saves results → returns to React.
- Generates reports, CSV exports, alerts.

**FastAPI AI service (stateless)**
- Prepares data, trains/evaluates/persists models (Joblib), forecasts, runs expiry-risk simulation, returns metadata.
- **Never** reads or writes MongoDB. Express sends everything it needs in the request.

### 3.2 Request flows
- Normal: React → Express → MongoDB → Express → React.
- AI: React → Express (validates, loads usage history and batches) → FastAPI → Express (validates response, saves Forecast, creates notifications) → React.
- If FastAPI is down: Express returns `503 AI_SERVICE_UNAVAILABLE`; React shows an error state; if a recent saved forecast exists, Express may return it flagged `stale: true`.

### 3.3 Authentication and session design
- Access JWT (15 min) and refresh token (7 days) in **HTTP-only, Secure (in production), SameSite=Lax cookies**.
- Refresh tokens are stored **hashed** in a `RefreshToken` collection (userId, tokenHash, expiresAt, revokedAt) and rotated on use.
- CSRF protection: double-submit token. Server sets a readable `csrf_token` cookie; React sends it as `X-CSRF-Token` on every non-GET request; middleware compares header and cookie.
- CORS: allow only `CLIENT_ORIGIN` with `credentials: true`.
- Passwords hashed with bcrypt (cost ≥ 12). Login rate-limited (e.g. 5 attempts / 15 min / IP+email) with generic error messages.
- Never return `passwordHash` or token hashes in responses.

---

## 4. Repository structure

```
medstock-ai/
  client/
    src/
      assets/
      components/
        common/        Button, Input, Select, Modal, ConfirmDialog, Toast, Badge, Skeleton, EmptyState, ErrorState, Pagination, DataTable, DateRangeFilter, KpiCard, ChartCard, AlertPanel
        layout/        AppLayout, Sidebar, Topbar, MobileDrawer, PageHeader
        dashboard/
        medicines/
        inventory/
        forecasting/
        expiry/
        reorders/
        reports/
      pages/           LoginPage, DashboardPage, MedicinesPage, InventoryPage, ExpiryRiskPage, ForecastingPage, StockoutPage, ReordersPage, StockMovementsPage, SuppliersPage, PurchaseOrdersPage, ReportsPage, NotificationsPage, UsersPage, SettingsPage, NotFoundPage
      routes/          AppRoutes.jsx, ProtectedRoute.jsx, RoleRoute.jsx
      services/        api.js (axios instance), authService.js, medicineService.js, batchService.js, inventoryService.js, ...
      hooks/           useAuth, useDebounce, usePagination, useToast
      context/         AuthContext, ToastContext
      utils/           formatDate, formatNumber, csv, constants
      App.jsx
      main.jsx
    .env.example
  server/
    src/
      config/          env.js, db.js, logger.js
      models/
      routes/
      controllers/
      services/        stockService, fefoService, expiryRiskService, stockoutService, reorderService, forecastService, aiClient, notificationService, reportService, importService, auditService
      middleware/      auth, authorize, csrf, validate, errorHandler, rateLimit, notFound
      validators/
      utils/           apiResponse, ApiError, pagination, dates, csv
      jobs/            alertJob.js (alert generation)
      seed/            seed.js
      app.js
      server.js
    tests/
    .env.example
  ai-service/
    app/
      api/             routes_forecast.py, routes_expiry.py, routes_eval.py, routes_meta.py
      schemas/         pydantic models
      services/        model_registry.py, trainer.py
      forecasting/     features.py, baseline.py, random_forest.py, recursive.py, masking.py
      expiry/          simulator.py
      evaluation/      metrics.py, backtest.py, alert_eval.py
      data/            synthetic_generator.py
      utils/
      main.py
    trained_models/    (gitignored except .gitkeep)
    tests/
    requirements.txt
    .env.example
  data/
    synthetic/
    templates/         medicines.csv, batches.csv, daily_usage.csv
  docs/
    api-contract.md
    ai-evaluation.md
    ui-reference.png   (the 12-screen reference image)
    demo-workflow.md
  .gitignore
  README.md
```

---

## 5. Environment variables and run commands

### server/.env.example
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/medstock?retryWrites=true&w=majority
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
CLIENT_ORIGIN=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT_MS=30000
BCRYPT_COST=12
```

### client/.env.example
```
VITE_API_BASE_URL=http://localhost:5000/api
```

### ai-service/.env.example
```
MODEL_DIR=./trained_models
LOG_LEVEL=info
```

### Atlas setup
Create an M0 cluster → create a database user (not your Atlas login) → add your IP under Network Access → copy the driver connection string into `MONGODB_URI`. URL-encode special characters in the password.

### Run commands
```bash
# Client
cd client && npm install && npm run dev            # http://localhost:5173

# Server
cd server && npm install && npm run seed && npm run dev   # http://localhost:5000

# AI service
cd ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.data.synthetic_generator              # optional: generates sample CSVs
uvicorn app.main:app --reload --port 8000
```

---

## 6. Data model (Mongoose)

All models use timestamps (`createdAt`, `updatedAt`). All API output strips sensitive fields.

### 6.1 User
`name`, `email` (unique, lowercase), `passwordHash`, `role` (`admin` | `inventory_manager` | `staff`), `isActive`, `lastLoginAt`.

### 6.2 RefreshToken
`userId`, `tokenHash`, `expiresAt`, `revokedAt`, `userAgent`, `ip`.

### 6.3 Medicine
`medicineCode` (unique, uppercase, e.g. `MED-001`), `name`, `category`, `unit` (tablet, capsule, vial, sachet, ml…), `description`, `reorderLevel` (≥0), `safetyStock` (≥0, optional), `isActive`, `isDemo` (true for seeded data).
Index: unique `medicineCode`; text/regular index on `name`.
Rule: never hard-delete a medicine that has batches, movements or forecasts. Archive via `isActive=false`.

### 6.4 Supplier
`name`, `contactPerson`, `email`, `phone`, `address`, `defaultLeadTimeDays` (≥0), `isActive`, `isDemo`.
Duplicate protection: unique on normalized name; warn on same email.

### 6.5 MedicineSupplier (association)
`medicineId`, `supplierId`, `leadTimeDays`, `minOrderQty`, `unitCost`, `isPreferred`.
Unique index `(medicineId, supplierId)`. Lead time here overrides the supplier default.

### 6.6 Batch
`batchNumber`, `medicineId`, `supplierId`, `manufacturingDate`, `expiryDate`, `initialQuantity` (>0), `currentQuantity` (≥0, ≤ any possible balance), `purchaseCostPerUnit`, `receivedAt`, `status` (`active` | `depleted` | `expired` | `quarantined`), `purchaseOrderId` (optional), `isDemo`.
Indexes: unique `(supplierId, medicineId, batchNumber)`; `(medicineId, expiryDate)`; `expiryDate`.
Validation: `expiryDate > manufacturingDate`; `expiryDate > receivedAt` at creation; `currentQuantity ≤ initialQuantity + returns` (enforced through ledger logic).
Derived at read time (never trust stored): `isExpired = expiryDate < startOfToday`, `daysToExpiry`.

### 6.7 StockMovement (immutable ledger)
`batchId`, `medicineId`, `movementType` (`receipt` | `dispense` | `return` | `adjustment` | `expiry_writeoff` | `correction`), `quantityChange` (signed integer, non-zero), `balanceBefore`, `balanceAfter`, `referenceType` (`purchase_order` | `manual` | `import` | `system`), `referenceId`, `reason` (required for adjustment, correction, expiry_writeoff, return), `performedBy`, `timestamp`, `reversesMovementId` (for corrections).
**Sign convention:** receipt `+`, return `+`, dispense `−`, expiry_writeoff `−`, adjustment `±`, correction `±` (compensating entry).
**Immutable:** no update or delete endpoints. Mongoose pre-hooks should reject updates/deletes on this model.
Indexes: `(batchId, timestamp)`, `(medicineId, timestamp)`, `movementType`, `performedBy`.

### 6.8 DailyUsage
One record per `(medicineId, date)`; unique compound index.
Fields: `medicineId`, `date` (UTC day), `unitsDispensed`, `unitsReceived` (reconciliation only), `stockoutObserved` (boolean: true if usable stock hit 0 at any time that day, or stock was < demand), `dataSource` (`ledger` | `import` | `synthetic`), `createdAt`.
Maintenance: a service aggregates dispense movements into DailyUsage nightly and on demand (`POST /api/forecasts/refresh-usage`). **Receipts are never counted as consumption.** Returns reduce `unitsDispensed` for that day only if the return references a same-day dispense; otherwise they are tracked separately.

### 6.9 Forecast
`medicineId`, `generatedAt`, `generatedBy`, `forecastStartDate`, `forecastEndDate`, `horizonDays` (7|15|30), `modelName`, `modelVersion`, `predictedDailyDemand` [{date, predicted}], `predictedTotalDemand`, `evaluationMetrics` {mae, rmse, wape, baselineMae, baselineRmse, baselineWape, holdoutDays}, `dataWindow` {from, to, days, maskedDays}, `provisional` (bool), `warnings` [string], `status` (`completed` | `failed`).

### 6.10 PurchaseOrder
`orderNumber` (unique, e.g. `PO-2026-0001`), `supplierId`, `items` [{`medicineId`, `quantityOrdered`, `unitCost`, `quantityReceived`}], `status` (`draft` | `pending_approval` | `approved` | `partially_received` | `received` | `cancelled`), `expectedDeliveryDate`, `approvedBy`, `approvedAt`, `createdBy`, `estimatedTotalCost`, `cancelReason`, `receipts` [{`receiptId` (client UUID, unique within PO), `receivedAt`, `receivedBy`, `lines` [{`medicineId`, `batchNumber`, `expiryDate`, `manufacturingDate`, `quantity`, `unitCost`, `batchId`}]}], `sourceRecommendationId`, `isDemo`.
Totals are recomputed on the server.

### 6.11 ReorderRecommendation
`medicineId`, `generatedAt`, `inputs` {usableStock, forecastLeadTimeDemand, safetyStock, reorderPoint, incomingConfirmed, outstandingOrders, targetCoverageDays, avgDailyDemand, leadTimeDays, minOrderQty, expiryRiskReduction}, `suggestedQuantity`, `preferredSupplierId`, `estimatedCost`, `reason`, `status` (`pending` | `approved` | `rejected` | `adjusted` | `ordered`), `adjustedQuantity`, `reviewedBy`, `reviewedAt`, `reviewNote`.

### 6.12 Notification
`type` (`low_stock` | `expiring_batch` | `stockout_predicted` | `forecast_ready` | `po_pending` | `system`), `severity` (`info` | `warning` | `critical`), `title`, `message`, `relatedEntityType`, `relatedEntityId`, `dedupeKey`, `isRead`, `readBy`, `resolvedAt`, `createdAt`.
Unique partial index on `dedupeKey` where `resolvedAt` is null (prevents duplicate alerts for the same unresolved condition). Example keys: `LOW_STOCK:<medicineId>`, `EXPIRY:<batchId>:<band>`, `STOCKOUT:<medicineId>`.

### 6.13 AuditLog
`actorId`, `action`, `entityType`, `entityId`, `beforeState`, `afterState`, `reason`, `ip`, `timestamp`. Append-only.

### 6.14 Setting (single document)
`expiryWarningDays` (default 30), `expiryBands` [7,30,60,90], `defaultForecastHorizon` (15), `serviceLevelZ` (1.65), `targetCoverageDays` (30), `minHistoryDaysRandomForest` (60), `minHistoryDaysBaseline` (14), `riskThresholds` {mediumLeftoverPct: 10, highLeftoverPct: 30, criticalLeftoverPct: 60, criticalDaysToExpiry: 14}, `notificationPrefs`, `currency` (default INR or USD), `aiRetrainMinNewDays` (14).

---

## 7. Stock logic (core)

### 7.1 Definitions
- **Usable batch:** `status` is `active`, `currentQuantity > 0`, `expiryDate ≥ startOfToday`, not quarantined.
- **Usable stock of a medicine** = Σ `currentQuantity` over usable batches. Expired quantity is shown separately as "expired stock", never added.
- A batch is considered expired from the start of the day after `expiryDate` (document and implement one consistent rule; recommended: usable through the end of the expiry date).
- No double counting: aggregation must group by batch exactly once.

### 7.2 FEFO allocation (`fefoService.allocate(medicineId, qty)`)
1. Load usable batches for the medicine sorted by `expiryDate` ascending, then `receivedAt` ascending.
2. Walk batches, taking `min(batch.currentQuantity, remaining)` from each.
3. If total usable < qty → reject with `INSUFFICIENT_STOCK` (no partial dispense unless the caller explicitly sets `allowPartial`).
4. Return the allocation plan `[{batchId, quantity}]`. UI shows it as the default suggestion; a manager may choose a different usable batch for a documented reason, but **never an expired batch**.

### 7.3 Transactional operations
Every operation runs in a Mongo session/transaction: (1) re-read batch inside the transaction, (2) validate, (3) update `currentQuantity` with an atomic conditional update (`$inc` with a filter ensuring `currentQuantity >= qty`), (4) insert `StockMovement` with before/after balance, (5) update `status` (`depleted` when 0), (6) insert `AuditLog`, (7) update `DailyUsage` for dispense, (8) commit. If any step fails the whole thing aborts.

Operations:
- **Receive stock** (`POST /api/inventory/receive`): creates a batch (or adds to a batch only via a receipt movement) and a `receipt` movement.
- **Dispense** (`POST /api/inventory/dispense`): accepts `{medicineId, quantity}` and optional explicit allocations; defaults to FEFO; rejects expired batches; creates one `dispense` movement per batch touched.
- **Return** (`POST /api/inventory/return`): `+` movement; reason required; cannot return into an expired batch; cannot exceed the quantity previously dispensed from that batch (track via reference).
- **Adjust** (`POST /api/inventory/adjust`): signed quantity with required reason; result must not be negative; manager+ only.
- **Expiry write-off** (`POST /api/inventory/write-off`): removes remaining quantity of an expired batch; creates `expiry_writeoff` movement; this is the **realized wastage** figure used in reports. Can also run automatically via a daily job (creates movements with `performedBy` = system user).
- **Correction** (`POST /api/stock-movements/:id/correct`): creates a compensating movement with `reversesMovementId` and a mandatory reason. The original is never edited.

### 7.4 Fallback if transactions are unavailable (should not happen on Atlas)
Use conditional atomic updates plus an idempotency key and a recovery job that reconciles `currentQuantity` with the ledger sum. Document this explicitly.

### 7.5 Reconciliation
`GET /api/inventory/reconcile` (admin) compares each batch's `currentQuantity` to `initialQuantity + Σ quantityChange` and reports mismatches.

---

## 8. Business rules (must be enforced server-side)

1. Expired batches are never usable stock, never dispensable, never selectable for dispensing.
2. Dispensing never produces negative quantity.
3. Every stock change has a ledger entry (movement) and an audit entry.
4. Duplicate PO receipts are prevented (`receiptId` idempotency + remaining-quantity checks).
5. All protected routes verify authentication; RBAC is enforced on the backend (hidden buttons are not authorization).
6. Forecasts always carry generation date and model version.
7. Predicted values are labelled as predictions, never as observed facts.
8. Expiry-risk figures are estimates, never guarantees; labelled "Estimated".
9. Financial exposure uses actual `purchaseCostPerUnit` where available; otherwise display "cost unavailable" (do not invent prices).
10. Client input is re-validated on the server; the server recomputes totals, prices and stock; never trust frontend-supplied totals/roles/prices.
11. Errors do not leak stack traces or credentials.
12. Historical movements, forecasts and audit logs are never silently deleted or edited.
13. Medicines/suppliers with history are deactivated, not deleted.
14. AI recommendations are reviewable (approve / reject / adjust) before an order is created.
15. Predicted losses are never labelled as realized losses. Reports separate **Realized wastage (write-offs)** from **Projected expiry exposure**.

---

## 9. AI service specification

### 9.1 Endpoints

**`GET /health`** → `{status, modelLoaded, version}`.

**`GET /model-info`** → active model name/version, trained at, feature list, training window, minimum history requirements, last evaluation metrics.

**`POST /forecast`**
```json
{
  "medicineId": "MED-001",
  "horizonDays": 15,
  "history": [{"date":"2026-01-01","unitsDispensed":12,"stockoutObserved":false}],
  "modelPreference": "auto"
}
```
Response:
```json
{
  "modelName": "random_forest",
  "modelVersion": "rf-2026.10.1",
  "forecast": [{"date":"2026-10-14","predicted":11.4}],
  "totalPredicted": 171.2,
  "metrics": {"mae":0,"rmse":0,"wape":0,"baselineMae":0,"baselineRmse":0,"baselineWape":0,"holdoutDays":0},
  "provisional": false,
  "dataWindow": {"from":"...","to":"...","days":0,"maskedDays":0},
  "warnings": []
}
```
(Metric values shown are shape placeholders; real values come from the evaluation.)

**`POST /evaluate`** — runs chronological holdout evaluation for a medicine's history; returns baseline vs RF metrics.

**`POST /train`** — retrains the global model from supplied multi-medicine history; bumps `modelVersion`; persists with Joblib. Express exposes it as admin-only `POST /api/forecasts/retrain`.

**`POST /expiry-risk`**
```json
{
  "asOfDate": "2026-10-13",
  "windowDays": 90,
  "dailyForecast": [{"date":"2026-10-14","predicted":11.4}],
  "extrapolationDailyDemand": 10.2,
  "batches": [{"batchId":"b1","expiryDate":"2026-11-01","quantity":100,"unitCost":4.5,"receivedAt":"2026-08-01"}],
  "incoming": [{"expectedDate":"2026-10-20","quantity":200,"expiryDate":"2027-04-01"}]
}
```
Response per batch: `expectedConsumed`, `expectedLeftover`, `leftoverPct`, `exposureValue` (null if no cost), `riskLevel`, `reasons[]`, `extrapolated` (bool), `confidence` (`normal` | `low`).

All inputs validated with Pydantic. Handle: insufficient history, invalid horizon (only 7, 15, 30), unexpected failure (clean error JSON, no stack trace), model-load failure (fall back to baseline with warning).

### 9.2 Data preparation
- Build a continuous daily series per medicine; fill missing days with 0 **only where no stockout was observed**.
- **Censored demand:** days with `stockoutObserved=true` are **masked** (excluded from training and evaluation targets), never treated as true zero demand.
- Do not treat every zero-dispensing day as zero demand; intermittent-demand items legitimately have zeros, stockout days do not.

### 9.3 Features (computed using only past data)
`lag_1, lag_2, lag_3, lag_7, lag_14, lag_28`, `roll_mean_7, roll_mean_14, roll_mean_28`, `roll_std_7`, `day_of_week`, `dow_sin`, `dow_cos`, `month`, `day_of_month`, `is_weekend`, `days_since_last_nonzero`, `medicine_scale` (trailing 28-day mean, computed up to the prediction date).
All rolling features use `shift(1)` before the window so the target day is never inside its own features.

### 9.4 Models
1. **Baseline:** moving average (default 7-day window, configurable) projected flat over the horizon.
2. **Random Forest Regressor** (global model across medicines): e.g. `n_estimators=200`, `min_samples_leaf=3`, `random_state=42`. Optionally train on target divided by `medicine_scale` and rescale outputs; document the choice.
3. **Multi-step forecasting:** recursive. Predict day t+1, append the prediction to the history buffer, recompute lag/rolling features, continue. Never use actual future values.

### 9.5 Evaluation
- **Chronological split only** (e.g. last 20% or last max(14, horizon) days as holdout). Never shuffle.
- Optional rolling-origin backtest for robustness.
- Metrics: **MAE**, **RMSE**, **WAPE = Σ|y−ŷ| / Σ|y|** (undefined when Σy = 0 → return null and explain).
- Compare RF against baseline on the same holdout. In `auto` mode choose the lower WAPE (or MAE if WAPE is null). **Do not assume RF wins.**
- Report metrics honestly; never hardcode accuracy percentages.

### 9.6 Minimum history rules
| History (non-masked days) | Behaviour |
|---|---|
| < 14 | Reject with `INSUFFICIENT_HISTORY` (Express shows a clear message) |
| 14–59 | Baseline only, `provisional: true`, warning added |
| ≥ 60 | RF vs baseline comparison, `provisional: false` |
| Mostly zeros / intermittent | Warn "intermittent demand — forecast less reliable" |

Models are persisted with Joblib and **loaded once at startup** (not retrained per request). Retraining is explicit and versioned.

### 9.7 Expiry-risk simulation (`expiry/simulator.py`)
Inputs: batches (usable only), daily forecast, extrapolated daily demand beyond the forecast horizon, incoming confirmed receipts.
Algorithm:
1. Build a day-by-day timeline from `asOfDate` to the latest batch expiry within the window.
2. Demand for day d = forecast value if within horizon, else `extrapolationDailyDemand` (flag affected batches `extrapolated=true`, `confidence=low`). `extrapolationDailyDemand` = mean of the forecast (or trailing 28-day actual mean if no forecast).
3. Maintain a list of stock lots: current batches plus incoming lots that become available on their `expectedDate`.
4. Each day: add arriving lots; remove lots whose expiry date has passed (their remaining quantity is recorded as `leftover` for that lot); allocate that day's demand **FEFO** (earliest expiry first) across available lots, tracking consumption per lot.
5. At each batch's expiry date, `expectedLeftover` = remaining quantity; `expectedConsumed` = quantity − leftover.
6. `leftoverPct = leftover / initialQuantityAtAsOf`.
7. `exposureValue = leftover × purchaseCostPerUnit` (null if cost missing).
8. **Risk level** (thresholds configurable in Settings):
   - Low: leftoverPct < 10%
   - Medium: 10% ≤ leftoverPct < 30%
   - High: 30% ≤ leftoverPct < 60%
   - Critical: leftoverPct ≥ 60%, or (leftoverPct ≥ 30% **and** daysToExpiry ≤ 14)
   Never classify risk from days-to-expiry alone.
9. **Reasons** generated from facts: "Only N days of shelf life remain", "Projected demand (X units) covers only Y% of this batch", "Older batch B-123 is consumed first under FEFO", "Incoming batch arrives on D with later expiry", "Estimate extrapolated beyond forecast horizon — lower confidence".
10. **Suggested actions** (non-clinical): prioritise dispensing this batch, review reorder quantities, check redistribution/return options with supplier, avoid new orders until stock clears.
Worked example (use as a unit test): batch A 100 units expiring in 10 days; forecast demand 3 units/day; no other batches → consumed 30, leftover 70, leftoverPct 70% → Critical.

### 9.8 Stockout prediction (Express `stockoutService`, uses saved forecast)
Inputs per medicine: usable stock (excludes expired), daily forecast, preferred-supplier lead time L, safety stock SS, confirmed incoming POs (approved / partially received) with expected dates and remaining quantities.
1. Simulate stock day by day: `stock_t = stock_{t−1} − demand_t + arrivals_t` (arrivals only from approved/partially-received POs on their expected date; draft/pending orders are **not** counted as confirmed).
2. `daysUntilStockout` = first day where `stock_t ≤ 0` (null if none within horizon; beyond the forecast horizon use extrapolated demand and flag).
3. `leadTimeDemand` = Σ demand over L days.
4. Risk:
   - **Critical:** stockout date < L days and no confirmed arrival before it.
   - **High:** stock projected to fall below safety stock before replenishment arrives.
   - **Medium:** stock covers lead time but ending buffer < safety stock × 1.5.
   - **Low:** otherwise.
5. If forecast is missing/provisional or lead time is unknown, fall back to a transparent rule: `avg 28-day usage × L` and show "Estimated using a rule-based fallback — limited data". Do not show false precision.
6. Output includes explanation text and recommended action ("Reorder now", "Monitor", "Expedite open order PO-…").

### 9.9 Reorder recommendation (Express `reorderService`)
```
avgDailyDemand      = mean of forecast over horizon (or baseline fallback)
leadTimeDemand      = Σ forecast demand over leadTimeDays
safetyStock         = medicine.safetyStock  if set
                    = ceil(z · σ_daily · sqrt(leadTimeDays))  otherwise  (z from Settings, default 1.65)
reorderPoint        = leadTimeDemand + safetyStock
inventoryPosition   = usableStock + confirmedIncoming + outstandingOrders (open, approved, not yet received)
targetStock         = avgDailyDemand × targetCoverageDays + safetyStock
rawOrder            = max(0, targetStock − inventoryPosition)
expiryAdjustment    = min(rawOrder, projected leftover of batches expiring within targetCoverageDays)
adjustedOrder       = max(0, rawOrder − expiryAdjustment)
orderQty            = roundUpToMultiple(max(adjustedOrder, minOrderQty if adjustedOrder>0), minOrderQty)
trigger             = inventoryPosition ≤ reorderPoint
```
- Only generate a recommendation when `trigger` is true.
- Store all inputs and the formula text on the recommendation; the UI shows "Why this quantity?" with these values.
- Users can approve, reject, or adjust; approving creates a **draft** purchase order.
- Estimated cost = orderQty × MedicineSupplier.unitCost (or latest batch cost); if unknown show "cost unavailable".
- Never recommend excessive quantities: cap at `targetStock − inventoryPosition` plus MOQ rounding.

### 9.10 Alert evaluation (honest measurement)
Build a simulated backtest in `evaluation/alert_eval.py`: replay synthetic history with known future; at each checkpoint predict stockout/expiry alerts; compare to what actually occurred; report **precision, recall, F1**. Document results in `docs/ai-evaluation.md` with the caveat that they come from synthetic data.

### 9.11 Synthetic data (reproducible)
Fixed RNG seed. ~30 medicines, ≥ 12 months of daily history, with patterns: stable, gradually increasing, seasonal (e.g. cold/flu antibiotics in winter), intermittent (many zeros), high-demand, low-demand, and some **stockout periods** (usage capped, `stockoutObserved=true`). Multiple batches per medicine with different expiry dates; some already expired; 4–6 suppliers with lead times 3–10 days; purchase orders in all statuses. Output: CSVs in `data/synthetic/` plus the seed script. Mark everything `isDemo=true` and document that results on synthetic data do not prove real-hospital performance.

---

## 10. REST API reference (Express)

**Response envelope**
```json
{ "success": true, "data": {}, "meta": {"page":1,"limit":20,"total":0}, "error": null }
{ "success": false, "data": null, "error": {"code":"VALIDATION_ERROR","message":"…","details":[{"field":"…","message":"…"}]} }
```
Use proper HTTP codes: 200, 201, 400, 401, 403, 404, 409, 422, 429, 500, 503. List endpoints accept `page`, `limit` (max 100), `sort`, `q`, and resource-specific filters.

### Auth
`POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me`, (optional) `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/csrf`.

### Medicines
`GET /api/medicines` (filters: `category`, `status`, `lowStock`), `POST`, `GET /:id`, `PUT /:id`, `PATCH /:id/status` (archive/restore), `GET /:id/batches`, `GET /:id/suppliers`, `PUT /:id/suppliers` (associations).

### Batches
`GET /api/batches` (filters: `medicineId`, `supplierId`, `expiryStatus=expired|expiring|healthy`, `q` for batch number), `POST`, `GET /:id`, `PUT /:id` (metadata only — **not quantity**), `GET /:id/history` (ledger entries).

### Inventory operations
`GET /api/inventory/summary` (usable/expired totals), `POST /receive`, `POST /dispense`, `POST /return`, `POST /adjust`, `POST /write-off`, `GET /fefo-preview?medicineId=&quantity=`, `GET /reconcile`.

### Stock movements
`GET /api/stock-movements` (filters: `medicineId`, `batchId`, `type`, `userId`, `from`, `to`, `q`), `GET /export` (CSV), `POST /:id/correct`.

### Suppliers
`GET`, `POST`, `GET /:id`, `PUT /:id`, `PATCH /:id/status`, `GET /:id/batches`, `GET /:id/purchase-orders`.

### Purchase orders
`GET`, `POST` (draft), `GET /:id`, `PUT /:id` (draft only), `POST /:id/submit`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/receive` (body: `receiptId`, `lines`), `POST /:id/cancel` (reason required).

### Forecasts
`POST /api/forecasts/generate` `{medicineId, horizonDays}`, `GET /api/forecasts?medicineId=`, `GET /:id`, `GET /api/forecasts/usage/:medicineId?from=&to=` (history for the chart), `POST /refresh-usage`, `POST /retrain` (admin), `GET /model-info`, `GET /health`.

### Intelligence
`GET /api/expiry-risk?windowDays=30&medicineId=&riskLevel=`, `GET /api/expiry-risk/batch/:batchId`, `GET /api/stockout-predictions`, `GET /api/reorders`, `POST /api/reorders/generate`, `POST /api/reorders/:id/approve`, `POST /:id/reject`, `POST /:id/adjust` `{quantity, note}`.

### Reports
`GET /api/reports/consumption`, `/stock-movements`, `/wastage` (realized), `/expiry-exposure` (projected), `/stockouts`, `/purchases`, `/valuation`, `/forecast-performance`, `/reorders` — all accept `from`, `to`, `medicineId`, and `?format=csv`.

### Notifications
`GET /api/notifications` (filters: `type`, `severity`, `isRead`), `PATCH /:id/read`, `POST /mark-all-read`, `GET /unread-count`.

### Users and settings
`GET/POST /api/users`, `PUT /api/users/:id`, `PATCH /:id/role`, `PATCH /:id/status`, `POST /:id/reset-password`; `GET/PUT /api/settings`; `POST /api/settings/import/preview`, `POST /import/commit`, `GET /api/settings/templates/:name` (sample CSVs); `GET /api/audit-logs` (admin).

### Dashboard
`GET /api/dashboard/summary` returns KPIs (Section 12, Screen 2) plus chart series, recent movements, critical alerts, upcoming expiries, medicines needing replenishment, and forecast-vs-actual overview if forecasts exist.

---

## 11. Role-based access control

| Capability | Admin | Inventory Manager | Staff |
|---|:--:|:--:|:--:|
| Login, view dashboard | ✔ | ✔ | ✔ |
| View medicines, batches, movements | ✔ | ✔ | ✔ |
| Create/edit/archive medicines | ✔ | ✔ | ✖ |
| Create batches / receive stock | ✔ | ✔ | ✖ |
| **Dispense stock** (FEFO) | ✔ | ✔ | ✔ |
| Record returns | ✔ | ✔ | ✔ (reason required) |
| Adjustments, write-offs, corrections | ✔ | ✔ | ✖ |
| View expiry risk, stockout predictions | ✔ | ✔ | ✔ (read-only) |
| Generate forecasts, view forecasting | ✔ | ✔ | ✖ |
| Retrain model | ✔ | ✖ | ✖ |
| View/approve/reject/adjust reorder recommendations | ✔ | ✔ | ✖ |
| Create/approve/receive/cancel purchase orders | ✔ | ✔ | ✖ |
| Manage suppliers | ✔ | ✔ | ✖ |
| Reports and CSV export | ✔ | ✔ | ✖ (basic movement view only) |
| Notifications (view/mark read) | ✔ | ✔ | ✔ (relevant to them) |
| CSV import | ✔ | ✔ | ✖ |
| User and role management | ✔ | ✖ | ✖ |
| System settings | ✔ | ✖ | ✖ |
| Audit log | ✔ | ✖ | ✖ |

Implementation: `authenticate` middleware → `authorize(...roles)` middleware per route; frontend uses `RoleRoute` and hides unavailable actions **in addition to** the backend enforcement. Prevent an admin from demoting/deactivating the last active admin. Log role changes in the audit trail.

---

## 12. UI design system

### Theme
| Token | Value |
|---|---|
| Navy (sidebar) | `#0B2A5B` → gradient to `#061B3F` |
| Primary blue | `#1F6FEB` (hover `#165BB5`) |
| Background | `#F3F7FC` (cards white `#FFFFFF`) |
| Border | `#E1E9F4` |
| Text | `#1E293B` (muted `#64748B`) |
| Success | `#16A34A` (pill bg `#DCFCE7`) |
| Warning | `#F59E0B` (pill bg `#FEF3C7`, text `#B45309`) |
| Critical | `#DC2626` (pill bg `#FEE2E2`, text `#B91C1C`) |
| Info | `#1D4ED8` (pill bg `#DBEAFE`) |

Font: Inter or similar clean sans-serif. Cards: white, 12px radius, subtle shadow (`0 1px 3px rgba(11,31,58,.06)`). Pills: 6px radius, 12px semibold text. Consistent 16–28px spacing scale. Do not use different designs per page.

### Layout
- Left **sidebar** (220px, navy gradient): logo mark + "MedStock AI", then items with Lucide icons: Dashboard, Medicines, Batches & Inventory, Expiry Risk, AI Forecasting, Stockout Predictions, Reorder Recommendations, Stock Movements, Suppliers & Orders, Reports, Notifications, User Management (+ Settings). Active item: blue highlight.
- **Topbar:** global search ("Search medicines, batches…"), notification bell with unread badge, user menu (avatar + "Admin ▾": profile, logout).
- **Main:** page header (title, subtitle, primary action on the right), content cards.
- **Responsive:** sidebar collapses into a drawer below `lg`; tables scroll horizontally; KPI rows wrap.
- Reference image: `docs/ui-reference.png` (12 screens). Match its look and feel.

### Reusable components
Sidebar, Topbar, PageHeader, KpiCard, DataTable (search, sort, filter, pagination), Pagination, StatusBadge, DateRangeFilter, ConfirmDialog, Modal, FormField controls, Toast, Skeleton, EmptyState, ErrorState, ChartCard, AlertPanel, ProgressBar, Tabs, FileDropzone.

### State rules for every screen
Loading → skeleton. No data → EmptyState with helpful action. Error → ErrorState with retry. Validation → inline messages. Success/failure of mutations → toast. Destructive actions → ConfirmDialog.

### Data-honesty rules for UI
- Never display hardcoded predictions as model output. During Phase 2 only, mock data may be used and must carry a visible "Demonstration data" banner; remove it as screens connect to the API.
- Forecast screens always show model name, version and generated-at.
- Expiry-risk screens always say "Estimated — based on forecasts and assumptions, not guaranteed."
- Seeded data is labelled demo.

---

## 13. Screens (what each shows, how it works)

### Screen 1 — Login `/login`
Split layout. Left: logo "MedStock AI — Smart Inventory & Expiry Predictor", "Welcome back! Please sign in to your account.", email field, password field with show/hide, "Remember me", "Forgot password?" link, **Sign in** button, "Don't have an account? Contact administrator". Right: light-blue gradient panel with the tagline "Smarter Inventory. Healthier Tomorrow." and a medicine-bottle illustration.
Behaviour: React Hook Form + Zod validation; calls `POST /api/auth/login`; on success loads `/api/auth/me` and redirects to `/dashboard` (or the originally requested route); generic error for bad credentials; lockout/rate-limit message on 429; redirect already-authenticated users away. Logout clears cookies server-side. Protected routes redirect to `/login`.

### Screen 2 — Dashboard `/dashboard`
Header "Dashboard — Inventory overview and key insights".
- **KPI cards:** Total active medicines; Total usable stock units; Medicines below reorder level; Batches expiring within the warning period; Medicines with predicted stockout risk; Estimated quantity at expiry risk. Each can show a change vs last month where computable.
- **Inventory Health:** progress bars (healthy stock % vs expiry-risk %).
- **Stock Overview:** area/line chart (Recharts) of total stock vs used stock over time.
- **Recent stock movements** table (date, medicine, type pill, quantity, user).
- **Critical alerts** panel (red tint) from unresolved critical notifications.
- **Upcoming expiries** and **Medicines requiring replenishment** lists.
- **Actual vs predicted demand** overview (only if forecasts exist; otherwise EmptyState "No forecasts yet — generate one").
- **Quick actions:** Add medicine, Receive stock, Generate forecast, View reports.
All numbers come from `GET /api/dashboard/summary`; expired stock is excluded from usable totals; no double counting.

### Screen 3 — Medicine Catalogue `/medicines`
Table: Name, Category, Unit, Total (usable) Stock, Reorder Level, Status pill (Healthy / Low Stock / Inactive), Actions (view, edit, archive). Search by name/code; filters: category, status; sorting; pagination. **+ Add Medicine** opens a form (name, code, category, unit, description, reorder level, safety stock, active). Duplicate code → inline 409 error. Row click opens a details drawer with batches, supplier associations, latest forecast, recent movements. Archive uses ConfirmDialog; never hard-delete.

### Screen 4 — Batch and Inventory `/inventory`
Filters: medicine, supplier, expiry status (expired/expiring/healthy), batch-number search. Table: Medicine, Batch No., Quantity, Expiry Date, Supplier, Status pill (Healthy / Expiring Soon / Expired / Depleted), Actions. **+ Add Batch** form (medicine, supplier, batch number, mfg date, expiry date, quantity, unit cost, received date). Row actions: Receive, Dispense, Return, Adjust, View history. Tabs/section: "Usable stock" vs "Expired stock". **Dispense dialog** shows the FEFO plan before confirming; expired batches are disabled with a tooltip. Batch history drawer lists ledger entries with before/after balances.

### Screen 5 — Expiry Risk `/expiry-risk`
Tabs 7 / 30 / 60 / 90 days (+ Export). Table: Medicine, Batch No., Expiry Date, Days Left, Quantity, **Estimated leftover**, Leftover %, Risk Level pill (Low/Medium/High/Critical), Action. Expandable row or side panel: "Why flagged" (reasons list), assumptions, suggested actions, confidence note. Bottom cards: **Estimated wastage (next 30 days)** units and **Estimated value at risk** (only when cost data exists). Footnote: estimates are projections, not guarantees. Backend calls FastAPI `/expiry-risk` per medicine using the latest saved forecast.

### Screen 6 — AI Demand Forecasting `/forecasting`
Controls: medicine select, horizon (7 / 15 / 30), **Generate Forecast** button. Panels:
- **Demand Forecast chart:** historical actuals (solid), predicted (dashed/colored), optional uncertainty band if available; masked stockout days marked.
- **Daily predicted quantities** table and **total predicted demand**.
- **Model Performance:** MAE, RMSE, WAPE (with tooltips explaining each), baseline comparison, holdout size.
- **Model info:** model name, version, training data range, generated-at, provisional badge when applicable.
- **Forecast history:** list of previous forecasts for the medicine (open to view).
Behaviour: Generate → `POST /api/forecasts/generate` → Express loads DailyUsage → FastAPI `/forecast` → saves Forecast → UI renders. Handles insufficient-history and AI-down states with clear messages. Retrain button for admins.

### Screen 7 — Stockout Prediction `/stockout-predictions`
Table: Medicine, Current usable stock, Predicted demand over lead time, Lead time, Days until stockout (or "Not estimable" with explanation), Incoming POs, Risk pill, Explanation, Action (Reorder / Monitor / Expedite). Sorted by risk. Row expands to show the day-by-day projection chart and inputs. Fallback-rule badge when data is limited.

### Screen 8 — Reorder Recommendations `/reorders`
Table: Medicine, Current usable stock, Lead-time demand, Safety stock, Reorder point, Incoming stock, Suggested order, Preferred supplier, Lead time, Estimated cost, Reason, Actions (**Approve**, **Adjust**, **Reject**, **Create PO**). "Why this quantity?" popover shows the formula and inputs (Section 9.9). Summary cards: Total suggested units, Estimated cost. Approve creates a draft PO; Adjust lets the user change quantity with a note; Reject requires a reason. All actions audited.

### Screen 9 — Stock Movement History `/stock-movements`
Search by medicine/batch/reason; filters: medicine, batch, type, user, date range; table: Date, Medicine, Batch No., Type pill (Dispensed/Received/Adjusted/Returned/Written off/Correction), Quantity (+/−), Balance after, Reason, User. **Export CSV** exports the filtered set. Correction action (manager+) opens a dialog requiring a reason and creates a compensating entry. No edit/delete controls anywhere.

### Screen 10 — Supplier Management `/suppliers`
Table: Supplier, Contact Person, Phone, Email, Lead Time, Status. **+ Add Supplier** form with validation (email, phone) and duplicate warning. Detail drawer: associated medicines (lead time, MOQ, unit cost, preferred flag), batches supplied, purchase orders. Activate/deactivate toggle.

### Screen 11 — Purchase Orders `/purchase-orders`
Table: PO No., Supplier, Order Date, Expected Delivery, Items, Estimated Cost, Status pill (Draft/Pending approval/Approved/Partially received/Received/Cancelled), Actions. **+ Create PO** (select supplier, add medicine lines with quantities; cost computed server-side). Detail view: lines with ordered vs received quantities, receipt history, approval trail. Actions by status: submit, approve/reject (manager+), **Receive stock** (enter batch number, expiry, quantity per line; supports partial; sends a `receiptId`), cancel (reason required). Receiving creates batches and `receipt` movements in one transaction and updates outstanding quantities; resubmitting the same `receiptId` is a no-op that returns the original result.

### Screen 12 — Reports and Analytics `/reports`
Date-range filter and report selector: consumption trends, movement summary, **realized wastage** (write-offs) vs **projected expiry exposure** (clearly separated and labelled), stockout incidents, purchase history, stock valuation (when costs exist), forecast performance, reorder recommendations. Each has a chart + table + short explanation + **Export CSV**.

### Screen 13 — Notifications `/notifications`
List with icon, title, message, severity pill, timestamp, read/unread state, link to the related medicine/batch/order. Filters: category, severity, read state. Mark read / mark all read. Bell dropdown in the topbar shows the latest few. Alerts are deduplicated (Section 14).

### Screen 14 — User and Role Management `/users` (admin)
Table: Name, Email, Role, Status, Last login. Create/edit user, change role, activate/deactivate, reset password. Guards: cannot remove the last admin; actions audited. Includes an audit-log tab (filter by actor/entity/date).

### Screen 15 — Settings and Data Import `/settings`
Tabs: **General**, **Forecasting** (default horizon, min history, retrain), **Alerts** (expiry warning days, risk thresholds, notification prefs), **Inventory defaults** (target coverage days, service level z, currency), **Data Import**, **Model Settings** (model info, retrain).
**Data Import flow:** choose dataset type (medicines / batches / daily usage) → upload CSV (drag-and-drop) → column mapping → server-side validation of the whole file → **preview** with accepted/rejected rows and per-row errors → **commit** only if the user confirms → summary (accepted, rejected, skipped counts). Handles malformed dates, missing columns, invalid quantities, duplicate identifiers, unknown medicine references. Downloadable sample templates. If any critical error exists, nothing is partially applied silently; the summary always states exactly which records succeeded and failed.

Also provide: 404 page, 403 "not authorized" page, and a profile menu.

---

## 14. Alerts and notification rules

Generated by `jobs/alertJob.js` (node-cron or on-demand endpoint) and after relevant operations:
- **Low stock:** usable stock ≤ `reorderLevel` → `LOW_STOCK:<medicineId>`.
- **Expiring batch:** within `expiryWarningDays` (bands 7/30/60/90) with quantity > 0 → `EXPIRY:<batchId>:<band>`; severity escalates as the band tightens.
- **Predicted stockout:** risk High/Critical → `STOCKOUT:<medicineId>`.
- **Forecast ready:** after a successful generate.
- **PO pending approval** and **PO overdue**.
Dedupe via `dedupeKey` (do not create a new alert while an unresolved one exists). Auto-resolve when the condition clears (e.g., stock replenished). Never spam duplicates.

---

## 15. End-to-end workflows

1. **Onboard data:** admin signs in → imports medicines/batches/usage via CSV (or runs the seed) → verifies in catalogue.
2. **Daily dispensing:** staff opens Inventory → Dispense → enters quantity → sees FEFO plan → confirms → batch quantity decreases, ledger + DailyUsage updated, low-stock alert evaluated.
3. **Forecast:** manager opens Forecasting → selects medicine + horizon → Generate → Express → FastAPI → result saved and displayed with metrics → "forecast ready" notification.
4. **Expiry review:** manager opens Expiry Risk → picks window → reviews high/critical batches, reads reasons → acts (prioritise dispensing, adjust orders, redistribute).
5. **Replenishment:** manager opens Reorders → reviews recommendations → approves/adjusts/rejects → draft PO created → submits → approved → supplier delivers → **Receive stock** (batch numbers/expiry/quantities, partial allowed) → batches + movements created → outstanding quantities updated → alerts auto-resolve.
6. **Write-off:** expired batches with remaining stock → manager records write-off with reason → appears as realized wastage in reports.
7. **Audit:** admin reviews audit log and movement ledger; corrections done by compensating entries.

---

## 16. CSV templates (`data/templates/`)

**medicines.csv** — `medicineCode,name,category,unit,description,reorderLevel,safetyStock,isActive`
**batches.csv** — `medicineCode,supplierName,batchNumber,manufacturingDate,expiryDate,quantity,purchaseCostPerUnit,receivedAt`
**daily_usage.csv** — `medicineCode,date,unitsDispensed,stockoutObserved`

Date format: `YYYY-MM-DD` (ISO). Booleans: `true/false`. Document these in the README and in the import screen. Reject unknown `medicineCode`, negative quantities, `expiryDate` before `manufacturingDate`, and duplicate keys (report them; do not silently skip).

---

## 17. Seed data (`npm run seed`, idempotent)

Detect existing seeded records (by `isDemo` + codes) and skip or upsert safely; provide `--reset-demo` to remove only demo data. Create: 1 admin, 1 manager, 1 staff (print the demo credentials in the console and README; mark as demo and instruct changing them); 30 medicines across categories; 4–6 suppliers with different lead times; MedicineSupplier links; 2–4 batches per medicine with varied expiry dates (including some expiring soon and a few already expired); opening receipts and a few months of movements consistent with batch quantities; ≥ 12 months of DailyUsage; some low-stock cases and some deliberate expiry-risk cases; POs in every status; a few notifications. After seeding, run reconciliation to confirm ledger and batch balances match.

---

## 18. Testing plan

**Backend (Jest/Vitest + Supertest):** medicine create + duplicate code; batch create + expiry validation; receive; dispense; negative-stock prevention; expired-batch dispense blocked; FEFO allocation across batches; ledger entry created with correct before/after; PO receive creates batches + movements; duplicate `receiptId` is idempotent; partial receipts update outstanding correctly; auth required; RBAC for each role on sensitive routes; CSRF check; reorder calculation against hand-checked examples; stockout calculation with and without incoming POs; import validation; reconciliation.

**AI (pytest):** request validation; insufficient history → error; 14–59 days → baseline + provisional; zero-demand series; intermittent series; variable series; invalid horizon rejected; chronological split correctness; **no leakage** (features for day t never use data at or after t; test by perturbing future values and asserting unchanged predictions); stockout days masked; model save/load round trip; expiry-risk simulation multi-batch FEFO, worked example (100 units / 3 per day / 10 days → leftover 70); simulation with incoming lot; extrapolation flag; stockout estimate with/without incoming.

**Frontend (Vitest + RTL):** login form validation and error state; protected route redirect; role-based route guard; medicine form validation and duplicate error; dispense dialog shows FEFO plan and blocks expired; API error and empty states render; navigation between screens.

**Manual acceptance checklist:** adding a medicine updates the catalogue; receiving stock updates inventory and movement history; dispensing updates the correct batch and ledger; expiry alerts match real batch dates; forecasts call the real AI service; saved forecasts can be retrieved; reorder recommendations use current inventory and forecasts; receiving a PO creates stock records; dashboard numbers match stored data; CSV exports match the filtered table.

---

## 19. Phase-wise workflow

Each phase ends with: working code, documented run commands, passing tests, and a short report. Do not start the next phase until the current one is verified.

### Phase 1 — Requirements and architecture
- Confirm this document; produce ER overview, route map, API contract (`docs/api-contract.md`), assumptions and risks.
- **Deliverable:** docs only. **Done when:** contract between Express and FastAPI is written and agreed.

### Phase 2 — Frontend foundation
- Vite + React + Tailwind v3 setup; install Router, Axios, Recharts, Lucide, RHF, Zod.
- Tailwind theme tokens (Section 12); global styles and font.
- Routing (public + protected + role routes), AppLayout (sidebar, topbar, mobile drawer), PageHeader.
- Reusable common components (Section 4/12).
- Login page; Dashboard with **clearly labelled demonstration data**.
- **Done when:** all routes render with placeholder pages sharing the layout; responsive; no console errors.

### Phase 3 — Inventory backend
- Express app structure, env config, logger, error handler, MongoDB Atlas connection.
- Models (Section 6), indexes, validators.
- Auth (login/refresh/logout/me, CSRF, rate limiting, RBAC middleware).
- Medicines CRUD, suppliers CRUD (+ medicine–supplier association), batches, inventory operations with transactions, stock-movement ledger, audit log, settings.
- Seed script (users + core demo data).
- Tests for Section 18 backend items on stock logic and auth.
- **Done when:** all endpoints work in Postman, tests pass, ledger reconciles.

### Phase 4 — Inventory frontend integration
- Axios instance (`withCredentials`, CSRF header), AuthContext, ProtectedRoute/RoleRoute.
- Connect Medicines, Inventory (batches + operations + FEFO dialog), Stock Movements (+ CSV export), Suppliers.
- Remove mock data from connected screens; add loading/empty/error states, forms, filters, pagination.
- **Done when:** manual acceptance items for catalogue/receive/dispense/ledger pass.

### Phase 5 — AI service
- Synthetic data generator (reproducible), data prep with masking, features, baseline, Random Forest, recursive forecasting, chronological evaluation, metrics, Joblib persistence, FastAPI endpoints (`/health`, `/model-info`, `/forecast`, `/evaluate`, `/train`), Pydantic schemas.
- Train and persist an initial model; document metrics honestly in `docs/ai-evaluation.md`.
- pytest suite (leakage, history rules, persistence).
- **Done when:** `/forecast` returns real predictions from the saved model and metrics compare RF vs baseline.

### Phase 6 — Inventory intelligence
- Express `aiClient` (timeouts, errors, retries), DailyUsage aggregation, forecast generation + persistence endpoints.
- Expiry-risk (FastAPI simulator + Express orchestration), stockout service, reorder service, alert job and notifications with dedupe.
- Frontend: Forecasting, Expiry Risk, Stockout, Reorders screens connected.
- Backtest alert evaluation (precision/recall/F1) documented.
- **Done when:** calculations match hand-checked examples; screens show real data and explanations.

### Phase 7 — Remaining screens
- Purchase orders (full lifecycle, receive with idempotency), Reports (+ CSV), Notifications screen + bell, Users and roles, audit log view, Settings, CSV import with preview/commit.
- **Done when:** all 15 screens are functional and RBAC verified per role.

### Phase 8 — Integration and quality assurance
- End-to-end run-through of Section 15 workflows; responsive pass; error handling pass; security checklist (Section 20); complete test suites; seed finalization; README with setup, demo workflow, limitations; AI evaluation write-up.
- **Done when:** acceptance criteria (Section 21) are all met.

### Dependency graph
```
P1 → P2 ─────────────┐
P1 → P3 → P4 ────────┼→ P6 → P7 → P8
P1 → P5 ─────────────┘
```
Recommended order for a single developer: P1, P2, P3, P4, P5, P6, P7, P8.

---

## 20. Security checklist

- bcrypt (cost ≥ 12); never log or return passwords/hashes.
- HTTP-only, Secure, SameSite cookies; CSRF double-submit; strict CORS origin.
- helmet, rate limiting (global + stricter on auth), request size limits.
- Server-side validation on every endpoint; sanitize inputs (e.g., strip `$`/`.` operators to prevent NoSQL injection — use express-mongo-sanitize or schema validation).
- Authorization checks inside services for sensitive operations, not only at the route level.
- No stack traces or internals in client errors; centralized error handler; structured logs without secrets.
- File upload (CSV) limits: size cap, MIME/extension check, parse safely, never execute content.
- Secrets only in `.env`; `.env` in `.gitignore`; `.env.example` committed.
- Audit log for admin and stock actions; append-only.
- Dependency hygiene: pin versions, run `npm audit` and `pip-audit` periodically.
- Atlas: restricted network access, least-privilege DB user.

---

## 21. Definition of done (acceptance criteria)

- All 15 screens implemented, responsive, consistent with the design system and the 12-screen reference.
- React ↔ Express ↔ MongoDB ↔ FastAPI all working with documented commands.
- Medicines/batches managed; ledger balances reconcile with batch quantities.
- FEFO enforced; expired stock excluded; negative stock impossible; duplicate receipts impossible.
- Real demand forecasts from a trained model; RF vs baseline metrics reported honestly (MAE, RMSE, WAPE).
- Expiry risk computed per batch with FEFO simulation and explanations.
- Stockout predictions use demand, lead time, safety stock, incoming confirmed orders; fallback clearly labelled.
- Reorder recommendations are explainable and reviewable; approve → draft PO; PO receiving creates batches + movements.
- Dashboard metrics derive from stored data; no hardcoded predictions in the UI.
- RBAC enforced on the backend for all three roles.
- Automated tests exist for core business logic (backend, AI, key frontend flows).
- README documents setup, demo workflow, synthetic-data disclosure and AI limitations.

---

## 22. Limitations and disclosures (include in README and UI where relevant)

- Developed and demonstrated on **synthetic data**; performance on it does not prove real-world performance.
- Forecasts and expiry/stockout estimates are probabilistic projections based on assumptions; they are not guarantees.
- Demand may be understated when a medicine was out of stock; stockout days are masked rather than treated as zero demand, but data quality still limits accuracy.
- Beyond the forecast horizon (max 30 days) expiry estimates use extrapolation and are marked lower confidence.
- The system supports inventory decisions only; it does not make clinical decisions or replace professional judgement or regulatory compliance.
- Wastage-reduction claims are not made unless measured in a valid evaluation.

---

## Appendix A — Example payloads

**Dispense request**
```json
POST /api/inventory/dispense
{ "medicineId": "665f...", "quantity": 40, "note": "Ward 3 requisition" }
```
**Response (FEFO allocation applied)**
```json
{ "success": true, "data": { "allocations": [
  {"batchId":"b1","batchNumber":"B002","quantity":25,"balanceAfter":0},
  {"batchId":"b2","batchNumber":"B007","quantity":15,"balanceAfter":85}
]}}
```

**Receive PO stock**
```json
POST /api/purchase-orders/:id/receive
{ "receiptId": "2d0f9c0e-6f4b-4f43-9a1e-0c1e6b1a1111",
  "lines": [{"medicineId":"665f...","batchNumber":"B115","manufacturingDate":"2026-08-01","expiryDate":"2028-07-31","quantity":300,"unitCost":4.5}] }
```

**Reorder recommendation (shape)**
```json
{ "medicineId":"665f...", "inputs":{"usableStock":120,"forecastLeadTimeDemand":98,"safetyStock":30,"reorderPoint":128,"incomingConfirmed":0,"outstandingOrders":0,"targetCoverageDays":30,"avgDailyDemand":14,"leadTimeDays":7,"minOrderQty":50,"expiryRiskReduction":0},
  "suggestedQuantity":350, "reason":"Inventory position (120) is below reorder point (128). Target stock = 14×30+30 = 450; order = 450−120 = 330, rounded up to MOQ 50 → 350." }
```
(Numbers illustrate the structure and arithmetic only.)

## Appendix B — Glossary
**FEFO:** First-Expiry-First-Out. **WAPE:** weighted absolute percentage error. **MAE/RMSE:** mean absolute / root-mean-square error. **Safety stock:** buffer against demand/lead-time variability. **Reorder point:** stock level that triggers replenishment. **Inventory position:** usable + confirmed incoming + outstanding orders. **Censored demand:** observed sales understated because of stockout. **Leakage:** using information unavailable at prediction time.
