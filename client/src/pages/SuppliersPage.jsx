import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SupplierFormModal from '../components/suppliers/SupplierFormModal';
import SupplierDetailModal from '../components/suppliers/SupplierDetailModal';
import { supplierService } from '../services/supplierService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { Plus, Search, RefreshCw, Eye, Edit2, Archive, Truck, Mail, Phone } from 'lucide-react';

export default function SuppliersPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const canManage = role === 'admin' || role === 'inventory_manager';

  const [suppliers, setSuppliers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await supplierService.getSuppliers({
        page,
        limit: 15,
        q: debouncedSearch,
        isActive: statusFilter === 'all' ? undefined : statusFilter,
      });
      setSuppliers(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.error?.message || 'Failed to load suppliers from server');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setSelectedSupplier(sup);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (sup) => {
    setDetailSupplier(sup);
  };

  const handleConfirmToggleStatus = async () => {
    if (!archiveTarget) return;
    try {
      setArchiveLoading(true);
      const newStatus = !archiveTarget.isActive;
      await supplierService.updateSupplierStatus(archiveTarget.id, newStatus);
      showToast(
        newStatus ? 'Supplier reactivated successfully' : 'Supplier deactivated successfully',
        'success'
      );
      setArchiveTarget(null);
      fetchSuppliers();
    } catch (err) {
      showToast(err.error?.message || 'Failed to update supplier status', 'error');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Management"
        subtitle="Maintain vendor records, contracted lead times, and catalogue procurement links"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={fetchSuppliers} disabled={loading}>
          Refresh
        </Button>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            + Add Supplier
          </Button>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base text-xs py-2 w-auto"
          >
            <option value="all">All Vendors</option>
            <option value="true">Active Vendors</option>
            <option value="false">Inactive Vendors</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="card-base p-6 space-y-3">
          <Skeleton variant="table-row" count={5} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSuppliers} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description={
            search || statusFilter !== 'all'
              ? 'No vendor records match your query.'
              : 'No suppliers registered yet. Register your contracted pharmaceutical distributors.'
          }
          actionLabel={canManage && !search ? '+ Add Supplier' : undefined}
          onAction={canManage && !search ? handleOpenAdd : undefined}
        />
      ) : (
        <div className="card-base overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold whitespace-nowrap">
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4 text-center">Lead Time</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-brand flex items-center justify-center flex-shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          {s.address && (
                            <div className="text-[11px] text-slate-400 max-w-xs truncate">
                              {s.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {s.contactPerson || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {s.email && (
                          <div className="text-slate-600 flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{s.email}</span>
                          </div>
                        )}
                        {s.phone && (
                          <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {!s.email && !s.phone && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-800">
                      {s.defaultLeadTimeDays} days
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={s.isActive ? 'active' : 'neutral'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button
                          onClick={() => handleOpenDetail(s)}
                          className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                          title="View supplier details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors"
                              title="Edit supplier"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setArchiveTarget(s)}
                              className={`p-1.5 rounded transition-colors ${
                                s.isActive
                                  ? 'hover:text-status-critical hover:bg-red-50'
                                  : 'hover:text-status-success hover:bg-green-50'
                              }`}
                              title={s.isActive ? 'Deactivate supplier' : 'Reactivate supplier'}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/40">
            <span className="text-xs text-slate-500">
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total vendors)
            </span>
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        supplier={selectedSupplier}
        onSuccess={fetchSuppliers}
      />

      {/* Supplier Detail Modal */}
      <SupplierDetailModal
        isOpen={!!detailSupplier}
        onClose={() => setDetailSupplier(null)}
        supplier={detailSupplier}
      />

      {/* Status Toggle Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmToggleStatus}
        loading={archiveLoading}
        title={
          archiveTarget?.isActive
            ? `Deactivate Supplier — ${archiveTarget?.name}`
            : `Reactivate Supplier — ${archiveTarget?.name}`
        }
        message={
          archiveTarget?.isActive
            ? `Are you sure you want to deactivate "${archiveTarget?.name}"? Inactive suppliers cannot be selected for new stock receipts or purchase orders.`
            : `Reactivate "${archiveTarget?.name}" to make this vendor available for procurement.`
        }
        confirmText={archiveTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={archiveTarget?.isActive ? 'danger' : 'primary'}
      />
    </div>
  );
}
