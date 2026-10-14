import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import CorrectMovementModal from '../components/stockMovements/CorrectMovementModal';
import { stockMovementService } from '../services/stockMovementService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/formatDate';
import { Search, Download, RefreshCw, RotateCcw } from 'lucide-react';

const MOVEMENT_TYPES = [
  { value: '', label: 'All Movement Types' },
  { value: 'receipt', label: 'Receipt (+)' },
  { value: 'dispense', label: 'Dispense (-)' },
  { value: 'return', label: 'Return (+)' },
  { value: 'adjustment', label: 'Adjustment (+/-)' },
  { value: 'write_off', label: 'Write-Off (-)' },
  { value: 'correction', label: 'Correction' },
];

export default function StockMovementsPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const canManage = role === 'admin' || role === 'inventory_manager';

  const [movements, setMovements] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Actions
  const [exporting, setExporting] = useState(false);
  const [selectedForCorrection, setSelectedForCorrection] = useState(null);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await stockMovementService.getStockMovements({
        page,
        limit: 20,
        q: debouncedSearch,
        type: typeFilter || undefined,
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      });
      setMovements(res.data || []);
      setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.error?.message || 'Failed to load stock movement ledger');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, fromDate, toDate]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, fromDate, toDate]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await stockMovementService.exportStockMovementsCsv({
        q: debouncedSearch,
        type: typeFilter || undefined,
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      });
      showToast('Stock movements CSV exported successfully!', 'success');
    } catch (err) {
      showToast(err.error?.message || 'Failed to export CSV', 'error');
    } finally {
      setExporting(false);
    }
  };

  const getMovementBadgeVariant = (type) => {
    switch (type) {
      case 'receipt':
        return 'success';
      case 'dispense':
      case 'write_off':
        return 'critical';
      case 'adjustment':
        return 'warning';
      case 'return':
        return 'info';
      case 'correction':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement History"
        subtitle="Immutable audit ledger recording every receipt, dispensing, return, and adjustment"
      >
        <Button variant="secondary" icon={RefreshCw} onClick={fetchMovements} disabled={loading}>
          Refresh
        </Button>
        {canManage && (
          <Button
            variant="secondary"
            icon={Download}
            onClick={handleExportCsv}
            loading={exporting}
            disabled={loading}
          >
            Export CSV
          </Button>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by medicine, batch, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-xs py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base text-xs py-2 w-auto"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-base text-xs py-1.5 px-2 w-auto"
            />
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-base text-xs py-1.5 px-2 w-auto"
            />
          </div>

          {(fromDate || toDate || typeFilter || search) && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setFromDate('');
                setToDate('');
              }}
              className="text-xs text-brand hover:underline px-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table Area */}
      {loading ? (
        <div className="card-base p-6 space-y-3">
          <Skeleton variant="table-row" count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchMovements} />
      ) : movements.length === 0 ? (
        <EmptyState
          title="No stock movements found"
          description={
            search || typeFilter || fromDate || toDate
              ? 'No ledger movements match the specified filter criteria.'
              : 'The immutable stock ledger currently has no movements logged.'
          }
        />
      ) : (
        <div className="card-base overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold whitespace-nowrap">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Batch No.</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Balance Trail</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Performed By</th>
                  {canManage && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {movements.map((m) => {
                  const isPositive = m.quantityChange > 0;
                  const canCorrect = canManage && m.movementType !== 'correction';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(m.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {m.medicine?.name || 'Unknown'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {m.medicine?.medicineCode || ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {m.batch?.batchNumber || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getMovementBadgeVariant(m.movementType)}>
                          {m.movementType}
                        </Badge>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          isPositive ? 'text-status-success' : 'text-status-critical'
                        }`}
                      >
                        {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium whitespace-nowrap">
                        {m.balanceBefore} →{' '}
                        <strong className="text-slate-900">{m.balanceAfter}</strong>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={m.reason}>
                        {m.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-800">
                          {m.performedBy?.name || 'System'}
                        </span>
                        {m.performedBy?.role && (
                          <span className="text-[10px] text-slate-400 block capitalize">
                            {m.performedBy.role.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canCorrect && (
                            <button
                              onClick={() => setSelectedForCorrection(m)}
                              className="text-slate-400 hover:text-brand hover:bg-blue-50 p-1.5 rounded transition-colors inline-flex items-center gap-1"
                              title="Post compensating ledger correction"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium hidden sm:inline">Correct</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/40">
            <span className="text-xs text-slate-500">
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total movements)
            </span>
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      )}

      {/* Compensating Correction Modal */}
      <CorrectMovementModal
        isOpen={!!selectedForCorrection}
        onClose={() => setSelectedForCorrection(null)}
        movement={selectedForCorrection}
        onSuccess={fetchMovements}
      />
    </div>
  );
}
