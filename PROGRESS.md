# MedStock AI — Session Handoff & Progress Report

**Current Local Time:** 2026-10-14T01:54:13+05:30  
**Repository Path:** `c:\Users\sbhoe\OneDrive\Desktop\FAI project`  

---

## 1. Phases Status

- **Phase 1 (Requirements and Architecture):** ✅ **Completed**
- **Phase 2 (Frontend Foundation):** ✅ **Completed**
- **Phase 3 (Inventory Backend):** ⏳ **Not Started**

---

## 2. What Exists Now

### 2.1 Files and Folder Structure
- **Root:**
  - `MedStock_AI_Project_Spec.md` (canonical specification)
  - `README.md` (overview, phase tracking, run instructions)
  - `PROGRESS.md` (this handoff file)
  - `.gitignore` (node_modules, .env, venvs, build artifacts)
- **`docs/`:**
  - `api-contract.md` (complete request/response shapes for all Express routes and FastAPI endpoints, error envelope, assumptions, and risks)
  - `ui-reference.webp` (the 12-screen reference graphic)
- **`data/`:**
  - `templates/medicines.csv`, `templates/batches.csv`, `templates/daily_usage.csv`
  - `synthetic/.gitkeep`
- **`server/`:**
  - `.env.example`
  - Directory placeholders (`src/.gitkeep`, `tests/.gitkeep`)
- **`ai-service/`:**
  - `.env.example`
  - Directory placeholders (`app/.gitkeep`, `trained_models/.gitkeep`, `tests/.gitkeep`)
- **`client/`:**
  - `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.env.example`, `.env`
  - `src/` (details below)

### 2.2 Client Components & Shared Layout
- **Design System Tokens (`client/tailwind.config.js` & `client/src/index.css`):**
  - Navy gradient (`#0B2A5B` to `#061B3F`), brand blue (`#1F6FEB`), background (`#F3F7FC`), status pills, Inter typography.
- **Reusable Components (`client/src/components/common/`):**
  - `Button.jsx`, `Input.jsx`, `Select.jsx`, `Badge.jsx` (StatusBadge), `KpiCard.jsx`, `ChartCard.jsx`, `AlertPanel.jsx`, `ProgressBar.jsx`, `Tabs.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`, `Toast.jsx`, `Skeleton.jsx`, `EmptyState.jsx`, `ErrorState.jsx`, `Pagination.jsx`, `DataTable.jsx`, `DateRangeFilter.jsx`.
- **Layout (`client/src/components/layout/`):**
  - `AppLayout.jsx` (main wrapper)
  - `Sidebar.jsx` (230px navy gradient, medical logo, active route highlighting, AI status indicator)
  - `Topbar.jsx` (global search, notifications icon, user profile dropdown)
  - `MobileDrawer.jsx` (collapsible drawer for `< lg` screens)
  - `PageHeader.jsx` (title, subtitle, action buttons)
- **State, Hooks & Utilities:**
  - `AuthContext.jsx`, `ToastContext.jsx`
  - `useAuth.js`, `useToast.js`, `useDebounce.js`, `usePagination.js`
  - `api.js` (Axios instance configured with `withCredentials: true` and CSRF header handling)
  - `authService.js`
  - `formatDate.js`, `formatNumber.js`, `constants.js`

### 2.3 Routes & Screens (Real vs. Placeholders)
Defined in `client/src/routes/AppRoutes.jsx` protected by `ProtectedRoute.jsx` and `RoleRoute.jsx`:

