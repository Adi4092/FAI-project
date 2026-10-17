import React, { useState, useEffect } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import { TrendingDown, ShoppingBag, Search, AlertCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stockoutService } from '../services/stockoutService';

export default function StockoutPage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await stockoutService.getStockoutPredictions({
        riskLevel: riskFilter === 'all' ? null : riskFilter,
        q: searchQuery,
        page,
        limit
      });
      setPredictions(res.data || []);
      setMeta(res.meta || { page, limit, total: res.data?.length || 0, totalPages: 1 });
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to load stockout predictions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [riskFilter, page]);

  const handleFilterChange = (newRisk) => {
    setRiskFilter(newRisk);
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPredictions();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockout Predictions"
        subtitle="Simulated stock depletion timelines based on lead times, safety stocks, confirmed incoming purchase orders, and forecasted demand"
      >
        <Button variant="primary" icon={ShoppingBag} onClick={() => navigate('/reorders')}>
          Review Reorders
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search medicine name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 text-xs py-2 w-full"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Risk Severity:</label>
          <select
            value={riskFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="input-base text-xs py-1.5 w-40 font-medium"
          >
            <option value="all">All Risks</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {errorMessage && (
        <ErrorState
          title="Failed to load stockout predictions"
          message={errorMessage}
          onRetry={fetchPredictions}
        />
      )}

      {/* Predictions Table */}
      {loading ? (
        <div className="card-base p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : predictions.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No Stockout Risks Detected"
          description="All active medicines have sufficient inventory to cover supplier replenishment lead times and safety stocks."
        />
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Medicine</th>
                  <th className="py-3 px-4 text-right">Usable Stock</th>
                  <th className="py-3 px-4 text-right">Lead Time (L)</th>
                  <th className="py-3 px-4 text-right">Forecast Demand (L)</th>
                  <th className="py-3 px-4 text-right">Safety Stock</th>
                  <th className="py-3 px-4 text-right">Days to Stockout</th>
                  <th className="py-3 px-4 text-right">Incoming POs</th>
                  <th className="py-3 px-4 text-center">Risk Level</th>
                  <th className="py-3 px-4">Explanation & Recommended Action</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {predictions.map((p) => (
                  <tr key={p.medicineId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div>{p.medicineName}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{p.medicineCode}</span>
                        {p.isFallbackRule && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-sans text-[9px] font-bold">
                            Fallback Rule
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {p.currentUsableStock} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 font-medium">
                      {p.leadTimeDays}d
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {p.forecastLeadTimeDemand}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-medium">
                      {p.safetyStock}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        p.daysUntilStockout !== null && p.daysUntilStockout <= p.leadTimeDays
                          ? 'text-status-critical'
                          : 'text-slate-800'
                      }`}
                    >
                      {p.daysUntilStockout !== null ? `${p.daysUntilStockout} days` : 'Healthy'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">
                      {p.incomingConfirmedQuantity > 0 ? (
                        <span className="text-emerald-700 font-bold">+{p.incomingConfirmedQuantity}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={p.riskLevel}>{p.riskLevel}</Badge>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-slate-700 leading-relaxed">{p.explanation}</div>
                      <div className="text-brand font-semibold text-[11px] mt-0.5">
                        👉 {p.recommendedAction}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.riskLevel === 'critical' || p.riskLevel === 'high' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate('/reorders')}
                        >
                          Reorder
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate('/reorders')}
                        >
                          View
                        </Button>
                      )}
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
                Showing {Math.min((meta.page - 1) * limit + 1, meta.total)}-{Math.min(meta.page * limit, meta.total)} of {meta.total} predictions
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
    </div>
  );
}
