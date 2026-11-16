import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { supplierService } from '../services/supplierService';
import { medicineService } from '../services/medicineService';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  PackageCheck,
  Send,
  Ban,
  Clock,
  Boxes,
  AlertCircle,
  Trash2,
  Calendar,
  IndianRupee
} from 'lucide-react';
import { formatCurrency } from '../utils/formatNumber';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'partially_received', label: 'Partially Received' },
  { id: 'received', label: 'Received' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersPage() {
  const { showToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // Aux state for dropdowns
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);

  // Form states
  const [createForm, setCreateForm] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    items: [{ medicineId: '', quantityOrdered: 100, unitCost: '' }]
  });

  const [receiveForm, setReceiveForm] = useState({
    receiptId: '',
    lines: []
  });

  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await purchaseOrderService.getPurchaseOrders({
        page,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      const orderList = Array.isArray(res) ? res : (res?.data || []);
      setOrders(orderList);
      if (res?.meta) setMeta(res.meta);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [suppRes, medRes] = await Promise.all([
          supplierService.getSuppliers({ limit: 100 }),
          medicineService.getMedicines({ limit: 100 })
        ]);
        setSuppliers(suppRes.data || suppRes || []);
        setMedicines(medRes.data || medRes || []);
      } catch (e) {
        // Silently continue
      }
    };
    loadDropdownData();
  }, []);

  const openDetail = async (po) => {
    try {
      const res = await purchaseOrderService.getPurchaseOrder(po.id);
      setSelectedOrder(res?.data || res);
      setDetailModalOpen(true);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to load PO details', 'error');
    }
  };

  const handleOpenReceive = (po) => {
    setSelectedOrder(po);
    const clientUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rcpt-${Date.now()}`;
    const initialLines = (po.items || [])
      .map((it) => {
        const rem = Math.max(0, it.quantityOrdered - (it.quantityReceived || 0));
        const medId = typeof it.medicineId === 'object' && it.medicineId !== null
          ? (it.medicineId._id || it.medicineId.id)
          : it.medicineId;
        return {
          medicineId: medId,
          medicineName: it.medicineId?.name || 'Medicine',
          batchNumber: `B-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          manufacturingDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          quantity: rem,
          maxRemaining: rem,
          unitCost: it.unitCost !== null && it.unitCost !== undefined && it.unitCost > 0 ? it.unitCost : ''
        };
      })
      .filter((l) => l.maxRemaining > 0);

    setReceiveForm({
      receiptId: clientUuid,
      lines: initialLines
    });
    setReceiveModalOpen(true);
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receiveForm.receiptId?.trim()) {
      showToast('Receipt ID is required', 'error');
      return;
    }
    const linesToSubmit = receiveForm.lines.filter((l) => Number(l.quantity) > 0);
    if (linesToSubmit.length === 0) {
      showToast('At least one line must have a quantity > 0', 'error');
      return;
    }

    for (const l of linesToSubmit) {
      if (Number(l.quantity) > l.maxRemaining) {
        showToast(`Quantity ${l.quantity} exceeds remaining ${l.maxRemaining} for ${l.medicineName}`, 'error');
        return;
      }
      if (new Date(l.expiryDate) <= new Date(l.manufacturingDate)) {
        showToast(`Expiry date must be after manufacturing date for ${l.batchNumber}`, 'error');
        return;
      }
    }

    try {
      setActionSubmitting(true);
      const targetOrderId = selectedOrder.id || selectedOrder._id;
      await purchaseOrderService.receivePurchaseOrder(targetOrderId, {
        receiptId: receiveForm.receiptId,
        lines: linesToSubmit.map((l) => ({
          medicineId: typeof l.medicineId === 'object' && l.medicineId !== null
            ? (l.medicineId._id || l.medicineId.id)
            : l.medicineId,
          batchNumber: l.batchNumber,
          manufacturingDate: l.manufacturingDate,
          expiryDate: l.expiryDate,
          quantity: Number(l.quantity),
          unitCost: l.unitCost !== '' && l.unitCost !== null ? Number(l.unitCost) : null
        }))
      });
      showToast('Stock received successfully. Inventory ledger updated.', 'success');
      setReceiveModalOpen(false);
      fetchOrders(meta.page);
    } catch (err) {
      showToast(err?.error?.message || err?.response?.data?.error?.message || err?.message || 'Failed to receive stock', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleSubmitPO = async (po) => {
    try {
      await purchaseOrderService.submitPurchaseOrder(po.id);
      showToast(`Purchase order ${po.orderNumber} submitted for approval`, 'success');
      fetchOrders(meta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to submit PO', 'error');
    }
  };

  const handleApprovePO = async (po) => {
    try {
      await purchaseOrderService.approvePurchaseOrder(po.id);
      showToast(`Purchase order ${po.orderNumber} approved successfully`, 'success');
      fetchOrders(meta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to approve PO', 'error');
    }
  };

  const handleRejectSubmit = async () => {
    try {
      setActionSubmitting(true);
      await purchaseOrderService.rejectPurchaseOrder(selectedOrder.id, actionReason);
      showToast(`Purchase order ${selectedOrder.orderNumber} rejected`, 'success');
      setRejectModalOpen(false);
      setActionReason('');
      fetchOrders(meta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to reject PO', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!actionReason?.trim()) {
      showToast('Cancellation reason is required', 'error');
      return;
    }
    try {
      setActionSubmitting(true);
      await purchaseOrderService.cancelPurchaseOrder(selectedOrder.id, actionReason.trim());
      showToast(`Purchase order ${selectedOrder.orderNumber} cancelled`, 'success');
      setCancelModalOpen(false);
      setActionReason('');
      fetchOrders(meta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to cancel PO', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.supplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    const validItems = createForm.items.filter((it) => it.medicineId && Number(it.quantityOrdered) > 0);
    if (validItems.length === 0) {
      showToast('Please specify at least one medicine and quantity', 'error');
      return;
    }

    try {
      setActionSubmitting(true);
      await purchaseOrderService.createPurchaseOrder({
        supplierId: createForm.supplierId,
        expectedDeliveryDate: createForm.expectedDeliveryDate || null,
        items: validItems.map((it) => ({
          medicineId: it.medicineId,
          quantityOrdered: Number(it.quantityOrdered),
          unitCost: it.unitCost !== '' && it.unitCost !== null ? Number(it.unitCost) : null
        }))
      });
      showToast('Draft purchase order created successfully', 'success');
      setCreateModalOpen(false);
      setCreateForm({
        supplierId: '',
        expectedDeliveryDate: '',
        items: [{ medicineId: '', quantityOrdered: 100, unitCost: '' }]
      });
      fetchOrders(1);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to create purchase order', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((po) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const poNum = po.orderNumber?.toLowerCase() || '';
    const supp = po.supplierId?.name?.toLowerCase() || '';
    return poNum.includes(q) || supp.includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage end-to-end procurement lifecycle from draft requisition to multi-batch stock receipt"
      >
        <Button
          id="btn-create-po"
          variant="primary"
          icon={Plus}
          onClick={() => setCreateModalOpen(true)}
        >
          + Create PO
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-border space-x-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
              statusFilter === tab.id
                ? 'border-b-2 border-brand text-brand bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-po-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO number or supplier..."
            className="input-base pl-9 text-xs py-2 w-full"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredOrders.length} of {meta.total} orders
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card-base p-6 space-y-4">
          <Skeleton count={5} height={40} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(meta.page)} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No purchase orders found"
          description={
            statusFilter !== 'all'
              ? `There are no purchase orders matching status '${statusFilter}'.`
              : "No purchase orders created yet. Create one manually or approve a reorder recommendation."
          }
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreateModalOpen(true)}>
              Create First PO
            </Button>
          }
        />
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Items / Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((po) => {
                  const totalQty = (po.items || []).reduce((acc, it) => acc + (it.quantityOrdered || 0), 0);
                  const receivedQty = (po.items || []).reduce((acc, it) => acc + (it.quantityReceived || 0), 0);
                  const isCostUnknown = po.hasUnknownCost || po.estimatedTotalCost === null || po.estimatedTotalCost === 0 || (po.items || []).some((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0);

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {po.orderNumber}
                        {po.sourceRecommendationId && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                            Auto-Reorder
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {po.supplierId?.name || 'Unknown Supplier'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Unscheduled'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">
                          {po.items?.length || 0} items ({receivedQty}/{totalQty} units)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isCostUnknown ? (
                            <span className="text-amber-600 font-medium">Cost unavailable</span>
                          ) : (
                            <span>Est: {formatCurrency(po.estimatedTotalCost)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge status={po.status}>{po.status.replace('_', ' ').toUpperCase()}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetail(po)}
                            className="p-1 text-slate-500 hover:text-brand hover:bg-slate-100 rounded"
                            title="View PO Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Draft actions */}
                          {po.status === 'draft' && (
                            <button
                              onClick={() => handleSubmitPO(po)}
                              className="px-2 py-1 text-[11px] font-semibold bg-blue-50 text-brand border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                              title="Submit for Manager Approval"
                            >
                              <Send className="w-3 h-3" /> Submit
                            </button>
                          )}

                          {/* Pending Approval actions */}
                          {po.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprovePO(po)}
                                className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 flex items-center gap-1"
                                title="Approve Purchase Order"
                              >
                                <CheckCircle className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOrder(po);
                                  setRejectModalOpen(true);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 flex items-center gap-1"
                                title="Reject Purchase Order"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}

                          {/* Approved or Partially Received actions */}
                          {(po.status === 'approved' || po.status === 'partially_received') && (
                            <button
                              onClick={() => handleOpenReceive(po)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1 shadow-xs"
                              title="Receive Stock"
                            >
                              <PackageCheck className="w-3.5 h-3.5" /> Receive Stock
                            </button>
                          )}

                          {/* Cancel action */}
                          {po.status !== 'received' && po.status !== 'cancelled' && po.status !== 'rejected' && (
                            <button
                              onClick={() => {
                                setSelectedOrder(po);
                                setCancelModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Cancel PO (Reason required)"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => fetchOrders(p)}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          PO DETAIL MODAL
      ========================================================================= */}
      {detailModalOpen && selectedOrder && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Purchase Order: ${selectedOrder.orderNumber}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-border">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                <span className="font-semibold text-slate-800">{selectedOrder.supplierId?.name || 'N/A'}</span>
                <span className="text-[11px] text-slate-500 block">{selectedOrder.supplierId?.contactPerson}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <div className="mt-0.5">
                  <Badge status={selectedOrder.status}>{selectedOrder.status.replace('_', ' ').toUpperCase()}</Badge>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Delivery</span>
                <span className="font-semibold text-slate-800">
                  {selectedOrder.expectedDeliveryDate
                    ? new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString()
                    : 'Unscheduled'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimated Cost</span>
                <span className="font-bold text-slate-900 block text-sm">
                  {selectedOrder.estimatedTotalCost !== null && selectedOrder.estimatedTotalCost > 0
                    ? formatCurrency(selectedOrder.estimatedTotalCost)
                    : 'Cost unavailable'}
                </span>
                {(selectedOrder.hasUnknownCost || (selectedOrder.items || []).some((it) => it.unitCost === null || it.unitCost === undefined || it.unitCost === 0)) && (
                  <span className="text-[10px] text-amber-600 block leading-tight">
                    * Excludes items with unavailable cost
                  </span>
                )}
              </div>
            </div>

            {/* Line items table */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Ordered Items</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold">
                      <th className="py-2 px-3">Medicine</th>
                      <th className="py-2 px-3 text-right">Ordered</th>
                      <th className="py-2 px-3 text-right">Received</th>
                      <th className="py-2 px-3 text-right">Remaining</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items?.map((it, idx) => {
                      const rem = Math.max(0, it.quantityOrdered - (it.quantityReceived || 0));
                      const isLineCostUnknown = it.unitCost === null || it.unitCost === undefined || it.unitCost === 0;
                      const lineTotal = !isLineCostUnknown
                        ? Number((it.unitCost * it.quantityOrdered).toFixed(2))
                        : null;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <div>{it.medicineId?.name || 'Medicine'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {it.medicineId?.medicineCode} • {it.medicineId?.unit}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-700">{it.quantityOrdered}</td>
                          <td className="py-2 px-3 text-right font-medium text-emerald-700">{it.quantityReceived || 0}</td>
                          <td className="py-2 px-3 text-right font-medium text-amber-700">{rem}</td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {!isLineCostUnknown ? formatCurrency(it.unitCost) : 'Cost unavailable'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-800">
                            {lineTotal !== null ? formatCurrency(lineTotal) : 'Cost unavailable'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Receipts History */}
            {selectedOrder.receipts && selectedOrder.receipts.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Receipt History</h4>
                <div className="space-y-2">
                  {selectedOrder.receipts.map((rcpt, idx) => (
                    <div key={idx} className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-emerald-800">
                          Receipt ID: {rcpt.receiptId}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(rcpt.receivedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {rcpt.lines?.map((ln, lIdx) => (
                          <div key={lIdx} className="flex justify-between py-0.5 border-t border-emerald-100/50">
                            <span>
                              {ln.medicineId?.name || 'Medicine'} — Batch: <strong>{ln.batchNumber}</strong> (Exp: {new Date(ln.expiryDate).toLocaleDateString()})
                            </span>
                            <span className="font-bold text-emerald-700">+{ln.quantity} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trail / Reasons */}
            {(selectedOrder.cancelReason || selectedOrder.rejectReason) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <span className="font-bold block text-[11px] uppercase">Reason for status</span>
                <p className="mt-0.5">{selectedOrder.cancelReason || selectedOrder.rejectReason}</p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          CREATE PO MODAL
      ========================================================================= */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create Purchase Order"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Supplier *</label>
                <select
                  required
                  value={createForm.supplierId}
                  onChange={(e) => setCreateForm({ ...createForm, supplierId: e.target.value })}
                  className="input-base text-xs py-2 w-full"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.defaultLeadTimeDays || 7}d lead time)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={createForm.expectedDeliveryDate}
                  onChange={(e) => setCreateForm({ ...createForm, expectedDeliveryDate: e.target.value })}
                  className="input-base text-xs py-2 w-full"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-semibold text-slate-700">Line Items *</label>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      items: [...createForm.items, { medicineId: '', quantityOrdered: 100, unitCost: '' }]
                    })
                  }
                  className="text-brand hover:text-brand-dark font-semibold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medicine
                </button>
              </div>

              <div className="space-y-2 border border-border p-3 rounded-lg bg-slate-50/50">
                {createForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      required
                      value={item.medicineId}
                      onChange={(e) => {
                        const newItems = [...createForm.items];
                        newItems[idx].medicineId = e.target.value;
                        setCreateForm({ ...createForm, items: newItems });
                      }}
                      className="input-base text-xs py-1.5 flex-1"
                    >
                      <option value="">-- Select Medicine --</option>
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.medicineCode})
                        </option>
                      ))}
                    </select>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantityOrdered}
                        onChange={(e) => {
                          const newItems = [...createForm.items];
                          newItems[idx].quantityOrdered = e.target.value;
                          setCreateForm({ ...createForm, items: newItems });
                        }}
                        className="input-base text-xs py-1.5 w-full text-right"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unit Cost (₹)"
                        value={item.unitCost}
                        onChange={(e) => {
                          const newItems = [...createForm.items];
                          newItems[idx].unitCost = e.target.value;
                          setCreateForm({ ...createForm, items: newItems });
                        }}
                        className="input-base text-xs py-1.5 w-full text-right"
                      />
                    </div>

                    {createForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = createForm.items.filter((_, i) => i !== idx);
                          setCreateForm({ ...createForm, items: newItems });
                        }}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                * Note: Line costs are recomputed and verified by the server. Unknown costs will show as "Cost unavailable" and be excluded from total calculation.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={actionSubmitting}>
                Save as Draft
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          RECEIVE GOODS MODAL
      ========================================================================= */}
      {receiveModalOpen && selectedOrder && (
        <Modal
          isOpen={receiveModalOpen}
          onClose={() => setReceiveModalOpen(false)}
          title={`Receive Goods — ${selectedOrder.orderNumber}`}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleReceiveSubmit} noValidate className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-semibold text-blue-900 block">Idempotent Delivery Receipt</span>
                <span className="text-[11px] text-blue-700">
                  Transactions create immutable batches & receipt stock movements. Re-submitting the same receipt ID is safe.
                </span>
              </div>
              <div className="font-mono text-[11px] font-bold text-blue-950 bg-white px-2 py-1 rounded border border-blue-300">
                {receiveForm.receiptId}
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold">
                    <th className="py-2 px-3">Medicine</th>
                    <th className="py-2 px-3">Batch Number *</th>
                    <th className="py-2 px-3">Mfg Date *</th>
                    <th className="py-2 px-3">Expiry Date *</th>
                    <th className="py-2 px-3 text-right">Qty to Receive *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receiveForm.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {line.medicineName}
                        <div className="text-[10px] text-slate-400">
                          Remaining: <strong>{line.maxRemaining}</strong>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          value={line.batchNumber}
                          onChange={(e) => {
                            const newLines = [...receiveForm.lines];
                            newLines[idx].batchNumber = e.target.value;
                            setReceiveForm({ ...receiveForm, lines: newLines });
                          }}
                          className="input-base text-xs py-1 w-32"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          required
                          value={line.manufacturingDate}
                          onChange={(e) => {
                            const newLines = [...receiveForm.lines];
                            newLines[idx].manufacturingDate = e.target.value;
                            setReceiveForm({ ...receiveForm, lines: newLines });
                          }}
                          className="input-base text-xs py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          required
                          value={line.expiryDate}
                          onChange={(e) => {
                            const newLines = [...receiveForm.lines];
                            newLines[idx].expiryDate = e.target.value;
                            setReceiveForm({ ...receiveForm, lines: newLines });
                          }}
                          className="input-base text-xs py-1"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="1"
                          max={line.maxRemaining}
                          required
                          value={line.quantity}
                          onChange={(e) => {
                            const newLines = [...receiveForm.lines];
                            newLines[idx].quantity = e.target.value;
                            setReceiveForm({ ...receiveForm, lines: newLines });
                          }}
                          className="input-base text-xs py-1 w-20 text-right font-bold text-emerald-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setReceiveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={actionSubmitting}>
                Confirm Receipt & Commit Stock
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          CANCEL PO MODAL
      ========================================================================= */}
      {cancelModalOpen && selectedOrder && (
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title={`Cancel Purchase Order: ${selectedOrder.orderNumber}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to cancel purchase order <strong>{selectedOrder.orderNumber}</strong>? A valid cancellation reason is required for audit logging.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cancellation Reason *</label>
              <textarea
                required
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g., Supplier unable to fulfill delivery timeline"
                className="input-base text-xs py-2 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="danger"
                loading={actionSubmitting}
                onClick={handleCancelSubmit}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          REJECT PO MODAL
      ========================================================================= */}
      {rejectModalOpen && selectedOrder && (
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title={`Reject Purchase Order: ${selectedOrder.orderNumber}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Rejecting will mark purchase order <strong>{selectedOrder.orderNumber}</strong> as rejected. Please provide a reason for the requisition author.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rejection Reason</label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g., Budget ceiling reached for the current quarter"
                className="input-base text-xs py-2 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="danger"
                loading={actionSubmitting}
                onClick={handleRejectSubmit}
              >
                Reject Order
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
