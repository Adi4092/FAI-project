import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Pages and components
import PurchaseOrdersPage from '../PurchaseOrdersPage';
import NotificationsPage from '../NotificationsPage';
import SettingsPage from '../SettingsPage';
import RoleRoute from '../../routes/RoleRoute';
import { ToastProvider } from '../../context/ToastContext';
import Toast from '../../components/common/Toast';

// Services
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { supplierService } from '../../services/supplierService';
import { medicineService } from '../../services/medicineService';
import { notificationService } from '../../services/notificationService';
import { settingService } from '../../services/settingService';
import { forecastService } from '../../services/forecastService';

// Mock Recharts for jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />
}));

// Mocks for services
vi.mock('../../services/purchaseOrderService', () => ({
  purchaseOrderService: {
    getPurchaseOrders: vi.fn(),
    getPurchaseOrder: vi.fn(),
    createPurchaseOrder: vi.fn(),
    updatePurchaseOrder: vi.fn(),
    submitPurchaseOrder: vi.fn(),
    approvePurchaseOrder: vi.fn(),
    rejectPurchaseOrder: vi.fn(),
    receivePurchaseOrder: vi.fn(),
    cancelPurchaseOrder: vi.fn()
  }
}));

vi.mock('../../services/supplierService', () => ({
  supplierService: {
    getSuppliers: vi.fn()
  }
}));

vi.mock('../../services/medicineService', () => ({
  medicineService: {
    getMedicines: vi.fn()
  }
}));

vi.mock('../../services/notificationService', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn()
  }
}));

vi.mock('../../services/settingService', () => ({
  settingService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    downloadTemplate: vi.fn(),
    previewImport: vi.fn(),
    commitImport: vi.fn()
  }
}));

vi.mock('../../services/forecastService', () => ({
  forecastService: {
    getModelInfo: vi.fn(),
    retrainModel: vi.fn()
  }
}));

// Mock AuthContext hook
let mockUser = { role: 'admin', name: 'Test Admin' };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: mockUser?.role,
    isAuthenticated: !!mockUser
  })
}));

