import React, { useState, useEffect } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import Pagination from '../components/common/Pagination';
import { Package, DollarSign, Sparkles, RefreshCw, CheckCircle, XCircle, Edit3, HelpCircle } from 'lucide-react';
import { reorderService } from '../services/reorderService';

export default function ReordersPage() {
  const [data, setData] = useState({
    summary: { totalSuggestedUnits: 0, estimatedCost: 0 },
    recommendations: []
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modals state
  const [whyModalRec, setWhyModalRec] = useState(null);
  const [adjustModalRec, setAdjustModalRec] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [rejectModalRec, setRejectModalRec] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await reorderService.getRecommendations({
        status: statusFilter === 'all' ? null : statusFilter,
        page,
        limit
      });
      setData(res.data || { summary: {}, recommendations: [] });
      setMeta(res.meta || { page, limit, total: res.data?.recommendations?.length || 0, totalPages: 1 });
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [statusFilter, page]);

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await reorderService.generateRecommendations();
      setSuccessMessage(res.data?.message || 'Generated reorder recommendations.');
      await fetchRecommendations();
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to generate recommendations.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (recId) => {
    try {
      setSubmittingAction(true);
      setErrorMessage(null);
      const res = await reorderService.approveRecommendation(recId);
      const poNum = res.data?.purchaseOrder?.orderNumber || 'Draft PO';
      setSuccessMessage(`Recommendation approved! Draft purchase order ${poNum} created.`);
      await fetchRecommendations();
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to approve recommendation.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalRec) return;
    try {
      setSubmittingAction(true);
      await reorderService.rejectRecommendation(rejectModalRec.id, rejectReason);
      setSuccessMessage('Recommendation rejected.');
      setRejectModalRec(null);
      setRejectReason('');
      await fetchRecommendations();
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to reject recommendation.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModalRec) return;
    try {
      setSubmittingAction(true);
      await reorderService.adjustRecommendation(adjustModalRec.id, Number(adjustQty), adjustNote);
      setSuccessMessage('Recommendation quantity adjusted.');
      setAdjustModalRec(null);
      setAdjustQty('');
      setAdjustNote('');
      await fetchRecommendations();
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to adjust recommendation.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reorder Recommendations"
        subtitle="Explainable replenishment triggers reviewable before Draft Purchase Order creation"
      >
        <Button
          variant="primary"
          icon={Sparkles}
          loading={generating}
          onClick={handleGenerate}
        >
          Evaluate Reorders
        </Button>
      </PageHeader>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-base p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-brand flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Suggested Order</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {data.summary?.totalSuggestedUnits ?? 0} units
            </div>
          </div>
        </div>

        <div className="card-base p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Estimated Replenishment Cost</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              ${Number(data.summary?.estimatedCost ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-base p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="input-base text-xs py-1.5 w-40 font-medium"
          >
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="adjusted">Adjusted</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchRecommendations}>
          Refresh
        </Button>
      </div>

      {/* Recommendations Table */}
      {loading ? (
        <div className="card-base p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : data.recommendations.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Reorders Pending"
          description="All medicine inventory positions currently satisfy lead time demand and safety buffers. Click Evaluate Reorders to trigger a fresh check."
          actionLabel="Evaluate Reorders"
          onAction={handleGenerate}
        />
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4 text-right">Usable Stock</th>
                  <th className="py-3 px-4 text-right">Lead Time Demand</th>
                  <th className="py-3 px-4 text-right">Safety Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Point</th>
                  <th className="py-3 px-4 text-right">Incoming Confirmed</th>
                  <th className="py-3 px-4 text-right">Suggested Order</th>
                  <th className="py-3 px-4">Preferred Supplier</th>
                  <th className="py-3 px-4 text-right">Est. Cost</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recommendations.map((r) => {
                  const finalQty = r.adjustedQuantity || r.suggestedQuantity;
                  const canAct = r.status === 'pending' || r.status === 'adjusted';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <div>{r.medicineId?.name || 'Unknown Medicine'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.medicineId?.medicineCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {r.inputs?.usableStock}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {r.inputs?.forecastLeadTimeDemand}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {r.inputs?.safetyStock}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700">
                        {r.inputs?.reorderPoint}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {r.inputs?.incomingConfirmed > 0 ? (
                          <span className="text-emerald-700">+{r.inputs.incomingConfirmed}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-brand text-sm">
                        {finalQty} {r.medicineId?.unit || 'units'}
                        {r.adjustedQuantity && (
                          <div className="text-[10px] text-amber-600 font-normal">
                            (orig: {r.suggestedQuantity})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {r.preferredSupplier?.name || 'Default Supplier'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {r.estimatedCost !== null ? `$${r.estimatedCost}` : 'Cost unavailable'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge status={r.status}>{r.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={HelpCircle}
                            onClick={() => setWhyModalRec(r)}
                            title="Why this quantity?"
                          >
                            Why?
                          </Button>
                          {canAct && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={submittingAction}
                                onClick={() => handleApprove(r.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit3}
                                disabled={submittingAction}
                                onClick={() => {
                                  setAdjustModalRec(r);
                                  setAdjustQty(finalQty);
                                  setAdjustNote('');
                                }}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={XCircle}
                                disabled={submittingAction}
                                onClick={() => {
                                  setRejectModalRec(r);
                                  setRejectReason('');
                                }}
                              />
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
          {meta.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-slate-50/40">
              <span className="text-xs text-slate-500" data-testid="pagination-count">
                Showing {Math.min((meta.page - 1) * limit + 1, meta.total)}-{Math.min(meta.page * limit, meta.total)} of {meta.total} recommendations
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

      {/* "Why this quantity?" Formula Modal */}
      {whyModalRec && (
        <Modal
          isOpen={Boolean(whyModalRec)}
          onClose={() => setWhyModalRec(null)}
          title={`Reorder Formula Breakdown — ${whyModalRec.medicineId?.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-slate-800 leading-relaxed font-mono">
              {whyModalRec.formulaText}
            </div>

            <div>
              <div className="font-bold text-slate-800 mb-2">Mathematical Inputs:</div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-3 rounded-xl border border-border">
                <div>Usable Stock: <b className="text-slate-900">{whyModalRec.inputs?.usableStock}</b></div>
                <div>Avg Daily Demand: <b className="text-slate-900">{whyModalRec.inputs?.avgDailyDemand}</b></div>
                <div>Supplier Lead Time: <b className="text-slate-900">{whyModalRec.inputs?.leadTimeDays} days</b></div>
                <div>Lead Time Demand: <b className="text-slate-900">{whyModalRec.inputs?.forecastLeadTimeDemand}</b></div>
                <div>Safety Stock: <b className="text-slate-900">{whyModalRec.inputs?.safetyStock}</b></div>
                <div>Reorder Point: <b className="text-slate-900">{whyModalRec.inputs?.reorderPoint}</b></div>
                <div>Target Coverage: <b className="text-slate-900">{whyModalRec.inputs?.targetCoverageDays} days</b></div>
                <div>Min Order Qty (MOQ): <b className="text-slate-900">{whyModalRec.inputs?.minOrderQty || 'None'}</b></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setWhyModalRec(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjust Quantity Modal */}
      {adjustModalRec && (
        <Modal
          isOpen={Boolean(adjustModalRec)}
          onClose={() => setAdjustModalRec(null)}
          title={`Adjust Reorder Quantity — ${adjustModalRec.medicineId?.name}`}
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Order Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="input-base text-sm py-2 w-full font-bold text-brand"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Adjustment Note / Justification</label>
              <textarea
                rows="3"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g., Increased order due to planned local health camp"
                className="input-base text-xs py-2 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setAdjustModalRec(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submittingAction}>
                Save Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModalRec && (
        <Modal
          isOpen={Boolean(rejectModalRec)}
          onClose={() => setRejectModalRec(null)}
          title={`Reject Reorder — ${rejectModalRec.medicineId?.name}`}
        >
          <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Rejection</label>
              <textarea
                rows="3"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Sufficient buffer available from alternate dispensary branch"
                className="input-base text-xs py-2 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setRejectModalRec(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submittingAction}>
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
