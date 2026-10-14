import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import ChartCard from '../components/common/ChartCard';
import { BrainCircuit, Sparkles, RefreshCw, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const mockForecastTimeline = [
  { date: 'Apr 21', actual: 18, predicted: null },
  { date: 'Apr 23', actual: 24, predicted: null },
  { date: 'Apr 25', actual: 20, predicted: 20 },
  { date: 'Apr 28', actual: null, predicted: 26 },
  { date: 'May 1', actual: null, predicted: 28 },
  { date: 'May 7', actual: null, predicted: 25 },
];

export default function ForecastingPage() {
  const [selectedMed, setSelectedMed] = useState('Paracetamol 500mg');
  const [horizon, setHorizon] = useState('15');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Demand Forecasting"
        subtitle="Predict upcoming consumption using Random Forest and recursive lag features"
      />

      {/* Top Filter & Generation Controls matching Screen 06 */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Medicine</label>
            <select
              value={selectedMed}
              onChange={(e) => setSelectedMed(e.target.value)}
              className="input-base text-xs py-1.5 w-52"
            >
              <option>Paracetamol 500mg</option>
              <option>Amoxicillin 250mg</option>
              <option>Ciprofloxacin 500mg</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Horizon</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="input-base text-xs py-1.5 w-32"
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
        >
          + Generate Forecast
        </Button>
      </div>

      {/* Demand Forecast Chart & Model Performance matching Screen 06 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Forecast Chart (8 cols) */}
        <div className="lg:col-span-8">
          <ChartCard
            title="Demand Forecast"
            subtitle="Historical actual dispensing vs recursive Random Forest prediction"
          >
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockForecastTimeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E9F4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E1E9F4', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="actual" name="Actual Demand" stroke="#1E293B" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="predicted" name="Predicted Demand" stroke="#1F6FEB" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Right: Model Performance & Metadata matching Screen 06 (4 cols) */}
        <div className="lg:col-span-4 card-base p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-semibold text-slate-900">Model Performance</h3>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-2 text-center pb-5 border-b border-border">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">MAE</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">4.32</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">RMSE</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">6.87</div>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-brand">
                <div className="text-[10px] uppercase font-bold text-brand">WAPE</div>
                <div className="text-base font-bold text-brand mt-0.5">8.5%</div>
              </div>
            </div>

            {/* Model Metadata */}
            <div className="space-y-3 pt-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Active Model:</span>
                <span className="font-semibold text-slate-800">Random Forest</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Model Version:</span>
                <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">RF-v1</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Training Window:</span>
                <span className="text-slate-700">2025-01-01 to 2026-04-30</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-slate-400">Baseline evaluation: MAE 5.80</span>
            <span className="text-status-success font-semibold">&uarr; 25% better</span>
          </div>
        </div>
      </div>
    </div>
  );
}
