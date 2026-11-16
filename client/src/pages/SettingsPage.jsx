import React, { useState, useEffect } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import { settingService } from '../services/settingService';
import { forecastService } from '../services/forecastService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Settings,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  Sliders,
  BellRing,
  RotateCw,
  Sparkles,
  Info,
  Check,
  XCircle,
  FileText
} from 'lucide-react';

const TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'forecasting', label: 'Forecasting', icon: BrainCircuit },
  { id: 'alerts', label: 'Alerts', icon: BellRing },
  { id: 'inventory', label: 'Inventory Defaults', icon: Settings },
  { id: 'import', label: 'Data Import', icon: UploadCloud },
  { id: 'model', label: 'Model Settings', icon: Sparkles }
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState(isAdmin ? 'general' : 'import');

  // Settings State
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Model Info State
  const [modelInfo, setModelInfo] = useState(null);
  const [retraining, setRetraining] = useState(false);

  // Import State
  const [importType, setImportType] = useState('medicines');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitSummary, setCommitSummary] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        if (isAdmin) {
          const res = await settingService.getSettings();
          setSettings(res.data || {});
        }
        // Also fetch model info for the Model Settings tab
        try {
          const mRes = await forecastService.getModelInfo();
          setModelInfo(mRes.data?.data || mRes.data);
        } catch (e) {
          // Model info might fail if AI service is down
        }
      } catch (err) {
        setError(err?.response?.data?.error?.message || 'Failed to load system settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isAdmin]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      setSaving(true);
      const res = await settingService.updateSettings(settings);
      setSettings(res.data);
      showToast('System settings updated successfully', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async (templateName) => {
    try {
      await settingService.downloadTemplate(templateName);
      showToast(`Downloaded ${templateName}.csv template`, 'success');
    } catch (err) {
      showToast(`Failed to download template: ${err?.message}`, 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Please select a valid .csv file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds 5MB limit', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setCsvContent(text);
      setPreviewResult(null);
      setCommitSummary(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent?.trim()) {
      showToast('Please select or paste CSV data first', 'error');
      return;
    }

    try {
      setPreviewing(true);
      const res = await settingService.previewImport(importType, csvContent);
      setPreviewResult(res.data);
      setCommitSummary(null);
      if (res.data.hasCriticalErrors) {
        showToast('CSV validation found critical errors. Please inspect the rejected rows.', 'error');
      } else {
        showToast(`Validated: ${res.data.acceptedCount} valid records ready for import.`, 'success');
      }
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Validation failed for CSV file', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!previewResult || !previewResult.importId) {
      showToast('Please run validation preview first', 'error');
      return;
    }

    if (!window.confirm(`Commit import of ${previewResult.acceptedCount} ${importType} records to the database?`)) {
      return;
    }

    try {
      setCommitting(true);
      const res = await settingService.commitImport(
        previewResult.importId,
        importType,
        previewResult.validRows
      );
      setCommitSummary(res.data);
      showToast(res.data.message || 'Import committed successfully!', 'success');
      setPreviewResult(null);
      setCsvContent('');
      setFileName('');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to commit import', 'error');
    } finally {
      setCommitting(false);
    }
  };

  const handleRetrain = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Trigger machine learning retraining across all multi-medicine historical usage?')) {
      return;
    }

    try {
      setRetraining(true);
      await forecastService.retrainModel();
      showToast('Model retraining triggered successfully!', 'success');
      const mRes = await forecastService.getModelInfo();
      setModelInfo(mRes.data?.data || mRes.data);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Retraining failed', 'error');
    } finally {
      setRetraining(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Configuration"
        subtitle="Configure inventory parameters, risk thresholds, model hyperparameters, and bulk CSV intake"
      />

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          // Non-admin can only see Data Import
          if (!isAdmin && t.id !== 'import') return null;

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === t.id
                  ? 'border-brand text-brand font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: GENERAL
      ========================================================================= */}
      {activeTab === 'general' && isAdmin && (
        <div className="card-base p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">General System Settings</h3>
          <p className="text-xs text-slate-500 mb-5">
            Basic system currency and notifications configuration.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Display Currency Code</label>
              <select
                value={settings?.currency || 'INR'}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="input-base text-xs py-2 w-full"
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
              </select>
            </div>

            <div className="pt-2">
              <span className="block font-semibold text-slate-700 mb-2">Notification Preferences</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.notificationPrefs?.emailDigest ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationPrefs: {
                          ...(settings?.notificationPrefs || {}),
                          emailDigest: e.target.checked
                        }
                      })
                    }
                    className="rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="text-slate-700">Enable daily automated alert email digests for critical stockouts</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.notificationPrefs?.poApprovals ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationPrefs: {
                          ...(settings?.notificationPrefs || {}),
                          poApprovals: e.target.checked
                        }
                      })
                    }
                    className="rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="text-slate-700">Notify managers immediately on Purchase Order submissions</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 2: FORECASTING
      ========================================================================= */}
      {activeTab === 'forecasting' && isAdmin && (
        <div className="card-base p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Forecasting Parameters</h3>
          <p className="text-xs text-slate-500 mb-5">
            Configure demand forecasting horizons and chronological evaluation criteria.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Forecast Horizon (Days)</label>
              <select
                value={settings?.defaultForecastHorizon || 15}
                onChange={(e) => setSettings({ ...settings, defaultForecastHorizon: Number(e.target.value) })}
                className="input-base text-xs py-2 w-full"
              >
                <option value={7}>7 Days (Short Horizon)</option>
                <option value={15}>15 Days (Bi-weekly Standard)</option>
                <option value={30}>30 Days (Monthly Outlook)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Min History for Moving Average (Days)</label>
                <input
                  type="number"
                  min="7"
                  max="60"
                  value={settings?.minHistoryDaysBaseline ?? 14}
                  onChange={(e) => setSettings({ ...settings, minHistoryDaysBaseline: Number(e.target.value) })}
                  className="input-base text-xs py-2 w-full"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">History &lt; 14 days rejects forecast</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Min History for Random Forest (Days)</label>
                <input
                  type="number"
                  min="30"
                  max="180"
                  value={settings?.minHistoryDaysRandomForest ?? 60}
                  onChange={(e) => setSettings({ ...settings, minHistoryDaysRandomForest: Number(e.target.value) })}
                  className="input-base text-xs py-2 w-full"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">14–59 days flags forecast provisional</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min New Days Required for Retraining</label>
              <input
                type="number"
                min="7"
                max="90"
                value={settings?.aiRetrainMinNewDays ?? 14}
                onChange={(e) => setSettings({ ...settings, aiRetrainMinNewDays: Number(e.target.value) })}
                className="input-base text-xs py-2 w-full"
              />
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ALERTS
      ========================================================================= */}
      {activeTab === 'alerts' && isAdmin && (
        <div className="card-base p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Alerts & Expiry Risk Thresholds</h3>
          <p className="text-xs text-slate-500 mb-5">
            Configure deduplication bands and risk severity classification cutoffs.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Expiry Warning Window (Days)</label>
              <input
                type="number"
                min="7"
                max="180"
                value={settings?.expiryWarningDays ?? 30}
                onChange={(e) => setSettings({ ...settings, expiryWarningDays: Number(e.target.value) })}
                className="input-base text-xs py-2 w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medium Leftover %</label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={settings?.riskThresholds?.mediumLeftoverPct ?? 10}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      riskThresholds: {
                        ...(settings?.riskThresholds || {}),
                        mediumLeftoverPct: Number(e.target.value)
                      }
                    })
                  }
                  className="input-base text-xs py-2 w-full"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">High Leftover %</label>
                <input
                  type="number"
                  min="20"
                  max="60"
                  value={settings?.riskThresholds?.highLeftoverPct ?? 30}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      riskThresholds: {
                        ...(settings?.riskThresholds || {}),
                        highLeftoverPct: Number(e.target.value)
                      }
                    })
                  }
                  className="input-base text-xs py-2 w-full"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Critical Leftover %</label>
                <input
                  type="number"
                  min="50"
                  max="90"
                  value={settings?.riskThresholds?.criticalLeftoverPct ?? 60}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      riskThresholds: {
                        ...(settings?.riskThresholds || {}),
                        criticalLeftoverPct: Number(e.target.value)
                      }
                    })
                  }
                  className="input-base text-xs py-2 w-full"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Critical Days to Expiry Cutoff</label>
              <input
                type="number"
                min="7"
                max="30"
                value={settings?.riskThresholds?.criticalDaysToExpiry ?? 14}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    riskThresholds: {
                      ...(settings?.riskThresholds || {}),
                      criticalDaysToExpiry: Number(e.target.value)
                    }
                  })
                }
                className="input-base text-xs py-2 w-full"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Batches with leftover ≥ 30% and days ≤ cutoff escalate immediately to Critical.
              </span>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 4: INVENTORY DEFAULTS
      ========================================================================= */}
      {activeTab === 'inventory' && isAdmin && (
        <div className="card-base p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Inventory & Reorder Defaults</h3>
          <p className="text-xs text-slate-500 mb-5">
            Configure safety stock z-factor and target replenishment buffer coverage.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Coverage Days</label>
              <input
                type="number"
                min="7"
                max="90"
                value={settings?.targetCoverageDays ?? 30}
                onChange={(e) => setSettings({ ...settings, targetCoverageDays: Number(e.target.value) })}
                className="input-base text-xs py-2 w-full"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Reorder quantity aims to provide stock covering this many days of demand.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Service Level Z-Factor</label>
              <select
                value={settings?.serviceLevelZ ?? 1.65}
                onChange={(e) => setSettings({ ...settings, serviceLevelZ: Number(e.target.value) })}
                className="input-base text-xs py-2 w-full"
              >
                <option value={1.28}>z = 1.28 (90% Service Level)</option>
                <option value={1.65}>z = 1.65 (95% Service Level - Recommended)</option>
                <option value={1.96}>z = 1.96 (97.5% Service Level)</option>
                <option value={2.33}>z = 2.33 (99% Service Level)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Determines safety stock buffer: ceil(z · σ · √L).
              </span>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 5: DATA IMPORT
      ========================================================================= */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Zone (5 cols) */}
            <div className="lg:col-span-5 card-base p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Bulk CSV Data Intake</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Select dataset type, download sample templates, and validate file before committing.
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dataset Type</label>
                  <select
                    id="select-import-type"
                    value={importType}
                    onChange={(e) => {
                      setImportType(e.target.value);
                      setPreviewResult(null);
                      setCommitSummary(null);
                    }}
                    className="input-base text-xs py-2 w-full"
                  >
                    <option value="medicines">Medicines Catalogue (.csv)</option>
                    <option value="batches">Batch Inventory (.csv)</option>
                    <option value="daily_usage">Daily Usage Consumption (.csv)</option>
                  </select>
                </div>

                {/* Dropzone */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
                  <UploadCloud className="w-10 h-10 text-brand mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    {fileName ? fileName : 'Choose CSV file to upload'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Maximum file size: 5MB</p>
                  <input
                    id="file-upload-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="mt-3">
                    <span className="px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-brand-hover inline-block">
                      Browse File
                    </span>
                  </div>
                </div>

                {/* Download Templates */}
                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-xs font-semibold text-slate-700 block mb-2">Sample Templates:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDownloadTemplate('medicines')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-brand bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> medicines.csv
                    </button>
                    <button
                      onClick={() => handleDownloadTemplate('batches')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-brand bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> batches.csv
                    </button>
                    <button
                      onClick={() => handleDownloadTemplate('daily_usage')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-brand bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> daily_usage.csv
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border flex justify-end">
                <Button
                  id="btn-preview-import"
                  variant="primary"
                  loading={previewing}
                  disabled={!csvContent}
                  onClick={handlePreview}
                >
                  Validate & Preview
                </Button>
              </div>
            </div>

            {/* Validation & Preview Panel (7 cols) */}
            <div className="lg:col-span-7 card-base p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Pre-Commit Validation Preview</h3>
                  {previewResult && (
                    <span
                      className={`text-xs font-bold flex items-center gap-1 ${
                        previewResult.hasCriticalErrors ? 'text-status-critical' : 'text-status-success'
                      }`}
                    >
                      {previewResult.hasCriticalErrors ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Critical errors found
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> {previewResult.acceptedCount} ready /{' '}
                          {previewResult.rejectedCount} rejected
                        </>
                      )}
                    </span>
                  )}
                </div>

                {commitSummary && (
                  <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                    <span className="font-bold block mb-1">Import Succeeded:</span>
                    <div>
                      {commitSummary.accepted} records accepted, {commitSummary.rejected} rejected,{' '}
                      {commitSummary.skipped} duplicates skipped.
                    </div>
                    <div className="mt-1 font-medium text-[11px] text-emerald-800">
                      * Stock ledger movements generated for all imported batches.
                    </div>
                  </div>
                )}

                {!previewResult ? (
                  <div className="h-64 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No active preview session</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                      Select a CSV file and click "Validate & Preview". The whole file is checked for format, date validity, and catalog references before anything touches the database.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-border rounded-lg max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-border sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Row</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Details / Identifier</th>
                            <th className="py-2 px-3">Error Reasons</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewResult.previewRows?.map((r, idx) => (
                            <tr
                              key={idx}
                              className={r.isValid ? 'hover:bg-slate-50/60' : 'bg-red-50/40 hover:bg-red-50/60'}
                            >
                              <td className="py-2 px-3 font-mono text-slate-500">{r.rowNumber}</td>
                              <td className="py-2 px-3">
                                {r.isValid ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    VALID
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                    ERROR
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800 font-mono text-[11px]">
                                {r.data.medicineCode} {r.data.batchNumber ? `• ${r.data.batchNumber}` : ''}{' '}
                                {r.data.date ? `• ${r.data.date}` : ''}
                              </td>
                              <td className="py-2 px-3 text-red-600 text-[11px]">
                                {r.errors?.join('; ') || 'None'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {previewResult && (
                <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    {previewResult.acceptedCount} rows will be committed to the database.
                  </span>
                  <Button
                    id="btn-commit-import"
                    variant="primary"
                    loading={committing}
                    disabled={previewResult.acceptedCount === 0}
                    onClick={handleCommit}
                  >
                    Commit Import ({previewResult.acceptedCount})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: MODEL SETTINGS
      ========================================================================= */}
      {activeTab === 'model' && (
        <div className="space-y-6 max-w-3xl">
          <div className="card-base p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Machine Learning Model</h3>
                <p className="text-xs text-slate-500">
                  Read-only runtime metadata exported from the FastAPI AI service
                </p>
              </div>
              <Badge status="healthy">ACTIVE PERSISTED MODEL</Badge>
            </div>

            {modelInfo ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-border">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Model Name</span>
                    <span className="font-bold text-slate-800 text-sm">{modelInfo.activeModel || 'random_forest'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Model Version</span>
                    <span className="font-bold text-brand text-sm">{modelInfo.version || 'rf-2026.10.1'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Trained At</span>
                    <span className="font-medium text-slate-700">
                      {modelInfo.trainedAt ? new Date(modelInfo.trainedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Training Records</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {modelInfo.trainingWindow?.recordsCount || '10,500'} records
                    </span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-1.5">Engineered Feature Set (18 features)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(modelInfo.features || [
                      'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14', 'lag_28',
                      'roll_mean_7', 'roll_mean_14', 'roll_mean_28', 'roll_std_7',
                      'day_of_week', 'dow_sin', 'dow_cos', 'month', 'day_of_month',
                      'is_weekend', 'days_since_last_nonzero', 'medicine_scale'
                    ]).map((feat) => (
                      <span
                        key={feat}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {modelInfo.lastEvaluationMetrics && (
                  <div>
                    <span className="font-bold text-slate-700 block mb-1.5">Last Training Evaluation</span>
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-border text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">MAE</span>
                        <span className="font-bold text-slate-800">{modelInfo.lastEvaluationMetrics.mae}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">RMSE</span>
                        <span className="font-bold text-slate-800">{modelInfo.lastEvaluationMetrics.rmse}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">WAPE</span>
                        <span className="font-bold text-brand">
                          {(modelInfo.lastEvaluationMetrics.wape * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                Could not retrieve active model metadata from FastAPI service. Verify the AI service is running on port 8000.
              </div>
            )}

            {isAdmin && (
              <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Retraining trains Random Forest across multi-medicine historical usage and updates modelVersion.
                </span>
                <Button
                  id="btn-retrain-model"
                  variant="primary"
                  icon={RotateCw}
                  loading={retraining}
                  onClick={handleRetrain}
                >
                  Retrain Model Artifact
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
