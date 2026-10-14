import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import KpiCard from '../components/common/KpiCard';
import ChartCard from '../components/common/ChartCard';
import Badge from '../components/common/Badge';
import ProgressBar from '../components/common/ProgressBar';
import Button from '../components/common/Button';
import {
  Pill,
  Package,
  AlertTriangle,
  Clock,
  PlusCircle,
  ArrowDownToLine,
  BrainCircuit,
  FileText,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Mock demonstration data as required for Phase 2
const mockStockOverview = [
  { date: 'Apr 1', totalStock: 12100, usedStock: 420 },
  { date: 'Apr 8', totalStock: 11950, usedStock: 480 },
  { date: 'Apr 15', totalStock: 12600, usedStock: 510 },
  { date: 'Apr 22', totalStock: 12400, usedStock: 490 },
  { date: 'Apr 30', totalStock: 12840, usedStock: 530 },
];

const mockRecentMovements = [
  { id: 'm1', date: '2026-04-30', medicine: 'Paracetamol 500mg', type: 'dispense', label: 'Dispensed', quantity: -20, user: 'Riya' },
  { id: 'm2', date: '2026-04-29', medicine: 'Amoxicillin 250mg', type: 'receipt', label: 'Received', quantity: 50, user: 'Aman' },
  { id: 'm3', date: '2026-04-28', medicine: 'Metformin 500mg', type: 'dispense', label: 'Dispensed', quantity: -15, user: 'Riya' },
  { id: 'm4', date: '2026-04-27', medicine: 'Ibuprofen 400mg', type: 'adjustment', label: 'Adjusted', quantity: 10, user: 'Arjun' },
];

const mockCriticalAlerts = [
  { id: 'a1', title: 'Amoxicillin batch B002 expires in 3 days', severity: 'critical', days: '3 days left' },
  { id: 'a2', title: 'Metformin low stock (10 units)', severity: 'critical', units: 'Below safety stock' },
  { id: 'a3', title: 'Paracetamol below reorder level (15 units)', severity: 'warning', units: 'Reorder triggered' },
  { id: 'a4', title: 'Ciprofloxacin expires in 8 days', severity: 'warning', days: '8 days left' },
];

const mockUpcomingExpiries = [
  { medicine: 'Amoxicillin 250mg', batch: 'B002', expiry: '2026-05-18', qty: 50, days: 3 },
  { medicine: 'Ciprofloxacin 500mg', batch: 'B005', expiry: '2026-05-30', qty: 30, days: 17 },
  { medicine: 'Omeprazole 20mg', batch: 'B006', expiry: '2026-06-15', qty: 150, days: 47 },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Demonstration Data Banner (Strictly required in Phase 2) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-3.5 rounded-r-lg flex items-center justify-between text-xs text-amber-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800 mr-2">
              Demonstration data
            </span>
            <span className="text-slate-700">
              Mock metrics active for Phase 2 UI verification. Real inventory balances & AI forecasts connect in Phases 4 & 6.
            </span>
          </div>
        </div>
        <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          Phase 2 Preview
        </span>
      </div>

      {/* Page Header with Quick Actions */}
      <PageHeader
        title="Dashboard"
        subtitle="Inventory overview and key insights"
      >
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowDownToLine}
          onClick={() => navigate('/inventory')}
        >
          Receive Stock
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={PlusCircle}
          onClick={() => navigate('/medicines')}
        >
          + Add Medicine
        </Button>
      </PageHeader>

      {/* KPI Cards Row (Matching Screen 02) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Medicines"
          value="248"
          change={5}
          changeType="increase"
          changeLabel="from last month"
          icon={Pill}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <KpiCard
          title="Total Units"
          value="12,840"
          change={8}
          changeType="increase"
          changeLabel="from last month"
          icon={Package}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <KpiCard
          title="Low Stock"
          value="12"
          change={20}
          changeType="increase"
          changeLabel="from last month"
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <KpiCard
          title="Expiry Alerts"
          value="8"
          change={-2}
          changeType="decrease"
          changeLabel="from last month"
          icon={Clock}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
      </div>

      {/* Mid Row: Inventory Health & Stock Overview Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Inventory Health Card (4 cols) */}
        <div className="lg:col-span-4 card-base p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Inventory Health</h3>
              <span className="text-xs text-slate-400 font-medium">Usable Stock</span>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                  <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-status-success" /> Healthy Stock
                  </span>
                  <span className="text-slate-900 font-bold">77%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-status-success rounded-full transition-all duration-700" style={{ width: '77%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                  <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-status-warning" /> Expiry Risk
                  </span>
                  <span className="text-slate-900 font-bold">23%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-status-warning rounded-full transition-all duration-700" style={{ width: '23%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Stockout Risk Items</span>
              <span className="font-semibold text-status-critical">5 medicines</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-500">Expiring in &le;30 Days</span>
              <span className="font-semibold text-status-warning">8 batches</span>
            </div>
          </div>
        </div>

        {/* Stock Overview Chart (8 cols) */}
        <div className="lg:col-span-8">
          <ChartCard
            title="Stock Overview"
            subtitle="Total units in inventory vs monthly dispensed trend"
            action={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand" /> Total Stock
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Used Stock
                </span>
              </div>
            }
          >
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockStockOverview} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalStockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1F6FEB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1F6FEB" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="usedStockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D2FF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00D2FF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E9F4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E1E9F4', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="totalStock" name="Total Stock" stroke="#1F6FEB" strokeWidth={2.5} fillOpacity={1} fill="url(#totalStockGrad)" />
                  <Area type="monotone" dataKey="usedStock" name="Used Stock" stroke="#00D2FF" strokeWidth={2} fillOpacity={1} fill="url(#usedStockGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Bottom Row: Recent Stock Movements & Critical Alerts (Matching Screen 02) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Stock Movements (7 cols) */}
        <div className="lg:col-span-7 card-base p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Recent Stock Movements</h3>
              <button
                onClick={() => navigate('/stock-movements')}
                className="text-xs text-brand hover:text-brand-hover font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-slate-500 font-semibold pb-2">
                    <th className="py-2.5 pr-3">Date</th>
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 pl-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {mockRecentMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{m.date}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{m.medicine}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={m.type === 'receipt' ? 'success' : m.type === 'dispense' ? 'critical' : 'info'}
                        >
                          {m.label}
                        </Badge>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        m.quantity > 0 ? 'text-status-success' : 'text-status-critical'
                      }`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600 whitespace-nowrap">{m.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Critical Alerts Panel (5 cols, Red/Amber tint matching Screen 02) */}
        <div className="lg:col-span-5 card-base p-5 bg-[#FFF9F9] border-red-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-status-critical/10 text-status-critical">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-status-critical">Critical Alerts</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-status-critical">
                4 Unresolved
              </span>
            </div>

            <div className="space-y-2.5">
              {mockCriticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-white border border-red-100/80 shadow-2xs flex items-center justify-between gap-3 hover:border-red-200 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-status-critical mt-1.5 flex-shrink-0" />
                    <p className="text-xs font-medium text-slate-800 truncate leading-snug">
                      {alert.title}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                    {alert.days || alert.units}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-red-100/60 flex items-center justify-between">
            <span className="text-xs text-slate-500">Auto-deduplicated ledger alerts</span>
            <button
              onClick={() => navigate('/notifications')}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Manage Alerts &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <button
          onClick={() => navigate('/forecasting')}
          className="p-3.5 card-base hover:border-brand/50 text-left transition-all group flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-blue-50 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Generate Forecast</div>
            <div className="text-[10px] text-slate-400">Random Forest AI</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/expiry-risk')}
          className="p-3.5 card-base hover:border-brand/50 text-left transition-all group flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Expiry Risk Review</div>
            <div className="text-[10px] text-slate-400">FEFO 30-day projection</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/reorders')}
          className="p-3.5 card-base hover:border-brand/50 text-left transition-all group flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Reorder Planning</div>
            <div className="text-[10px] text-slate-400">Formula-driven POs</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/reports')}
          className="p-3.5 card-base hover:border-brand/50 text-left transition-all group flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Wastage Reports</div>
            <div className="text-[10px] text-slate-400">Realized vs exposure</div>
          </div>
        </button>
      </div>
    </div>
  );
}
