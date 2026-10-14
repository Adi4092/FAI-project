import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import { Download, FileBarChart, Calendar, TrendingDown, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('wastage');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Historical consumption, realized wastage write-offs, and stock valuation audits"
      >
        <Button variant="secondary" icon={Download}>
          Export CSV
        </Button>
      </PageHeader>

      {/* Report Type Selector Tabs */}
      <div className="card-base p-4 flex flex-wrap gap-2">
        {[
          { id: 'wastage', label: 'Realized Wastage vs Exposure' },
          { id: 'consumption', label: 'Dispense Trends' },
          { id: 'movements', label: 'Movement Ledger' },
          { id: 'valuation', label: 'Stock Valuation' },
          { id: 'stockouts', label: 'Stockout Incidents' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              reportType === tab.id
                ? 'bg-brand text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-base p-5 border-l-4 border-status-critical">
          <div className="text-xs text-slate-500 font-medium">Realized Wastage (Write-Offs)</div>
          <div className="text-2xl font-bold text-status-critical mt-1">45 units</div>
          <div className="text-[11px] text-slate-400 mt-1">Confirmed expired disposals</div>
        </div>
        <div className="card-base p-5 border-l-4 border-status-warning">
          <div className="text-xs text-slate-500 font-medium">Projected Expiry Exposure</div>
          <div className="text-2xl font-bold text-status-warning mt-1">120 units</div>
          <div className="text-[11px] text-slate-400 mt-1">Estimated simulation exposure</div>
        </div>
        <div className="card-base p-5 border-l-4 border-brand">
          <div className="text-xs text-slate-500 font-medium">Total Inventory Valuation</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">$48,920</div>
          <div className="text-[11px] text-slate-400 mt-1">Active batch purchase costs</div>
        </div>
      </div>

      <div className="card-base p-8 text-center text-xs text-slate-500">
        <FileBarChart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-slate-800 mb-1">Detailed Analytics Breakdown</h4>
        <p className="max-w-md mx-auto text-slate-500">
          In Phase 7, dynamic report filters, granular medicine breakdowns, and multi-format CSV exports will be fully wired to Express reporting services.
        </p>
      </div>
    </div>
  );
}