| Screen # | Route | Component | Status | Description |
|---|---|---|:---:|---|
| **01** | `/login` | `LoginPage.jsx` | **Real** | Split-layout with React Hook Form, Zod schema validation, password visibility toggle, and 1-click demo credential fill buttons. |
| **02** | `/dashboard` | `DashboardPage.jsx` | **Real (with mock data)** | Full dashboard with visible **"Demonstration data"** banner, 4 KPI cards, Inventory Health progress bars, Recharts area chart, recent movements table, and critical alerts panel. |
| **03** | `/medicines` | `MedicinesPage.jsx` | *Functional Placeholder* | Styled table with search, category/status filters, and action buttons. |
| **04** | `/inventory` | `InventoryPage.jsx` | *Functional Placeholder* | Batch tracking with Usable vs. Expired tabs and filters. |
| **05** | `/expiry-risk` | `ExpiryRiskPage.jsx` | *Functional Placeholder* | 7/30/60/90 day tabs, risk level pills, wastage & cost cards. |
| **06** | `/forecasting` | `ForecastingPage.jsx` | *Functional Placeholder* | Line chart (actual vs. predicted), MAE/RMSE/WAPE cards, horizon selector. |
| **07** | `/stockout-predictions` | `StockoutPage.jsx` | *Functional Placeholder* | Depletion estimates, priority pills, and reorder trigger action. |
| **08** | `/reorders` | `ReordersPage.jsx` | *Functional Placeholder* | Reorder table, suggested order units, estimated cost cards. |
| **09** | `/stock-movements` | `StockMovementsPage.jsx` | *Functional Placeholder* | Movement ledger view with type pills (+/- quantities) and date range. |
| **10** | `/suppliers` | `SuppliersPage.jsx` | *Functional Placeholder* | Supplier directory with lead times and status pills. |
| **11** | `/purchase-orders` | `PurchaseOrdersPage.jsx` | *Functional Placeholder* | PO lifecycle table with status pills and actions. |
| **12** | `/reports` | `ReportsPage.jsx` | *Functional Placeholder* | Report type tabs, realized write-off vs. projected exposure cards. |
| **13** | `/notifications` | `NotificationsPage.jsx` | *Functional Placeholder* | Alert list with severity pills, unread indicators, mark-read action. |
| **14** | `/users` | `UsersPage.jsx` | *Functional Placeholder* | Role management table (admin-only route guard). |
| **15** | `/settings` | `SettingsPage.jsx` | *Functional Placeholder* | Tabs for General, Alerts, Forecasting, and CSV file dropzone preview tool. |
| — | `/forbidden` | `ForbiddenPage.jsx` | **Real** | 403 access restricted error view. |
| — | `*` | `NotFoundPage.jsx` | **Real** | 404 page with return to dashboard action. |

---

## 3. How to Run the Client

### Exact Commands
```bash
# From workspace root
cd client

# Install packages (if not already present)
npm install

# Start Vite dev server on port 5173
npm run dev -- --port 5173

# Or compile production build to test bundle
npm run build
```

### Environment Configuration
- `client/.env` and `client/.env.example` both contain:
  ```env
  VITE_API_BASE_URL=http://localhost:5000/api
  ```
- No other environment variables are required to run the client.

### Demo Login Credentials
Click any of the quick-fill buttons on `/login` or enter:
- **Admin:** `admin@medstock.local` / `password123`
- **Manager:** `manager@medstock.local` / `password123`
- **Staff:** `staff@medstock.local` / `password123`

---

## 4. Decisions & Differences from Specification

1. **UI Reference File Format:**
   - The spec mentions `docs/ui-reference.png`. The actual repository file present in the directory is `docs/ui-reference.webp`. All UI styling, layout hierarchy, and color palettes were matched to `docs/ui-reference.webp`.
2. **Library Versions:**
   - Tailwind CSS pinned to v3 (`tailwindcss@^3.4.19` with `postcss` & `autoprefixer`) per spec Section 2.
   - Vite 8 (`vite@^8.3.4`) and React 19 (`react@^19.2.8`).
   - Clean ES modules JavaScript throughout (no TypeScript, per Section 0 Rule 4).
3. **Demo Session Bridge (Phase 2):**
   - Because the Express backend is not yet running in Phase 2, `authService.js` and `AuthContext.jsx` include a network fallback that saves a mock session to `localStorage` upon login. This allows the reviewer to authenticate, test role guards, and inspect all 15 screens without requiring a running backend.

---

