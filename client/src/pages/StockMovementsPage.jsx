import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Search, Download, History } from 'lucide-react';

const mockMovements = [
  { id: '1', date: '2026-04-28', medicine: 'Paracetamol 500mg', batch: 'B001', type: 'dispense', label: 'Dispensed', qty: -20, reason: 'Prescription', user: 'Staff' },
  { id: '2', date: '2026-04-27', medicine: 'Amoxicillin 250mg', batch: 'B002', type: 'receipt', label: 'Received', qty: 50, reason: 'Purchase', user: 'Manager' },
  { id: '3', date: '2026-04-26', medicine: 'Ibuprofen 400mg', batch: 'B003', type: 'adjustment', label: 'Adjusted', qty: 10, reason: 'Stock Count', user: 'Admin' },
  { id: '4', date: '2026-04-25', medicine: 'Metformin 500mg', batch: 'B004', type: 'dispense', label: 'Dispensed', qty: -15, reason: 'Prescription', user: 'Staff' },
  { id: '5', date: '2026-04-24', medicine: 'Ciprofloxacin 500mg', batch: 'B005', type: 'receipt', label: 'Received', qty: 10, reason: 'Purchase', user: 'Manager' },
];

export default function StockMovementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement History"
        subtitle="Immutable audit ledger recording every receipt, dispensing, return, and adjustment"
      >
        <Button variant="secondary" icon={Download}>
          Export CSV
        </Button>
      </PageHeader>

      {/* Filter and Search Bar matching Screen 09 */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by medicine, batch, or reason..."
            className="input-base pl-9 text-xs py-2"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Date range: <span className="text-slate-800 font-semibold">Apr 1, 2026 – Apr 30, 2026</span>
        </div>
      </div>

      {/* Table matching Screen 09 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Batch No.</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-500">{m.date}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{m.medicine}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{m.batch}</td>
                  <td className="py-3 px-4">
                    <Badge variant={m.type === 'receipt' ? 'success' : m.type === 'dispense' ? 'critical' : 'info'}>
                      {m.label}
                    </Badge>
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    m.qty > 0 ? 'text-status-success' : 'text-status-critical'
                  }`}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{m.reason}</td>
                  <td className="py-3 px-4 text-slate-600">{m.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
