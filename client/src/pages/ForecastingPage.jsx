import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import ChartCard from '../components/common/ChartCard';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { BrainCircuit, RefreshCw, AlertTriangle, CheckCircle, Info, Calendar, Sparkles, History, ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { medicineService } from '../services/medicineService';
import { forecastService } from '../services/forecastService';
import { useAuth } from '../context/AuthContext';

export default function ForecastingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [medicines, setMedicines] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [horizon, setHorizon] = useState('15');
  const [loadingMeds, setLoadingMeds] = useState(true);

  const [activeForecast, setActiveForecast] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // 1. Load active medicines
  useEffect(() => {
    async function loadMeds() {
      try {
        setLoadingMeds(true);
        const res = await medicineService.getMedicines({ limit: 100 });
        const meds = res.data || [];
        setMedicines(meds);
        if (meds.length > 0) {
          setSelectedMedId(meds[0].id || meds[0]._id);
        }
      } catch (err) {
        setErrorMessage(err.message || 'Failed to load medicines.');
      } finally {
        setLoadingMeds(false);
      }
    }
    loadMeds();
  }, []);

  // Fetch forecast history for medicine
  const fetchForecasts = useCallback(async (medId) => {
    if (!medId) return [];
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await forecastService.getForecasts(medId);
      const list = res.data || [];
      setForecastHistory(list);
      return list;
    } catch (err) {
      const msg = err.error?.message || err.message || 'Failed to load forecast history.';
      setHistoryError(msg);
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 2. Load usage history and forecasts when selected medicine changes
  useEffect(() => {
    if (!selectedMedId) return;

    async function fetchMedicineForecastData() {
      try {
        setLoadingData(true);
        setErrorMessage(null);

        // Fetch usage history and existing forecasts in parallel
        const [usageRes, forecasts] = await Promise.all([
          forecastService.getUsageHistory(selectedMedId),
          fetchForecasts(selectedMedId)
        ]);

        const usageData = usageRes.data || [];
        setUsageHistory(usageData);

        if (forecasts && forecasts.length > 0) {
          setActiveForecast(forecasts[0]);
        } else {
          setActiveForecast(null);
        }
      } catch (err) {
        setErrorMessage(err.error?.message || err.message || 'Failed to load forecast data.');
      } finally {
        setLoadingData(false);
      }
    }

    fetchMedicineForecastData();
  }, [selectedMedId, fetchForecasts]);

  // 3. Generate new forecast
  const handleGenerate = async () => {
    if (!selectedMedId) return;
    try {
      setGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await forecastService.generateForecast(selectedMedId, Number(horizon));
      const newForecast = res.data;
      setActiveForecast(newForecast);
      // Refresh history list so newest entry appears immediately
      await fetchForecasts(selectedMedId);
      setSuccessMessage(`Forecast successfully generated using ${newForecast.modelName} (${newForecast.modelVersion}).`);
    } catch (err) {
      const msg = err.error?.message || err.message || 'Demand forecast generation failed.';
      setErrorMessage(msg);
    } finally {
      setGenerating(false);
    }
  };

  // 4. Refresh Daily Usage
  const handleRefreshUsage = async () => {
    try {
      setRefreshingUsage(true);
      setErrorMessage(null);
      await forecastService.refreshUsage();
      // Re-fetch usage history
      const usageRes = await forecastService.getUsageHistory(selectedMedId);
      setUsageHistory(usageRes.data || []);
      setSuccessMessage('Daily usage history refreshed from ledger movements.');
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Failed to refresh usage data.');
    } finally {
      setRefreshingUsage(false);
    }
  };

  // 5. Retrain Model (Admin only)
  const handleRetrain = async () => {
    try {
      setRetraining(true);
      setErrorMessage(null);
      const res = await forecastService.retrainModel();
      setSuccessMessage(`Model successfully retrained: ${res.data?.modelVersion || 'New version active'}.`);
    } catch (err) {
      setErrorMessage(err.error?.message || err.message || 'Model retraining failed.');
    } finally {
      setRetraining(false);
    }
  };

  // Build combined chart timeline: trailing 30 days of actuals + predicted days
  const recentUsage = usageHistory.slice(-30);
  const chartTimeline = [];

  for (const u of recentUsage) {
    chartTimeline.push({
      date: u.date.slice(5),
      actual: u.unitsDispensed,
      predicted: null,
      stockout: u.stockoutObserved
    });
  }

  if (activeForecast && activeForecast.predictedDailyDemand) {
    for (const p of activeForecast.predictedDailyDemand) {
      chartTimeline.push({
        date: p.date.slice(5),
        actual: null,
        predicted: p.predicted,
        stockout: false
      });
    }
  }

  const selectedMed = medicines.find((m) => (m.id || m._id) === selectedMedId);
  const latestForecast = forecastHistory.length > 0 ? forecastHistory[0] : null;
  const isViewingSaved = Boolean(
    activeForecast &&
    latestForecast &&
    (activeForecast._id || activeForecast.id) !== (latestForecast._id || latestForecast.id)
  );

  // Check if historical usage data ended > 1 day before generation date (lag warning)
  const lastHistoryDateStr = activeForecast?.dataWindow?.to || (usageHistory.length > 0 ? usageHistory[usageHistory.length - 1].date : null);
  const genDateStr = activeForecast?.generatedAt ? new Date(activeForecast.generatedAt).toISOString().split('T')[0] : null;
  const todayStr = new Date().toISOString().split('T')[0];

  let staleHistoryWarning = null;
  if (lastHistoryDateStr && genDateStr) {
    const lastHistMs = new Date(lastHistoryDateStr + 'T00:00:00Z').getTime();
    const genDateMs = new Date(genDateStr + 'T00:00:00Z').getTime();
    const diffDays = Math.round((genDateMs - lastHistMs) / (24 * 60 * 60 * 1000));

    if (diffDays > 1) {
      const pastDaysCount = (activeForecast?.predictedDailyDemand || []).filter(
        (p) => p.date < genDateStr || p.date < todayStr
      ).length;
      staleHistoryWarning = `Usage data ends on ${lastHistoryDateStr}; the first ${pastDaysCount} forecast days are already in the past.`;
    }
  }

  const renderForecastHistoryCard = () => (
    <div className="card-base p-5" data-testid="forecast-history-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Forecast History</h3>
          <p className="text-xs text-slate-500">
            Saved forecast runs for {selectedMed?.name || 'this medicine'} (newest first)
          </p>
        </div>
        {forecastHistory.length > 0 && (
          <span className="text-xs text-slate-500 font-medium">
            {forecastHistory.length} {forecastHistory.length === 1 ? 'record' : 'records'}
          </span>
        )}
      </div>

      {historyLoading ? (
        <div className="space-y-2 py-3" data-testid="forecast-history-loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : historyError ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between gap-3 text-sm" data-testid="forecast-history-error">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-critical flex-shrink-0" />
            <span>{historyError}</span>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => fetchForecasts(selectedMedId)}
          >
            Retry
          </Button>
        </div>
      ) : forecastHistory.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 font-medium" data-testid="forecast-history-empty">
          No saved forecasts for this medicine yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" data-testid="forecast-history-table">
            <thead>
              <tr className="text-slate-400 font-semibold border-b border-border">
                <th className="py-2.5 px-3">Generated At</th>
                <th className="py-2.5 px-3">Horizon</th>
                <th className="py-2.5 px-3">Model & Version</th>
                <th className="py-2.5 px-3 text-right">Predicted Demand</th>
                <th className="py-2.5 px-3">Date Range</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {forecastHistory.map((item) => {
                const itemId = item._id || item.id;
                const isSelected = activeForecast && (activeForecast._id || activeForecast.id) === itemId;
                return (
                  <tr
                    key={itemId}
                    onClick={() => setActiveForecast(item)}
                    data-testid={`forecast-history-row-${itemId}`}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-brand text-slate-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(item.generatedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.horizonDays} days
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {item.modelName === 'random_forest' ? 'Random Forest' : item.modelName}
                      </span>{' '}
                      <span className="font-mono text-[11px] text-slate-500">
                        ({item.modelVersion})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-brand whitespace-nowrap">
                      {item.predictedTotalDemand} {selectedMed?.unit || 'units'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {item.forecastStartDate} → {item.forecastEndDate}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.provisional ? (
                        <Badge status="Warning">Provisional</Badge>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Full Model
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {isSelected ? (
                        <span className="inline-flex items-center text-[11px] font-bold text-brand bg-brand/10 px-2 py-1 rounded">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveForecast(item);
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-brand px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Demand Forecasting"
        subtitle="Predict upcoming consumption using Random Forest and recursive multi-step forecasting"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={refreshingUsage}
            onClick={handleRefreshUsage}
          >
            Refresh Usage
          </Button>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={BrainCircuit}
              loading={retraining}
              onClick={handleRetrain}
            >
              Retrain Model
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-status-critical" />
          <div className="flex-1">
            <div className="font-semibold">Forecasting Error</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-status-success" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Top Controls Card */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Medicine</label>
            {loadingMeds ? (
              <Skeleton className="h-9 w-60" />
            ) : (
              <select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="input-base text-xs py-2 w-64 font-medium"
              >
                {medicines.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.medicineCode} — {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Forecast Horizon</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="input-base text-xs py-2 w-32 font-medium"
            >
              <option value="7">7 Days</option>
              <option value="15">15 Days</option>
              <option value="30">30 Days</option>
            </select>
          </div>
        </div>

        <Button
          variant="primary"
          icon={BrainCircuit}
          loading={generating}
          onClick={handleGenerate}
          disabled={!selectedMedId || loadingMeds}
        >
          Generate Forecast
        </Button>
      </div>

      {/* Main Content Area */}
      {loadingData ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      ) : activeForecast ? (
        <div className="space-y-6">
          {/* Saved Forecast Banner */}
          {isViewingSaved && (
            <div
              data-testid="viewing-saved-banner"
              className="p-4 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-brand flex-shrink-0" />
                <span className="text-sm font-semibold">
                  Viewing saved forecast from {new Date(activeForecast.generatedAt).toLocaleString()}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveForecast(latestForecast)}
                data-testid="back-to-latest-button"
                className="bg-white hover:bg-slate-50 border-blue-200 text-brand font-medium shadow-sm"
              >
                Back to latest
              </Button>
            </div>
          )}

          {/* Active Model Meta Banner */}
          <div className="card-base p-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{activeForecast.modelName === 'random_forest' ? 'Random Forest Regressor' : activeForecast.modelName}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-blue-200 text-brand">
                    {activeForecast.modelVersion}
                  </span>
                  {activeForecast.provisional && (
                    <Badge status="Warning">Provisional Baseline</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Generated at: {new Date(activeForecast.generatedAt).toLocaleString()} • Horizon: {activeForecast.horizonDays} days
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Predicted Total Demand</div>
              <div className="text-2xl font-bold text-brand">
                {activeForecast.predictedTotalDemand} {selectedMed?.unit || 'units'}
              </div>
            </div>
          </div>

          {activeForecast.warnings && activeForecast.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{activeForecast.warnings.join(' • ')}</span>
            </div>
          )}

          {/* Stale History Lag Warning (Item 1) */}
          {staleHistoryWarning && (
            <div
              data-testid="stale-history-warning"
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-amber-800">Forecast Lag Warning: </span>
                <span>{staleHistoryWarning}</span>
              </div>
            </div>
          )}

          {/* Chart & Daily Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart (8 cols) */}
            <div className="lg:col-span-8">
              <ChartCard
                title={`Demand Projection — ${selectedMed?.name || ''}`}
                subtitle="Historical actual dispensing (solid) vs recursive machine learning prediction (dashed)"
              >
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartTimeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E9F4" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '8px',
                          border: '1px solid #E1E9F4',
                          fontSize: '12px'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Actual Dispensed"
                        stroke="#1E293B"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        name="Predicted Demand"
                        stroke="#1F6FEB"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* Daily Breakdown Table (4 cols) */}
            <div className="lg:col-span-4 card-base p-4 flex flex-col">
              <div className="font-bold text-sm text-slate-800 mb-2">Daily Predictions</div>
              <div className="overflow-y-auto max-h-72 divide-y divide-border pr-1">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-border">
                      <th className="py-2">Date</th>
                      <th className="py-2 text-right">Predicted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeForecast.predictedDailyDemand?.map((day, idx) => {
                      const isPast = day.date < todayStr;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isPast ? 'bg-amber-50/40 hover:bg-amber-50/70 text-slate-500' : 'hover:bg-slate-50'
                          }`}
                          data-testid={`daily-prediction-row-${day.date}`}
                        >
                          <td className="py-2 font-mono text-slate-600 flex items-center gap-1.5">
                            <span className={isPast ? 'text-slate-500' : ''}>{day.date}</span>
                            {isPast && (
                              <span
                                className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded"
                                title="This date is in the past — not a future projection"
                                data-testid="past-forecast-badge"
                              >
                                Past
                              </span>
                            )}
                          </td>
                          <td className={`py-2 text-right font-bold ${isPast ? 'text-slate-500' : 'text-brand'}`}>
                            {day.predicted} {selectedMed?.unit || 'units'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Model Evaluation & Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Holdout Performance Metrics */}
            <div className="card-base p-5">
              <div className="font-bold text-sm text-slate-900 mb-1 flex items-center justify-between">
                <span>Holdout Validation Performance</span>
                <span className="text-xs text-slate-400 font-normal">
                  {activeForecast.evaluationMetrics?.holdoutDays || 0} days chronological holdout
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Comparison of Random Forest model vs moving-average baseline evaluated on test holdout.
              </p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <div className="text-[11px] font-semibold text-slate-500">MAE</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeForecast.evaluationMetrics?.mae !== null ? activeForecast.evaluationMetrics.mae : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">Baseline: {activeForecast.evaluationMetrics?.baselineMae ?? '—'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <div className="text-[11px] font-semibold text-slate-500">RMSE</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeForecast.evaluationMetrics?.rmse !== null ? activeForecast.evaluationMetrics.rmse : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">Baseline: {activeForecast.evaluationMetrics?.baselineRmse ?? '—'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <div className="text-[11px] font-semibold text-slate-500">WAPE</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeForecast.evaluationMetrics?.wape !== null
                      ? `${(activeForecast.evaluationMetrics.wape * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Baseline:{' '}
                    {activeForecast.evaluationMetrics?.baselineWape !== null
                      ? `${(activeForecast.evaluationMetrics.baselineWape * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Training Window & Data Quality */}
            <div className="card-base p-5">
              <div className="font-bold text-sm text-slate-900 mb-1">Data Window & Masking</div>
              <p className="text-xs text-slate-500 mb-4">
                Non-leakage training window and stockout censoring information.
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-slate-500">Training History Range</span>
                  <span className="font-mono text-slate-800">
                    {activeForecast.dataWindow?.from || '—'} to {activeForecast.dataWindow?.to || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-slate-500">Total Calendar Days</span>
                  <span className="font-semibold text-slate-800">
                    {activeForecast.dataWindow?.days || 0} days
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-slate-500">Masked Stockout Days</span>
                  <span className="font-semibold text-amber-600">
                    {activeForecast.dataWindow?.maskedDays || 0} days censored
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Provisional Status</span>
                  <span className="font-semibold">
                    {activeForecast.provisional ? (
                      <span className="text-amber-600">Yes (Baseline fallback)</span>
                    ) : (
                      <span className="text-emerald-600">No (Full ML model)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast History Card (Below Existing Results) */}
          {renderForecastHistoryCard()}
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            icon={BrainCircuit}
            title="No Demand Forecast Available"
            description={`No forecasts have been generated yet for ${selectedMed?.name || 'this medicine'}. Click Generate Forecast to compute machine learning predictions.`}
            actionLabel="Generate Forecast"
            onAction={handleGenerate}
          />
          {renderForecastHistoryCard()}
        </div>
      )}
    </div>
  );
}
