import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import { Settings, UploadCloud, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Data Import"
        subtitle="Configure inventory defaults, forecasting parameters, alert bands, and CSV data intake"
      />

      {/* Tabs matching Screen 12/15 */}
      <div className="flex border-b border-border gap-3 overflow-x-auto pb-1">
        {[
          { id: 'general', label: 'General' },
          { id: 'forecasting', label: 'Forecasting' },
          { id: 'alerts', label: 'Alerts' },
          { id: 'import', label: 'Data Import' },
          { id: 'model', label: 'Model Settings' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File Upload Dropzone (5 cols) */}
          <div className="lg:col-span-5 card-base p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Import Consumptions & Batches</h3>
              <p className="text-xs text-slate-500 mb-4">
                Select dataset type and upload CSV file to preview before committing.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dataset Type</label>
                <select className="input-base text-xs py-2">
                  <option>Medicines Catalogue (.csv)</option>
                  <option>Batch Inventory (.csv)</option>
                  <option>Daily Consumption (.csv)</option>
                </select>
              </div>

              {/* Drag and Drop Zone */}
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
                <UploadCloud className="w-10 h-10 text-brand mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700">Drag and drop CSV file here</p>
                <p className="text-[11px] text-slate-400 mt-0.5">or</p>
                <button className="mt-3 px-4 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-brand-hover">
                  Choose File
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4">
                <span>Supported format: .csv</span>
                <a href="#template" className="text-brand hover:underline font-semibold flex items-center gap-1">
                  <Download className="w-3 h-3" /> Download sample file
                </a>
              </div>
            </div>
          </div>

          {/* Import Preview Card (7 cols) */}
          <div className="lg:col-span-7 card-base p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Import Preview</h3>
                <span className="text-xs text-status-success font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 5 records ready
                </span>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Medicine</th>
                      <th className="py-2 px-3">Batch</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-2 px-3">Paracetamol</td>
                      <td className="py-2 px-3 font-mono">B001</td>
                      <td className="py-2 px-3 text-right">100</td>
                      <td className="py-2 px-3">2026-06-15</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-2 px-3">Amoxicillin</td>
                      <td className="py-2 px-3 font-mono">B002</td>
                      <td className="py-2 px-3 text-right">50</td>
                      <td className="py-2 px-3">2026-05-20</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-2 px-3">Ibuprofen</td>
                      <td className="py-2 px-3 font-mono">B003</td>
                      <td className="py-2 px-3 text-right">80</td>
                      <td className="py-2 px-3">2027-01-10</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-2 px-3">Metformin</td>
                      <td className="py-2 px-3 font-mono">B004</td>
                      <td className="py-2 px-3 text-right">200</td>
                      <td className="py-2 px-3">2026-09-05</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border flex justify-end">
              <Button variant="primary" size="md">
                Commit Import
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-base p-8 text-center text-xs text-slate-500">
          <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-800 mb-1">Configuration Panel</h4>
          <p className="max-w-md mx-auto text-slate-500">
            System thresholds, service level Z factors, and model retraining controls will connect directly to Express settings routes in Phase 7.
          </p>
        </div>
      )}
    </div>
  );
}