describe('Phase 7 Client Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { role: 'admin', name: 'Test Admin' };

    // Polyfill FileReader for jsdom
    class MockFileReader {
      readAsText(file) {
        setTimeout(() => {
          this.result = 'dummy,csv,content\n1,2,3';
          if (this.onload) {
            this.onload({ target: { result: this.result } });
          }
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
  });

  // =========================================================================
  // 1. PO RECEIVE FORM VALIDATION
  // =========================================================================
  describe('Purchase Orders — Receive Form Validation', () => {
    const mockOrder = {
      id: 'po-101',
      _id: 'po-101',
      orderNumber: 'PO-2026-0001',
      supplierId: { _id: 'supp-1', name: 'Alpha Pharma' },
      status: 'approved',
      createdAt: '2026-10-17T10:00:00Z',
      expectedDeliveryDate: '2026-10-24',
      items: [
        {
          medicineId: { _id: 'med-1', name: 'Amoxicillin 500mg', medicineCode: 'MED-AMOX' },
          quantityOrdered: 100,
          quantityReceived: 20, // max remaining = 80
          unitCost: 1.50
        }
      ],
      estimatedTotalCost: 150,
      hasUnknownCost: false
    };

    beforeEach(() => {
      purchaseOrderService.getPurchaseOrders.mockResolvedValue({
        data: [mockOrder],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 }
      });
      supplierService.getSuppliers.mockResolvedValue({ data: [] });
      medicineService.getMedicines.mockResolvedValue({ data: [] });
    });

    it('rejects receiving quantity exceeding the remaining ordered quantity', async () => {
      render(
        <ToastProvider>
          <Toast />
          <PurchaseOrdersPage />
        </ToastProvider>
      );

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
      });

      // Click "Receive Stock" button
      const receiveBtn = screen.getByTitle('Receive Stock');
      fireEvent.click(receiveBtn);

      // Verify receive modal opens
      await waitFor(() => {
        expect(screen.getByText(/Receive Goods — PO-2026-0001/i)).toBeInTheDocument();
        expect(screen.getByText(/Remaining:/i)).toBeInTheDocument();
        expect(screen.getByText('80')).toBeInTheDocument();
      });

      // Find the quantity input and enter 120 (exceeds remaining 80)
      const qtyInputs = screen.getAllByRole('spinbutton');
      const receiveQtyInput = qtyInputs[qtyInputs.length - 1]; // last spinbutton is in receive form
      fireEvent.change(receiveQtyInput, { target: { value: '120' } });

      // Click Confirm Receipt
      const confirmBtn = screen.getByText(/Confirm Receipt & Commit Stock/i);
      fireEvent.click(confirmBtn);

      // Expect error toast and no service call
      await waitFor(() => {
        expect(screen.getByText(/exceeds remaining 80/i)).toBeInTheDocument();
      });
      expect(purchaseOrderService.receivePurchaseOrder).not.toHaveBeenCalled();
    });

    it('rejects receiving when expiry date is not after manufacturing date', async () => {
      render(
        <ToastProvider>
          <Toast />
          <PurchaseOrdersPage />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Receive Stock'));

      await waitFor(() => {
        expect(screen.getByText(/Receive Goods — PO-2026-0001/i)).toBeInTheDocument();
      });

      // Set quantity to valid 50
      const qtyInputs = screen.getAllByRole('spinbutton');
      const receiveQtyInput = qtyInputs[qtyInputs.length - 1];
      fireEvent.change(receiveQtyInput, { target: { value: '50' } });

      // Set expiry date earlier than manufacturing date
      const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
      const mfgInput = dateInputs[0];
      const expInput = dateInputs[1];
      fireEvent.change(mfgInput, { target: { value: '2026-10-15' } });
      fireEvent.change(expInput, { target: { value: '2026-10-10' } }); // before mfg date

      const confirmBtn = screen.getByText(/Confirm Receipt & Commit Stock/i);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Expiry date must be after manufacturing date/i)).toBeInTheDocument();
      });
      expect(purchaseOrderService.receivePurchaseOrder).not.toHaveBeenCalled();
    });

    it('submits successfully with client receiptId when valid data is provided', async () => {
      purchaseOrderService.receivePurchaseOrder.mockResolvedValue({
        data: { id: 'po-101', status: 'partially_received' }
      });

      render(
        <ToastProvider>
          <PurchaseOrdersPage />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Receive Stock'));

      await waitFor(() => {
        expect(screen.getByText(/Receive Goods — PO-2026-0001/i)).toBeInTheDocument();
      });

      // Set valid quantity within remaining
      const qtyInputs = screen.getAllByRole('spinbutton');
      const receiveQtyInput = qtyInputs[qtyInputs.length - 1];
      fireEvent.change(receiveQtyInput, { target: { value: '40' } });

      const confirmBtn = screen.getByText(/Confirm Receipt & Commit Stock/i);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(purchaseOrderService.receivePurchaseOrder).toHaveBeenCalledWith(
          'po-101',
          expect.objectContaining({
            receiptId: expect.stringMatching(/^[0-9a-fA-F-]+$/),
            lines: expect.arrayContaining([
              expect.objectContaining({
                quantity: 40,
                medicineId: 'med-1'
              })
            ])
          })
        );
      });
    });
  });

  // =========================================================================
  // 2. NOTIFICATIONS FILTERS & BULK ACTIONS
  // =========================================================================
  describe('Notifications — Filter Bar & Mark All Read', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        type: 'po_pending',
        severity: 'warning',
        title: 'PO Pending Approval',
        message: 'Order PO-2026-0001 requires approval',
        isRead: false,
        createdAt: '2026-10-17T12:00:00Z',
        relatedEntityType: 'purchase_order',
        relatedEntityId: 'po-101'
      },
      {
        id: 'notif-2',
        type: 'low_stock',
        severity: 'critical',
        title: 'Stockout Risk Alert',
        message: 'Metformin 500mg reached critical stock level',
        isRead: true,
        createdAt: '2026-10-16T08:00:00Z',
        relatedEntityType: 'medicine',
        relatedEntityId: 'med-2'
      }
    ];

    beforeEach(() => {
      notificationService.getNotifications.mockResolvedValue({
        data: mockNotifications,
        meta: { page: 1, limit: 15, total: 2, totalPages: 1 }
      });
      notificationService.markAllAsRead.mockResolvedValue({ message: 'Marked all as read' });
    });

    it('filters notifications by category, severity, and read status', async () => {
      render(
        <ToastProvider>
          <MemoryRouter>
            <NotificationsPage />
          </MemoryRouter>
        </ToastProvider>
      );

      // Verify initial fetch
      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, limit: 15 })
        );
        expect(screen.getByText('Order PO-2026-0001 requires approval')).toBeInTheDocument();
        expect(screen.getByText('Metformin 500mg reached critical stock level')).toBeInTheDocument();
      });

      // Filter by category: PO Pending Approval
      const categorySelect = document.getElementById('filter-category');
      const severitySelect = document.getElementById('filter-severity');
      const readSelect = document.getElementById('filter-read-status');

      fireEvent.change(categorySelect, { target: { value: 'po_pending' } });
      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'po_pending' })
        );
      });

      // Filter by severity: critical
      fireEvent.change(severitySelect, { target: { value: 'critical' } });
      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'critical' })
        );
      });

      // Filter by read status: unread only
      fireEvent.change(readSelect, { target: { value: 'false' } });
      await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ isRead: 'false' })
        );
      });
    });

    it('triggers markAllAsRead when button is clicked', async () => {
      render(
        <ToastProvider>
          <MemoryRouter>
            <NotificationsPage />
          </MemoryRouter>
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Order PO-2026-0001 requires approval')).toBeInTheDocument();
      });

      const markAllBtn = screen.getByText('Mark All Read');
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationService.markAllAsRead).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 3. SETTINGS & CSV IMPORT PREVIEW AND ERROR DISPLAY
  // =========================================================================
  describe('Settings — CSV Import Validation Preview & Errors', () => {
    beforeEach(() => {
      settingService.getSettings.mockResolvedValue({
        data: {
          currency: 'USD',
          lowStockThresholdMultiplier: 1.0,
          expiryWarningDays: 60,
          leadTimeDefaultDays: 7,
          targetCoverageDays: 30,
          serviceLevelZ: 1.65,
          riskThresholdCritical: 75,
          riskThresholdWarning: 40
        }
      });
      forecastService.getModelInfo.mockResolvedValue({
        data: { modelName: 'random_forest', version: '1.0.0', trainedAt: '2026-10-15' }
      });
    });

    it('displays validation errors with row numbers and disables commit when all rows rejected', async () => {
      render(
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      );

      // Navigate to Data Import tab
      const importTabBtn = screen.getByText('Data Import');
      fireEvent.click(importTabBtn);

      await waitFor(() => {
        expect(screen.getByText('Bulk CSV Data Intake')).toBeInTheDocument();
        expect(screen.getByText(/Pre-Commit Validation Preview/i)).toBeInTheDocument();
      });

      // Mock preview response with critical errors
      settingService.previewImport.mockResolvedValue({
        data: {
          importId: 'import-err-1',
          totalRows: 2,
          acceptedCount: 0,
          rejectedCount: 2,
          hasCriticalErrors: true,
          previewRows: [
            {
              rowNumber: 2,
              isValid: false,
              data: { medicineCode: 'MED-NONEXISTENT' },
              errors: ["Medicine code 'MED-NONEXISTENT' does not exist in catalogue"]
            },
            {
              rowNumber: 3,
              isValid: false,
              data: { medicineCode: 'MED-CIPRO' },
              errors: ['Expiry date must be in the future', 'Quantity cannot be negative']
            }
          ],
          validRows: []
        }
      });

      // Simulate file upload
      const fileInput = document.getElementById('file-upload-input');
      const testFile = new File(['medicineCode,quantity\nMED-NONEXISTENT,-5'], 'test.csv', { type: 'text/csv' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      // Wait for FileReader onload to set csvContent
      await waitFor(() => {
        const previewBtn = document.getElementById('btn-preview-import');
        expect(previewBtn).not.toBeDisabled();
      });

      const previewBtn = document.getElementById('btn-preview-import');
      fireEvent.click(previewBtn);

      // Verify errors and row status
      await waitFor(() => {
        expect(screen.getByText('Critical errors found')).toBeInTheDocument();
        expect(screen.getByText("Medicine code 'MED-NONEXISTENT' does not exist in catalogue")).toBeInTheDocument();
        expect(screen.getByText('Expiry date must be in the future; Quantity cannot be negative')).toBeInTheDocument();
      });

      // Verify commit button is disabled because acceptedCount is 0
      const commitBtn = document.getElementById('btn-commit-import');
      expect(commitBtn).toBeDisabled();
    });

    it('displays valid rows and enables commit button when preview succeeds', async () => {
      render(
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Data Import'));

      await waitFor(() => {
        expect(screen.getByText('Bulk CSV Data Intake')).toBeInTheDocument();
      });

      settingService.previewImport.mockResolvedValue({
        data: {
          importId: 'import-valid-1',
          totalRows: 1,
          acceptedCount: 1,
          rejectedCount: 0,
          hasCriticalErrors: false,
          previewRows: [
            {
              rowNumber: 2,
              isValid: true,
              data: { medicineCode: 'MED-CIPRO', batchNumber: 'B-CIPRO-01' },
              errors: []
            }
          ],
          validRows: [{ medicineCode: 'MED-CIPRO', batchNumber: 'B-CIPRO-01', quantity: 100 }]
        }
      });

      const fileInput = document.getElementById('file-upload-input');
      const testFile = new File(['medicineCode,batchNumber\nMED-CIPRO,B-CIPRO-01'], 'valid.csv', { type: 'text/csv' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        const previewBtn = document.getElementById('btn-preview-import');
        expect(previewBtn).not.toBeDisabled();
      });

      const previewBtn = document.getElementById('btn-preview-import');
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(screen.getByText('1 ready / 0 rejected')).toBeInTheDocument();
        expect(screen.getByText('VALID')).toBeInTheDocument();
      });

      const commitBtn = document.getElementById('btn-commit-import');
      expect(commitBtn).not.toBeDisabled();
    });
  });

  // =========================================================================
  // 4. ROLE-BASED ROUTE GUARDS (RBAC)
  // =========================================================================
  describe('RBAC Route Guards', () => {
    it('redirects staff role away from manager/admin protected routes to /forbidden', () => {
      mockUser = { role: 'staff', name: 'Staff User' };

      render(
        <MemoryRouter initialEntries={['/purchase-orders']}>
          <Routes>
            <Route path="/forbidden" element={<div data-testid="forbidden-screen">Access Forbidden</div>} />
            <Route
              path="/purchase-orders"
              element={
                <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
                  <div data-testid="po-screen">Purchase Orders Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('forbidden-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('po-screen')).not.toBeInTheDocument();
    });

    it('redirects inventory_manager away from admin-only routes to /forbidden', () => {
      mockUser = { role: 'inventory_manager', name: 'Manager User' };

      render(
        <MemoryRouter initialEntries={['/users']}>
          <Routes>
            <Route path="/forbidden" element={<div data-testid="forbidden-screen">Access Forbidden</div>} />
            <Route
              path="/users"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <div data-testid="users-screen">User Management Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('forbidden-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('users-screen')).not.toBeInTheDocument();
    });

    it('allows inventory_manager to access manager-permitted routes', () => {
      mockUser = { role: 'inventory_manager', name: 'Manager User' };

      render(
        <MemoryRouter initialEntries={['/purchase-orders']}>
          <Routes>
            <Route path="/forbidden" element={<div data-testid="forbidden-screen">Access Forbidden</div>} />
            <Route
              path="/purchase-orders"
              element={
                <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
                  <div data-testid="po-screen">Purchase Orders Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('po-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('forbidden-screen')).not.toBeInTheDocument();
    });

    it('allows admin to access admin-only routes', () => {
      mockUser = { role: 'admin', name: 'Admin User' };

      render(
        <MemoryRouter initialEntries={['/users']}>
          <Routes>
            <Route path="/forbidden" element={<div data-testid="forbidden-screen">Access Forbidden</div>} />
            <Route
              path="/users"
              element={
                <RoleRoute allowedRoles={['admin']}>
                  <div data-testid="users-screen">User Management Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('users-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('forbidden-screen')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. POPULATED SUPPLIER & MEDICINE RENDERING (ALL & DRAFT TABS)
  // =========================================================================
  describe('Purchase Orders — Populated Supplier & Medicine Object Rendering', () => {
    const populatedDraftOrder = {
      id: 'po-2026-0001',
      _id: 'po-2026-0001',
      orderNumber: 'PO-2026-0001',
      supplierId: {
        _id: 'supp-hp-01',
        name: 'HealthPlus Pharma',
        contactPerson: 'Sarah Johnson',
        email: 'orders@healthplus.com'
      },
      status: 'draft',
      createdAt: '2026-10-17T11:52:58.236Z',
      expectedDeliveryDate: '2026-10-24T11:52:58.196Z',
      items: [
        {
          medicineId: {
            _id: 'med-para-042',
            name: 'Paracetamol 650 mg',
            medicineCode: 'MED-042',
            unit: 'tablet'
          },
          quantityOrdered: 170,
          quantityReceived: 0,
          unitCost: null
        }
      ],
      estimatedTotalCost: null,
      hasUnknownCost: true
    };

    beforeEach(() => {
      supplierService.getSuppliers.mockResolvedValue({ data: [] });
      medicineService.getMedicines.mockResolvedValue({ data: [] });
    });

    it('renders a PO whose supplier and medicine are populated objects under both All and Draft tabs', async () => {
      purchaseOrderService.getPurchaseOrders.mockImplementation(({ status }) => {
        return Promise.resolve({
          data: [populatedDraftOrder],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 }
        });
      });

      render(
        <ToastProvider>
          <Toast />
          <PurchaseOrdersPage />
        </ToastProvider>
      );

      // Under "All" tab (default)
      await waitFor(() => {
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('HealthPlus Pharma')).toBeInTheDocument();
        expect(screen.getByText(/1 items \(0\/170 units\)/i)).toBeInTheDocument();
        expect(screen.getByText('Cost unavailable')).toBeInTheDocument();
        expect(screen.getByText('DRAFT')).toBeInTheDocument();
      });

      // Switch to "Draft" tab
      const draftTabBtn = screen.getByRole('button', { name: 'Draft' });
      fireEvent.click(draftTabBtn);

      await waitFor(() => {
        expect(purchaseOrderService.getPurchaseOrders).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'draft' })
        );
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('HealthPlus Pharma')).toBeInTheDocument();
        expect(screen.getByText('Cost unavailable')).toBeInTheDocument();
      });
    });
  });
});

