import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { TrendingDown, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockStockouts = [
  { id: '1', medicine: 'Ciprofloxacin 500mg', current: 30, demand: 42, daysLeft: 3, priority: 'High', action: 'Reorder' },
  { id: '2', medicine: 'Amoxicillin 250mg', current: 50, demand: 28, daysLeft: 5, priority: 'High', action: 'Reorder' },
  { id: '3', medicine: 'Metformin 500mg', current: 200, demand: 45, daysLeft: 12, priority: 'Medium', action: 'Monitor' },
  { id: '4', medicine: 'Omeprazole 20mg', current: 150, demand: 28, daysLeft: 17, priority: 'Low', action: 'Monitor' },
  { id: '5', medicine: 'Ibuprofen 400mg', current: 80, demand: 15, daysLeft: 5, priority: 'Low', action: 'Monitor' },
];

export default function StockoutPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockout Predictions"
        subtitle="Simulated stock depletion timelines based on lead times, safety stocks, and forecasted demand"
      >
        <Button variant="primary" icon={ShoppingBag} onClick={() => navigate('/reorders')}>
          Review Reorders
        </Button>
      </PageHeader>

      {/* Table matching Screen 07 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">Forecast Demand (14d)</th>
                <th className="py-3 px-4 text-right">Days Until Stockout</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockStockouts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{s.medicine}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-700">{s.current}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{s.demand}</td>
                  <td className={`py-3 px-4 text-right font-bold ${s.daysLeft <= 3 ? 'text-status-critical' : 'text-slate-800'}`}>
                    {s.daysLeft} days
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={s.priority}>{s.priority}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant={s.action === 'Reorder' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => navigate('/reorders')}
                    >
                      {s.action}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
