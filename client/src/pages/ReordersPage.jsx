import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import { Package, DollarSign, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockReorders = [
  { id: '1', medicine: 'Ciprofloxacin 500mg', current: 30, reorderPoint: 60, suggested: 100, leadTime: '5 days' },
  { id: '2', medicine: 'Amoxicillin 250mg', current: 50, reorderPoint: 80, suggested: 150, leadTime: '7 days' },
  { id: '3', medicine: 'Metformin 500mg', current: 200, reorderPoint: 100, suggested: 200, leadTime: '5 days' },
  { id: '4', medicine: 'Omeprazole 20mg', current: 150, reorderPoint: 100, suggested: 150, leadTime: '6 days' },
  { id: '5', medicine: 'Ibuprofen 400mg', current: 800, reorderPoint: 50, suggested: 100, leadTime: '5 days' },
];

export default function ReordersPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reorder Recommendations"
        subtitle="Explainable replenishment triggers reviewable before Purchase Order creation"
      />

      {/* Table matching Screen 08 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">Reorder Point</th>
                <th className="py-3 px-4 text-right">Suggested Order</th>
                <th className="py-3 px-4">Lead Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockReorders.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{r.medicine}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-700">{r.current}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{r.reorderPoint}</td>
                  <td className="py-3 px-4 text-right font-bold text-brand">{r.suggested}</td>
                  <td className="py-3 px-4 text-slate-600">{r.leadTime}</td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/purchase-orders')}
                    >
                      Create PO
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards matching Screen 08 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-base p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-brand flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Suggested Order</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">670 units</div>
          </div>
        </div>

        <div className="card-base p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Estimated Cost</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">$1,240</div>
          </div>
        </div>
      </div>
    </div>
  );
}
