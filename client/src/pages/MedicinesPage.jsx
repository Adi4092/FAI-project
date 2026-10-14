import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import ConfirmDialog from '../components/common/ConfirmDialog';
import MedicineFormModal from '../components/medicines/MedicineFormModal';
import MedicineDetailModal from '../components/medicines/MedicineDetailModal';
import { medicineService } from '../services/medicineService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { Plus, Search, Eye, Edit2, Archive, RefreshCw, Pill } from 'lucide-react';

export default function MedicinesPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const canManage = role === 'admin' || role === 'inventory_manager';

  const [medicines, setMedicines] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [detailMedicine, setDetailMedicine] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await medicineService.getMedicines({
        page,
        limit: 15,
        q: debouncedSearch,
        category: category || undefined,
        status,
        lowStock: lowStockOnly ? 'true' : undefined,
      });
      setMedicines(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.error?.message || 'Failed to load medicines from server');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, category, status, lowStockOnly]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, status, lowStockOnly]);

  const handleOpenAdd = () => {
    setSelectedMedicine(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (med) => {
    setSelectedMedicine(med);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (med) => {
    setDetailMedicine(med);
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      setArchiveLoading(true);
      const newStatus = !archiveTarget.isActive;
      await medicineService.updateMedicineStatus(archiveTarget.id, newStatus);
      showToast(
        newStatus ? 'Medicine reactivated successfully' : 'Medicine archived successfully',
        'success'
      );
      setArchiveTarget(null);
      fetchMedicines();
    } catch (err) {
      showToast(err.error?.message || 'Failed to update medicine status', 'error');
    } finally {
      setArchiveLoading(false);
    }
  };

  const getStockStatus = (med) => {
    if (!med.isActive) return { label: 'Archived', status: 'neutral' };
    const stock = med.usableStock ?? 0;
    const reorder = med.reorderLevel ?? 0;
    if (stock === 0) return { label: 'Stockout', status: 'critical' };
    if (stock <= reorder) return { label: 'Low Stock', status: 'warning' };
    return { label: 'Healthy', status: 'healthy' };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Catalogue"
        subtitle="Manage medicine master data, active units, and replenishment thresholds"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={fetchMedicines} disabled={loading}>
          Refresh
        </Button>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            + Add Medicine
          </Button>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-base text-xs py-2 w-auto"
          >
            <option value="">All Categories</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Analgesic">Analgesic</option>
            <option value="NSAID">NSAID</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="PPI">PPI</option>
            <option value="Antihypertensive">Antihypertensive</option>
            <option value="Antihistamine">Antihistamine</option>
            <option value="Respiratory">Respiratory</option>
            <option value="Antiviral">Antiviral</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-base text-xs py-2 w-auto"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Archived Only</option>
            <option value="all">All Status</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium px-2 py-1.5 rounded-lg border border-border bg-slate-50 cursor-pointer hover:bg-slate-100 select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-brand focus:ring-brand/20 w-3.5 h-3.5"
            />
            <span>Low Stock Alert</span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card-base p-6 space-y-3">
          <Skeleton variant="table-row" count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchMedicines} />
      ) : medicines.length === 0 ? (
        <EmptyState
          title="No medicines found"
          description={
            search || category || status !== 'active' || lowStockOnly
              ? 'Try adjusting your search filters to find what you are looking for.'
              : 'The medicine catalogue is currently empty. Get started by adding your first medicine.'
          }
          actionLabel={canManage && !search ? '+ Add Medicine' : undefined}
          onAction={canManage && !search ? handleOpenAdd : undefined}
        />
      ) : (
        <div className="card-base overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold whitespace-nowrap">
                  <th className="py-3 px-4">Medicine Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Dosage Unit</th>
                  <th className="py-3 px-4 text-right">Usable Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Level</th>
                  <th className="py-3 px-4 text-center">Active Batches</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {medicines.map((med) => {
                  const stockStatus = getStockStatus(med);
                  const isLow = (med.usableStock ?? 0) <= (med.reorderLevel ?? 0);
                  return (
                    <tr
                      key={med.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-default"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand flex items-center justify-center flex-shrink-0">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{med.name}</span>
                              {med.isDemo && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 font-normal px-1.5 py-0.2 rounded">
                                  Demo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {med.medicineCode}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">{med.category}</td>
                      <td className="py-3 px-4 text-slate-600 capitalize">{med.unit}</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-bold ${
                            isLow && med.isActive ? 'text-status-critical' : 'text-slate-900'
                          }`}
                        >
                          {med.usableStock ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {med.reorderLevel}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {med.totalBatches ?? 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge status={stockStatus.status}>{stockStatus.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          <button
                            onClick={() => handleOpenDetail(med)}
                            className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                            title="View batch details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(med)}
                                className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                                title="Edit medicine"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setArchiveTarget(med)}
                                className={`p-1.5 rounded transition-colors ${
                                  med.isActive
                                    ? 'hover:text-status-critical hover:bg-red-50'
                                    : 'hover:text-status-success hover:bg-green-50'
                                }`}
                                title={med.isActive ? 'Archive medicine' : 'Reactivate medicine'}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
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
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total medicines)
            </span>
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <MedicineFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        medicine={selectedMedicine}
        onSuccess={fetchMedicines}
      />

      {/* View Detail Modal */}
      <MedicineDetailModal
        isOpen={!!detailMedicine}
        onClose={() => setDetailMedicine(null)}
        medicine={detailMedicine}
      />

      {/* Archive / Reactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        loading={archiveLoading}
        title={
          archiveTarget?.isActive
            ? `Archive Medicine — ${archiveTarget?.medicineCode}`
            : `Reactivate Medicine — ${archiveTarget?.medicineCode}`
        }
        message={
          archiveTarget?.isActive
            ? `Are you sure you want to archive "${archiveTarget?.name}"? Archived medicines will be hidden from everyday dispensing and replenishment workflows unless active batches remain.`
            : `Reactivate "${archiveTarget?.name}" to make it available for orders, receiving, and dispensing.`
        }
        confirmText={archiveTarget?.isActive ? 'Archive Medicine' : 'Reactivate'}
        variant={archiveTarget?.isActive ? 'danger' : 'primary'}
      />
    </div>
  );
}
