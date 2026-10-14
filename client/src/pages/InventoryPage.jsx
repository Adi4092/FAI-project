import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import ReceiveStockModal from '../components/inventory/ReceiveStockModal';
import DispenseModal from '../components/inventory/DispenseModal';
import AdjustStockModal from '../components/inventory/AdjustStockModal';
import WriteOffModal from '../components/inventory/WriteOffModal';
import BatchHistoryModal from '../components/inventory/BatchHistoryModal';
import { batchService } from '../services/batchService';
import { inventoryService } from '../services/inventoryService';
import { medicineService } from '../services/medicineService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/formatDate';
import {
  Plus,
  Search,
  ArrowUpFromLine,
  RefreshCw,
  Eye,
  Sliders,
  AlertOctagon,
  Boxes,
  ShieldCheck,
} from 'lucide-react';

export default function InventoryPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const canManage = role === 'admin' || role === 'inventory_manager';
  const isAdmin = role === 'admin';

  // Tabs: 'usable' (status=active) vs 'expired' (status=expired,quarantined)
  const [activeTab, setActiveTab] = useState('usable');

  // Summary KPIs
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Batches table state
  const [batches, setBatches] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [medicineFilter, setMedicineFilter] = useState('');
  const [expiryStatusFilter, setExpiryStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Medicine list for dropdown filter
  const [medicines, setMedicines] = useState([]);

  // Modals state
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [adjustTargetBatch, setAdjustTargetBatch] = useState(null);
  const [writeOffTargetBatch, setWriteOffTargetBatch] = useState(null);
  const [historyTargetBatch, setHistoryTargetBatch] = useState(null);

  // Reconcile status
  const [reconciling, setReconciling] = useState(false);

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await inventoryService.getInventorySummary();
      setSummary(res.data);
    } catch {
      // Ignore summary failure
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch Medicines for dropdown
  useEffect(() => {
    medicineService
      .getMedicines({ limit: 100, status: 'active' })
      .then((res) => setMedicines(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch Batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 15,
        q: debouncedSearch,
        medicineId: medicineFilter || undefined,
        expiryStatus: expiryStatusFilter !== 'all' ? expiryStatusFilter : undefined,
        status: activeTab === 'usable' ? 'active' : 'expired',
      };

      const res = await batchService.getBatches(params);
      setBatches(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.error?.message || 'Failed to load inventory batches');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, medicineFilter, expiryStatusFilter, activeTab]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, medicineFilter, expiryStatusFilter, activeTab]);

  const handleRefreshAll = () => {
    fetchSummary();
    fetchBatches();
  };

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await inventoryService.reconcileInventory();
      if (res.data?.reconciled) {
        showToast(
          `Reconciliation complete: ${res.data.totalBatchesChecked} batches verified with 0 ledger mismatches!`,
          'success'
        );
      } else {
        showToast(
          `Reconciliation found ${res.data?.mismatches?.length || 0} discrepancy records`,
          'warning'
        );
      }
      fetchSummary();
      fetchBatches();
    } catch (err) {
      showToast(err.error?.message || 'Reconciliation failed', 'error');
    } finally {
      setReconciling(false);
    }
  };

  const getBatchBadge = (batch) => {
    if (batch.isExpired || batch.status === 'expired') {
      return { label: 'Expired', status: 'expired' };
    }
    if (batch.currentQuantity === 0) {
      return { label: 'Depleted', status: 'neutral' };
    }
    if (batch.daysToExpiry <= 30) {
      return { label: 'Expiring Soon', status: 'expiring' };
    }
    return { label: 'Healthy', status: 'healthy' };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch & Inventory Management"
        subtitle="Track stock levels by batch with immutable ledger and FEFO enforcement"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={handleRefreshAll} disabled={loading}>
          Refresh
        </Button>
        {isAdmin && (
          <Button
            variant="secondary"
            icon={ShieldCheck}
            onClick={handleReconcile}
            loading={reconciling}
            title="Verify every batch quantity matches the sum of its immutable ledger movements"
          >
            Reconcile Ledger
          </Button>
        )}
        <Button variant="secondary" icon={ArrowUpFromLine} onClick={() => setIsDispenseOpen(true)}>
          Dispense Stock (FEFO)
        </Button>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setIsReceiveOpen(true)}>
            + Receive Stock
          </Button>
        )}
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-base p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Usable Units
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summaryLoading ? '—' : summary?.totalUsableUnits?.toLocaleString() ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Active, non-expired stock</span>
        </div>

        <div className="card-base p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Expired Units
          </span>
          <div className="text-2xl font-bold text-status-critical mt-1">
            {summaryLoading ? '—' : summary?.totalExpiredUnits?.toLocaleString() ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Quarantined / Discard required</span>
        </div>

        <div className="card-base p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Batches
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summaryLoading ? '—' : summary?.totalActiveBatches?.toLocaleString() ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Distinct batch lots in storage</span>
        </div>

        <div className="card-base p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Expiring Within 30d
          </span>
          <div className="text-2xl font-bold text-status-warning mt-1">
            {summaryLoading ? '—' : summary?.batchesExpiringWithin30Days?.toLocaleString() ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Requires priority FEFO dispatch</span>
        </div>
      </div>

      {/* Usable vs Expired Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('usable')}
          className={`pb-3 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'usable'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Usable Stock (Active Batches)
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`pb-3 text-xs font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === 'expired'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-status-critical" />
          Expired & Quarantined Batches
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search batches, batch no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={medicineFilter}
            onChange={(e) => setMedicineFilter(e.target.value)}
            className="input-base text-xs py-2 w-auto max-w-xs"
          >
            <option value="">All Medicines</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.medicineCode})
              </option>
            ))}
          </select>

          {activeTab === 'usable' && (
            <select
              value={expiryStatusFilter}
              onChange={(e) => setExpiryStatusFilter(e.target.value)}
              className="input-base text-xs py-2 w-auto"
            >
              <option value="all">All Expiry Status</option>
              <option value="healthy">Healthy Stock</option>
              <option value="expiring">Expiring Soon (≤30d)</option>
            </select>
          )}
        </div>
      </div>

      {/* Batches Table */}
      {loading ? (
        <div className="card-base p-6 space-y-3">
          <Skeleton variant="table-row" count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchBatches} />
      ) : batches.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'usable'
              ? 'No active batches found'
              : 'No expired batches currently quarantined'
          }
          description={
            search || medicineFilter || expiryStatusFilter !== 'all'
              ? 'No batches match your selected search criteria.'
              : activeTab === 'usable'
              ? 'There are currently no active batches in storage. Receive incoming stock to get started.'
              : 'Great job! There are zero expired or quarantined batches in the system.'
          }
          actionLabel={canManage && activeTab === 'usable' && !search ? '+ Receive Stock' : undefined}
          onAction={canManage && activeTab === 'usable' && !search ? () => setIsReceiveOpen(true) : undefined}
        />
      ) : (
        <div className="card-base overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold whitespace-nowrap">
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4 text-right">Available Qty</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Days to Expiry</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {batches.map((b) => {
                  const badgeInfo = getBatchBadge(b);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {b.medicineId?.name || 'Unknown'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {b.medicineId?.medicineCode || ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {b.batchNumber}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {b.currentQuantity}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(b.expiryDate)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            b.isExpired || b.daysToExpiry < 0
                              ? 'text-status-critical'
                              : b.daysToExpiry <= 30
                              ? 'text-status-warning'
                              : 'text-slate-600'
                          }`}
                        >
                          {b.isExpired || b.daysToExpiry < 0
                            ? 'Expired'
                            : `${b.daysToExpiry} days`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {b.supplierId?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge status={badgeInfo.status}>{badgeInfo.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          <button
                            onClick={() => setHistoryTargetBatch(b)}
                            className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                            title="View ledger history"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => setAdjustTargetBatch(b)}
                                className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                                title="Adjust stock count"
                              >
                                <Sliders className="w-4 h-4" />
                              </button>
                              {b.currentQuantity > 0 && (
                                <button
                                  onClick={() => setWriteOffTargetBatch(b)}
                                  className="hover:text-status-critical hover:bg-red-50 p-1.5 rounded transition-colors"
                                  title="Write off batch"
                                >
                                  <AlertOctagon className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/40">
            <span className="text-xs text-slate-500">
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total batches)
            </span>
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      <ReceiveStockModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        onSuccess={handleRefreshAll}
      />

      {/* FEFO Dispense Modal */}
      <DispenseModal
        isOpen={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        onSuccess={handleRefreshAll}
      />

      {/* Adjust Modal */}
      <AdjustStockModal
        isOpen={!!adjustTargetBatch}
        onClose={() => setAdjustTargetBatch(null)}
        batch={adjustTargetBatch}
        onSuccess={handleRefreshAll}
      />

      {/* Write Off Modal */}
      <WriteOffModal
        isOpen={!!writeOffTargetBatch}
        onClose={() => setWriteOffTargetBatch(null)}
        batch={writeOffTargetBatch}
        onSuccess={handleRefreshAll}
      />

      {/* Ledger History Modal */}
      <BatchHistoryModal
        isOpen={!!historyTargetBatch}
        onClose={() => setHistoryTargetBatch(null)}
        batch={historyTargetBatch}
      />
    </div>
  );
}
