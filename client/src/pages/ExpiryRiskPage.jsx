import React, { useState, useEffect } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import Pagination from '../components/common/Pagination';
import { Download, AlertTriangle, DollarSign, Info, ShieldAlert, ChevronRight } from 'lucide-react';
import { expiryService } from '../services/expiryService';

export default function ExpiryRiskPage() {
  const [windowDays, setWindowDays] = useState('30');
  const [riskLevel, setRiskLevel] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: { estimatedWastageUnits: 0, estimatedValueAtRisk: 0, disclaimer: '' },
    batches: []
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const fetchExpiryRisk = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await expiryService.getExpiryRisk({
        windowDays: Number(windowDays),
        riskLevel: riskLevel === 'all' ? null : riskLevel,
        page,
        limit
      });
      setData(res.data || { summary: {}, batches: [] });
      setMeta(res.meta || { page, limit, total: res.data?.batches?.length || 0, totalPages: 1 });
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to load expiry risk data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryRisk();
  }, [windowDays, riskLevel, page]);

  const handleWindowChange = (newWindow) => {
    setWindowDays(newWindow);
    setPage(1);
  };

  const handleRiskChange = (newRisk) => {
    setRiskLevel(newRisk);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Risk Simulation"
        subtitle="FEFO-allocated inventory consumption simulation across usable batches and incoming lots"
      >
        <div className="flex items-center gap-2">
          {/* Horizon Tabs (7, 30, 60, 90) */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            {['7', '30', '60', '90'].map((d) => (
              <button
                key={d}
                onClick={() => handleWindowChange(d)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  windowDays === d ? 'bg-white shadow text-brand font-bold' : 'hover:text-slate-900'
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* Top Filter and Disclaimer */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Risk Severity Filter:</label>
          <select
            value={riskLevel}
            onChange={(e) => handleRiskChange(e.target.value)}
            className="input-base text-xs py-1.5 w-40 font-medium"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 italic flex items-center gap-1.5">
          <Info className="w-4 h-4 text-brand" />
          <span>{data.summary?.disclaimer || 'Estimated — based on forecasts and assumptions, not guaranteed.'}</span>
        </div>
      </div>

      {errorMessage && (
        <ErrorState
          title="Could not load expiry risk data"
          message={errorMessage}
          onRetry={fetchExpiryRisk}
        />
      )}

      {/* Batches Table */}
      {loading ? (
        <div className="card-base p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : data.batches.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No At-Risk Batches Found"
          description={`No usable batches are projected to expire unused within the ${windowDays}-day review window under current FEFO demand projections.`}
        />
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4">Batch No.</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Days Left</th>
                  <th className="py-3 px-4 text-right">Usable Qty</th>
                  <th className="py-3 px-4 text-right">Est. Consumed</th>
                  <th className="py-3 px-4 text-right">Est. Leftover</th>
                  <th className="py-3 px-4 text-right">Leftover %</th>
                  <th className="py-3 px-4 text-center">Risk Level</th>
                  <th className="py-3 px-4 text-right">Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.batches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div>{b.medicineName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{b.medicineCode}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{b.batchNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{b.expiryDate}</td>
                    <td className={`py-3 px-4 text-right font-bold ${b.daysLeft <= 14 ? 'text-status-critical' : 'text-slate-700'}`}>
                      {b.daysLeft}d
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">{b.currentQuantity}</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-medium">{b.expectedConsumed}</td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700">{b.expectedLeftover}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{b.leftoverPct}%</td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={b.riskLevel}>{b.riskLevel}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedBatch(b)}
                      >
                        Why flagged?
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {meta.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-slate-50/40">
              <span className="text-xs text-slate-500" data-testid="pagination-count">
                Showing {Math.min((meta.page - 1) * limit + 1, meta.total)}-{Math.min(meta.page * limit, meta.total)} of {meta.total} batches
              </span>
              <Pagination
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </div>
      )}

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-base p-5 flex items-center gap-4 border-l-4 border-status-warning">
          <div className="p-3 rounded-xl bg-status-warning/10 text-status-warning flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">
              Estimated Wastage (All batches in {windowDays}d window)
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {data.summary?.estimatedWastageUnits ?? 0} units
            </div>
          </div>
        </div>

        <div className="card-base p-5 flex items-center gap-4 border-l-4 border-brand">
          <div className="p-3 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">
              Estimated Value at Risk (All batches in {windowDays}d window)
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              ${Number(data.summary?.estimatedValueAtRisk ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Why Flagged Details Modal */}
      {selectedBatch && (
        <Modal
          isOpen={Boolean(selectedBatch)}
          onClose={() => setSelectedBatch(null)}
          title={`Expiry Risk Simulation — Batch ${selectedBatch.batchNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-border flex justify-between items-center">
              <div>
                <div className="font-bold text-sm text-slate-900">{selectedBatch.medicineName}</div>
                <div className="text-slate-500">Expires: {selectedBatch.expiryDate} ({selectedBatch.daysLeft} days remaining)</div>
              </div>
              <Badge status={selectedBatch.riskLevel}>{selectedBatch.riskLevel}</Badge>
            </div>

            <div>
              <div className="font-bold text-slate-800 mb-1.5">Simulation Factual Reasons:</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                {selectedBatch.reasons?.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-800 mb-1.5">Suggested Inventory Actions (Non-Clinical):</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                {selectedBatch.suggestedActions?.map((act, idx) => (
                  <li key={idx} className="font-medium text-brand">{act}</li>
                ))}
              </ul>
            </div>

            {selectedBatch.confidenceNote ? (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]" data-testid="confidence-note">
                ⚠️ {selectedBatch.confidenceNote}
              </div>
            ) : selectedBatch.extrapolated ? (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]" data-testid="confidence-note">
                ⚠️ Estimate extrapolated beyond forecast horizon — lower confidence.
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedBatch(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
