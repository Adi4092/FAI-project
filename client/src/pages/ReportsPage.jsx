import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { reportService } from '../services/reportService';
import { medicineService } from '../services/medicineService';
import { useToast } from '../context/ToastContext';
import {
  Download,
  FileBarChart,
  Calendar,
  Filter,
  DollarSign,
  TrendingDown,
  Info,
  Layers,
  AlertTriangle,
  History,
  ShoppingBag,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const REPORTS = [
  { id: 'consumption', label: 'Consumption Trends', icon: TrendingDown },
  { id: 'stock-movements', label: 'Stock Movement Summary', icon: History },
  { id: 'wastage', label: 'Realized Wastage (Write-offs)', icon: AlertTriangle },
  { id: 'expiry-exposure', label: 'Projected Expiry Exposure', icon: Clock },
  { id: 'stockouts', label: 'Stockout Incidents', icon: Layers },
  { id: 'purchases', label: 'Purchase History', icon: ShoppingBag },
  { id: 'valuation', label: 'Stock Valuation', icon: DollarSign },
  { id: 'forecast-performance', label: 'Forecast Performance', icon: Sparkles },
  { id: 'reorders', label: 'Reorder Recommendations', icon: FileBarChart }
];

export default function ReportsPage() {
  const { showToast } = useToast();

  const [activeReport, setActiveReport] = useState('consumption');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadMedicines = async () => {
      try {
        const res = await medicineService.getMedicines({ limit: 100 });
        setMedicines(res.data || []);
      } catch (e) {
        // Silently continue
      }
    };
    loadMedicines();
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
        medicineId: selectedMedicine || undefined
      };
      const res = await reportService.getReport(activeReport, params);
      setReportData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateRange, selectedMedicine]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
        medicineId: selectedMedicine || undefined
      };
      await reportService.downloadCsv(activeReport, params);
      showToast('CSV report downloaded successfully', 'success');
    } catch (err) {
      showToast('Failed to export CSV report', 'error');
    } finally {
      setExporting(false);
    }
  };

  const renderChart = () => {
    if (!reportData?.chartData || reportData.chartData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          No chart data available for the selected parameters.
        </div>
      );
    }

    if (activeReport === 'consumption') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
            />
            <Line type="monotone" dataKey="unitsDispensed" name="Units Dispensed" stroke="#1F6FEB" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (activeReport === 'stock-movements') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="movementType" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
            <Bar dataKey="count" name="Transaction Count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (activeReport === 'wastage') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="medicine" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
            <Bar dataKey="quantity" name="Units Written Off" fill="#DC2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (activeReport === 'expiry-exposure') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="risk" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
            <Bar dataKey="batches" name="Batches at Risk" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (activeReport === 'valuation') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="medicine" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={45} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
            <Bar dataKey="value" name="Valuation ($)" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (activeReport === 'forecast-performance') {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="medicine" stroke="#94a3b8" fontSize={10} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="rfWape" name="Random Forest WAPE (%)" fill="#1F6FEB" radius={[4, 4, 0, 0]} />
            <Bar dataKey="baselineWape" name="Baseline WAPE (%)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={reportData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="status" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} />
          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
          <Bar dataKey="count" name="Count" fill="#6366F1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Comprehensive operational reports, realized wastage vs projected exposure, and financial audit logs"
      >
        <Button
          id="btn-export-csv"
          variant="secondary"
          icon={Download}
          loading={exporting}
          onClick={handleExportCsv}
        >
          Export CSV
        </Button>
      </PageHeader>

      {/* Report Selector Pills */}
      <div className="card-base p-2.5 flex flex-wrap gap-1.5 overflow-x-auto">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const isActive = activeReport === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-brand text-white shadow-xs font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-border/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5 opacity-80" />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters Card */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Range:
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="input-base text-xs py-1.5"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="input-base text-xs py-1.5"
            />
          </div>

          <select
            value={selectedMedicine}
            onChange={(e) => setSelectedMedicine(e.target.value)}
            className="input-base text-xs py-1.5"
          >
            <option value="">All Medicines</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.medicineCode})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setDateRange({
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0]
              })
            }
            className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
          >
            Last 30d
          </button>
          <button
            onClick={() =>
              setDateRange({
                from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0]
              })
            }
            className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
          >
            Last 90d
          </button>
          <button
            onClick={() =>
              setDateRange({
                from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0]
              })
            }
            className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
          >
            1 Year
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      {loading ? (
        <div className="card-base p-6 space-y-4">
          <Skeleton count={6} height={45} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : !reportData ? (
        <EmptyState title="No report data" description="Select an analytical report and timeframe to view data." />
      ) : (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-blue-900">{reportData.title}</h4>
              <p className="text-xs text-blue-800 mt-0.5">{reportData.explanation}</p>
              {reportData.disclaimer && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  * {reportData.disclaimer}
                </p>
              )}
              {reportData.hasUnknownCostLines && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  * Valuation excludes batches where unit cost data is unavailable.
                </p>
              )}
            </div>
          </div>

          {/* Chart Section */}
          <div className="card-base p-5">
            <h4 className="text-xs font-bold text-slate-700 mb-4 uppercase tracking-wider">
              {reportData.title} Visualization
            </h4>
            {renderChart()}
          </div>

          {/* Data Table */}
          <div className="card-base overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-slate-50/50">
              <span className="font-bold text-xs text-slate-800">
                Detailed Records ({reportData.tableData?.length || 0} rows)
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                CSV export matches this filtered table exactly
              </span>
            </div>

            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-border shadow-2xs">
                  <tr className="text-slate-600 font-semibold">
                    {reportData.headers?.map((h) => (
                      <th key={h.key} className="py-2.5 px-3 whitespace-nowrap">
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.tableData?.length === 0 ? (
                    <tr>
                      <td colSpan={reportData.headers?.length || 1} className="py-8 text-center text-slate-400">
                        No rows found for the selected timeframe.
                      </td>
                    </tr>
                  ) : (
                    reportData.tableData?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {reportData.headers?.map((h) => (
                          <td key={h.key} className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {row[h.key] ?? 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
