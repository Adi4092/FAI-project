# MedStock AI — Phase 7 Manual Verification Test Script

**Target Version:** Phase 7  
**Scope:** Purchase Orders, Notifications, Reports, Users/RBAC, and Settings/CSV Import  
**Pre-requisite:** Application running via `start-all.bat` (Frontend: `http://localhost:5173`, Backend: `http://localhost:5000`)

---

## Demo Credentials Reference

| Role | Email | Password | Allowed Permissions |
|---|---|---|---|
| **System Administrator** | `admin@medstock.local` | `password123` | Full access (Users, Settings, PO Approval, Reports, Catalogue, Inventory) |
| **Inventory Manager** | `manager@medstock.local` | `password123` | Operational access (PO Create/Submit/Receive, Reorders, Reports, Data Import, Inventory) |
| **Pharmacy Staff** | `staff@medstock.local` | `password123` | Dispensing & read-only catalogue/inventory (Blocked from POs, Reports, Users, Settings) |

---

## Test Scenario 1: Purchase Orders Lifecycle & Receiving (`/purchase-orders`)

### Step 1.1: Cost Shown as "Cost Unavailable" (Unpriced Line)
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. Navigate to `/purchase-orders`.
  2. Click `+ Create PO` in the top right.
  3. Select any supplier (e.g., `MedSupply Logistics`).
  4. Select a medicine that has no supplier unit cost defined (or leave unit cost blank).
  5. Enter Quantity: `100`.
  6. Click `Create Purchase Order`.
- **Expected Result:**
  - A new draft PO is created (e.g., `PO-2026-0002`).
  - In the table, the Items/Cost column displays: `<N> items (0/100 units)` and amber text **"Cost unavailable"**.
  - In the PO Detail modal (`Eye` icon), the Estimated Cost card displays **"Cost unavailable"** and the line item displays **"Cost unavailable"** (it is never shown as `$0.00`).

---

### Step 1.2: Submit a Purchase Order
- **Login As:** `manager@medstock.local`
- **Action:**
  1. Navigate to `/purchase-orders`.
  2. Under the **"Draft"** tab, locate draft order `PO-2026-0001` (Paracetamol 650mg, `MED-042`, 170 tablets created from Phase 6 reorder recommendation) or the draft created in Step 1.1.
  3. Click the blue **"Submit"** button on the row.
- **Expected Result:**
  - Green success toast: *"Purchase order PO-2026-0001 submitted for approval"*.
  - Status pill changes from `DRAFT` (grey) to `PENDING APPROVAL` (amber).
  - The "Submit" button disappears from the row actions.
  - A new notification is generated: *"PO Pending Approval"*.

---

### Step 1.3: Approve the Purchase Order
- **Login As:** `admin@medstock.local` (Logout first if logged in as manager)
- **Action:**
  1. Navigate to `/purchase-orders`.
  2. Click the **"Pending Approval"** tab.
  3. Locate `PO-2026-0001`.
  4. Click the green **"Approve"** button on the row.
- **Expected Result:**
  - Green success toast: *"Purchase order PO-2026-0001 approved successfully"*.
  - Status pill changes to `APPROVED` (green).
  - The green **"Receive Stock"** button appears in the action column.
  - The pending approval alert in `/notifications` is auto-resolved.

---

### Step 1.4: Partial Stock Receipt
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. On `/purchase-orders`, locate the approved `PO-2026-0001`.
  2. Click the green **"Receive Stock"** button.
  3. The **"Receive Goods — PO-2026-0001"** modal opens.
  4. Verify the header shows a unique client UUID (e.g. `e46695e8-...`).
  5. Verify the line shows `Remaining: 170`.
  6. Fill in the fields:
     - **Batch Number:** `B-PARA-P7-01`
     - **Mfg Date:** Today's date (e.g., `2026-10-18`)
     - **Expiry Date:** Future date (e.g., `2027-10-18`)
     - **Qty to Receive:** Change from `170` to `70`.
  7. Click **"Confirm Receipt & Commit Stock"**.
- **Expected Result:**
  - Success toast: *"Stock received successfully. Inventory ledger updated."*
  - Modal closes.
  - Status pill updates to `PARTIALLY RECEIVED` (blue).
  - Items column displays: `1 items (70/170 units)`.
  - Navigate to `/inventory`: Batch `B-PARA-P7-01` appears with quantity `70`.
  - Navigate to `/stock-movements`: A new `receipt` movement appears showing `+70` units with correct before/after balances.

---

### Step 1.5: Second Stock Receipt (Completing Order)
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. Return to `/purchase-orders`.
  2. Click **"Receive Stock"** on `PO-2026-0001`.
  3. Note that the remaining count now shows `Remaining: 100`.
  4. Fill in the fields:
     - **Batch Number:** `B-PARA-P7-02`
     - **Mfg Date:** `2026-10-18`
     - **Expiry Date:** `2027-10-18`
     - **Qty to Receive:** `100` (the remaining balance).
  5. Click **"Confirm Receipt & Commit Stock"**.
