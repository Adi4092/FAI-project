import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import DateRangeFilter from '../components/common/DateRangeFilter';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { Download, AlertTriangle, DollarSign, Info } from 'lucide-react';

const mockRiskBatches = [
  { id: '1', medicine: 'Ciprofloxacin 500mg', batch: 'B005', expiry: '2026-05-30', daysLeft: 17, qty: 30, risk: 'High', action: 'Review' },
  { id: '2', medicine: 'Amoxicillin 250mg', batch: 'B002', expiry: '2026-06-20', daysLeft: 78, qty: 50, risk: 'Medium', action: 'Monitor' },
  { id: '3', medicine: 'Omeprazole 20mg', batch: 'B006', expiry: '2026-09-05', daysLeft: 95, qty: 150, risk: 'Low', action: 'OK' },
  { id: '4', medicine: 'Paracetamol 500mg', batch: 'B001', expiry: '2026-06-15', daysLeft: 47, qty: 100, risk: 'Low', action: 'OK' },
  { id: '5', medicine: 'Metformin 500mg', batch: 'B004', expiry: '2026-10-05', daysLeft: 224, qty: 200, risk: 'Low', action: 'OK' },
];

export default function ExpiryRiskPage() {
  const [windowDays, setWindowDays] = useState('30d');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Risk"
        subtitle="Batches expiring soon and potentially wastage under FEFO consumption simulation"
      >
        <DateRangeFilter value={windowDays} onChange={setWindowDays} />
        <Button variant="secondary" size="sm" icon={Download}>
          Export
        </Button>
      </PageHeader>

      {/* Table matching Screen 05 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Batch No.</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-right">Days Left</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-center">Risk Level</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockRiskBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{b.medicine}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{b.batch}</td>
                  <td className="py-3 px-4 text-slate-600">{b.expiry}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-700">{b.daysLeft}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{b.qty}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={b.risk}>{b.risk}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-brand hover:underline font-semibold">
                      {b.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Summary Cards matching Screen 05 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-base p-5 flex items-center gap-4 border-l-4 border-status-warning">
          <div className="p-3 rounded-xl bg-status-warning/10 text-status-warning flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Estimated Wastage (Next 30 days)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">120 units</div>
          </div>
        </div>

        <div className="card-base p-5 flex items-center gap-4 border-l-4 border-brand">
          <div className="p-3 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Estimated Value at Risk</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">$2,340</div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 italic">
        * Estimated values are derived from FEFO simulation and daily demand extrapolations; they are projections rather than guarantees.
      </p>
    </div>
  );
}