## 5. Mock Data to Replace Later

1. **Dashboard (`DashboardPage.jsx`):**
   - Prominently displays the required `"Demonstration data"` warning banner.
   - `mockStockOverview`: Recharts series for total stock vs. used stock.
   - `mockRecentMovements`: Recent ledger movement entries.
   - `mockCriticalAlerts`: Unresolved alert cards.
   - Top 4 KPI numbers (248 medicines, 12,840 units, 12 low stock, 8 expiry alerts) and health progress percentages (77% / 23%).
2. **Placeholder Screens (Screens 3–15):**
   - In-memory mock arrays in each page component (`mockMedicines`, `mockBatches`, `mockRiskBatches`, `mockForecastTimeline`, `mockStockouts`, `mockReorders`, `mockMovements`, `mockSuppliers`, `mockOrders`, `mockNotifications`, `mockUsers`, `mockPreviewRows`).
3. **Replacement Phases:**
   - Phase 4: Replace catalogue, batches, inventory operations, and suppliers with live Express API data.
   - Phase 6: Replace demand forecast charts, expiry risk calculations, stockout tables, and reorders with live Express + FastAPI results.
   - Phase 7: Replace purchase orders, notifications, reports, and settings with live Express data.

---

## 6. Known Issues, Shortcuts & Environment Notes

1. **Browser Driver Restriction:**
   - The internal browser automation subagent was unable to download the Playwright browser driver due to an upstream download 404 on this Windows environment.
   - All verification was performed through `npm run build` (compiled cleanly with 0 errors) and HTTP requests via PowerShell `Invoke-WebRequest` confirming that the dev server returns HTTP 200 and valid JS transforms for `main.jsx`, `LoginPage.jsx`, and `DashboardPage.jsx`.
2. **Phase 2 Shortcuts:**
   - Screens 3 through 15 are static/mock placeholders that match the UI reference visually but do not persist mutations or execute real API calls.
   - Dispense dialog, receive modal, and reorder popovers will be fully implemented and wired to endpoints in Phase 4 and Phase 7.

---

## 7. Next Task: Phase 3 (Inventory Backend)

When starting the next session, build **Phase 3** in the `server/` directory:

1. **Express Architecture & Setup:**
   - Create Express app structure in `server/src/` (`app.js`, `server.js`, `config/env.js`, `config/db.js`, `config/logger.js`).
   - MongoDB Atlas connection with replica set support (for multi-document transactions).
   - Global error handler (`utils/apiResponse.js`, `utils/ApiError.js`), helmet, cors, cookie-parser, express-rate-limit.
2. **Mongoose Models & Indexes (Section 6 & api-contract.md):**
   - `User`, `RefreshToken`, `Medicine`, `Supplier`, `MedicineSupplier`, `Batch`, `StockMovement` (immutable ledger), `DailyUsage`, `Setting`, `AuditLog`.
3. **Authentication & RBAC:**
   - JWT access token (15m) + refresh token (7d) in HTTP-only cookies.
   - Refresh token rotation in DB.
   - CSRF double-submit token middleware (`csrf_token` cookie vs `X-CSRF-Token` header).
   - Rate limiting on `/api/auth/login`.
   - `authenticate` and `authorize(...roles)` middlewares.
4. **Core Stock Services & Transactions (`services/stockService.js`, `services/fefoService.js`):**
   - FEFO allocation algorithm (earliest expiry first, excluding expired batches).
   - Atomic conditional updates (`$inc` guarded by `currentQuantity >= qty`).
   - Transactional operations: receive stock, dispense, return, adjust, write-off.
   - Ledger movements written for every stock change.
   - Reconciliation endpoint (`GET /api/inventory/reconcile`).
5. **Seed Script:**
   - `npm run seed` creating admin, manager, staff accounts, 30 medicines, batches, movements, and DailyUsage records.
6. **Backend Tests:**
   - Supertest suite validating auth, FEFO allocation, negative stock rejection, expired dispense block, and ledger balance reconciliation.