- **Expected Result:**
  - Success toast: *"Stock received successfully. Inventory ledger updated."*
  - Status pill updates to `RECEIVED` (dark green).
  - Items column displays: `1 items (170/170 units)`.
  - The "Receive Stock" button is no longer visible.
  - Linked source reorder recommendation is marked `ordered`.

---

### Step 1.6: Duplicate Receipt Idempotency (Re-submitting Same Receipt ID)
- **Login As:** `manager@medstock.local`
- **Action:**
  1. Inspect the PO detail modal for `PO-2026-0001`.
  2. Note the `receiptId` generated in Step 1.4.
  3. Re-submit an identical `POST /api/purchase-orders/:id/receive` request using the same `receiptId` (e.g. via DevTools Network tab or curl/Postman).
- **Expected Result:**
  - Server returns HTTP `200 OK` with the existing receipt data.
  - No new batches are created, and no new `StockMovement` ledger entries are written. Ledger balance remains unchanged.

---

### Step 1.7: Over-Receive Validation (Client & Server Guard)
- **Login As:** `manager@medstock.local`
- **Action:**
  1. Create or select any approved PO that has remaining quantity `N` (e.g. `100`).
  2. Click **"Receive Stock"**.
  3. In the Qty input, enter a number greater than remaining: `150`.
  4. Click **"Confirm Receipt & Commit Stock"**.
- **Expected Result:**
  - Submission is blocked.
  - Red error toast displays: *"Quantity 150 exceeds remaining 100 for <Medicine Name>"*.
  - Modal remains open; no request touches the database.

---

### Step 1.8: Cancel Purchase Order with Mandatory Reason
- **Login As:** `manager@medstock.local`
- **Action:**
  1. On `/purchase-orders`, locate any active non-received order (e.g., the draft from Step 1.1).
  2. Click the circle-backslash (Ban) icon in the action column.
  3. The **"Cancel Purchase Order"** modal opens.
  4. Leave the reason empty and click **"Confirm Cancellation"**.
  5. Observe the validation toast: *"Cancellation reason is required"*.
  6. Type reason: *"Supplier discontinued item"* and click **"Confirm Cancellation"**.
- **Expected Result:**
  - Success toast: *"Purchase order PO-XXXX-XXXX cancelled"*.
  - Order status updates to `CANCELLED` (red pill).
  - Open Detail view (`Eye` icon) $\rightarrow$ cancellation reason is displayed under the order metadata.

---

## Test Scenario 2: Notifications Screen & Topbar Bell (`/notifications`)

### Step 2.1: Verify Unread Badge & Filters
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. Look at the top-right header: verify the Bell icon has a red badge with a positive count (e.g., `4`).
  2. Look at the Sidebar: verify the "Notifications" item displays an unread count badge.
  3. Click the bell icon or navigate to `/notifications`.
  4. Test the **Category Filter**: Select `"PO Pending Approval"` $\rightarrow$ only PO-related notifications appear.
  5. Test the **Severity Filter**: Select `"Critical"` $\rightarrow$ only critical severity alerts appear with red badges.
  6. Test the **Read Status Filter**: Select `"Unread Only"` $\rightarrow$ only unread cards with blue indicator dots appear.
  7. Reset all filters to `"All"`.
- **Expected Result:**
  - Table instantly re-queries and paginates through matching alerts without crashing.

---

### Step 2.2: Mark Single as Read & Mark All Read
- **Action:**
  1. On `/notifications`, click **"Mark as Read"** on any individual unread notification card.
  2. Observe the unread blue dot disappears and Topbar bell count decrements by 1.
  3. Click the **"Mark All Read"** button in the page header.
- **Expected Result:**
  - All notification cards switch to read state (indicator dots disappear).
  - Topbar bell badge disappears (unread count = `0`).
  - Sidebar badge disappears.

---

## Test Scenario 3: Reports & Matching CSV Export (`/reports`)

### Step 3.1: Consumption Trends Report & CSV Verification
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. Navigate to `/reports`.
  2. Select the **"Consumption Trends"** tab.
  3. Select Date Range: **"Last 30 Days"**.
  4. Observe:
     - Metric card: "Total Units Dispensed".
     - Recharts Line/Bar visualization showing daily trends.
     - One-line contextual explanation banner.
     - Tabular data showing columns: `Date`, `Medicine Code`, `Medicine Name`, `Units Dispensed`.
  5. Note the values on the first 2 table rows.
  6. Click the blue **"Export CSV"** button.
  7. Open the downloaded file `consumption-report.csv` in a text editor (Notepad).
- **Expected Result:**
  - CSV header line is: `"Date","Medicine Code","Medicine Name","Units Dispensed"`.
  - CSV rows, medicine codes, and quantities match the on-screen table rows exactly.

---

### Step 3.2: Realized Wastage vs. Projected Expiry Exposure Separation
- **Action:**
  1. On `/reports`, click the **"Realized Wastage (Write-Offs)"** tab.
     - Verify it lists historical `write_off` stock movements with recorded reasons (expired, damaged).
  2. Click the **"Projected Expiry Exposure"** tab.
     - Verify it is clearly labelled with the amber disclaimer banner: **"Estimated — Based on FEFO Simulation"**.
- **Expected Result:**
  - Realized losses (actual ledger write-offs) are strictly isolated from future simulation estimates.

---

## Test Scenario 4: Role-Based Route Guards (RBAC)

### Step 4.1: Staff Access Restrictions
- **Login As:** `staff@medstock.local` / `password123`
- **Action:**
  1. Observe the **Sidebar**:
     - Visible: Dashboard, Medicines, Inventory, Expiry Risk, Stockout, Stock Movements, Notifications.
     - Hidden: Purchase Orders, Reports, Settings, Users, Suppliers, Reorders, Forecasting.
  2. Manually type the following restricted URLs into the browser address bar:
     - `http://localhost:5173/purchase-orders`
     - `http://localhost:5173/reports`
     - `http://localhost:5173/settings`
     - `http://localhost:5173/users`
- **Expected Result:**
  - For each restricted URL, the application immediately navigates to `/forbidden`.
  - The Forbidden screen renders: *"Access Forbidden - 403: You do not have permission to access this page."* with a button to return to Dashboard.

---

### Step 4.2: Inventory Manager vs. Admin Separation
- **Login As:** `manager@medstock.local` / `password123`
- **Action:**
  1. Verify manager can access: `/purchase-orders`, `/reports`, `/settings` (Data Import tab).
  2. Manually type `http://localhost:5173/users` in the address bar.
- **Expected Result:**
  - Manager is redirected to `/forbidden`. Manager cannot view or modify system users.

---

## Test Scenario 5: Last Administrator Protection (`/users`)

- **Login As:** `admin@medstock.local` / `password123`
- **Action:**
  1. Navigate to `/users`.
  2. Find the row for `admin@medstock.local` (the sole active System Administrator).
  3. **Test Demotion:** Click `Edit` on the row $\rightarrow$ change role from `System Admin` to `Pharmacy Staff` $\rightarrow$ click `Save Changes`.
  4. **Test Deactivation:** Click the active status toggle (green switch) to deactivate the admin.
- **Expected Result:**
  - Both actions are strictly blocked by the backend API.
  - A red error alert displays: *"Cannot demote the last active system administrator"* / *"Cannot deactivate the last active system administrator"*.
  - The admin account remains active with `admin` role.

---

## Test Scenario 6: CSV Import Pipeline (`/settings` > Data Import)

### Step 6.1: Pre-Commit Validation with Deliberate Errors
- **Login As:** `manager@medstock.local` (or `admin@medstock.local`)
- **Action:**
  1. Navigate to `/settings` and click the **"Data Import"** tab.
  2. Select Dataset Type: **"Medicines Catalogue (.csv)"**.
  3. Create a test file `test_invalid.csv` on your computer with invalid rows:
     ```csv
     name,medicineCode,category,unit,reorderLevel,safetyStock,description
     ,MED-NONAME,Tablet,strips,-10,20,Missing name and negative reorder
     Amoxicillin,MED-AMOX,Antibiotic,capsule,50,20,Duplicate existing code
     ```
  4. Drag or browse and select `test_invalid.csv`.
  5. Click **"Validate & Preview"**.
- **Expected Result:**
  - Pre-Commit Validation Preview renders without touching the database:
    - Header displays red text: **"Critical errors found"**.
    - Preview table shows Row 2 and Row 3 with red `ERROR` status pills.
    - Error column explains the exact reasons:
      - Row 2: *"Name is required"*, *"Reorder level must be a non-negative number"*.
      - Row 3: *"Medicine code 'MED-AMOX' already exists in catalogue"*.
    - The **"Commit Import"** button is disabled (`0 ready / 2 rejected`).

---

### Step 6.2: Valid Import & Ledger Reconciliation
- **Action:**
  1. Create a clean test file `test_valid.csv`:
     ```csv
     name,medicineCode,category,unit,reorderLevel,safetyStock,description
     Artemether 80mg,MED-ART80,Antimalarial,tablet,60,25,Essential antimalarial formulation
     ```
  2. Select `test_valid.csv` in the dropzone.
  3. Click **"Validate & Preview"**.
  4. Verify the preview panel displays green text: **"1 ready / 0 rejected"** and Row 2 has a green `VALID` badge.
  5. The **"Commit Import"** button is now enabled. Click **"Commit Import"**.
  6. Confirm the browser confirmation prompt.
- **Expected Result:**
  - Green success banner displays: *"Import Succeeded: 1 records accepted, 0 rejected, 0 duplicates skipped"*.
  - Navigate to `/medicines`: `Artemether 80mg` (`MED-ART80`) appears in the active catalogue.
  - (For batch CSV imports, verify that `StockMovement` entries with `type: "receipt"` are generated automatically so the ledger reconciles).
