import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Plus, Search, Filter, Boxes, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Eye } from 'lucide-react';

const mockBatches = [
  { id: 'b1', medicine: 'Paracetamol 500mg', batchNo: 'B001', qty: 100, expiry: '2026-06-15', supplier: 'HealthPlus', status: 'Healthy' },
  { id: 'b2', medicine: 'Amoxicillin 250mg', batchNo: 'B002', qty: 50, expiry: '2026-05-20', supplier: 'MedSupply', status: 'Expiring Soon' },
  { id: 'b3', medicine: 'Ibuprofen 400mg', batchNo: 'B003', qty: 80, expiry: '2027-01-10', supplier: 'Pharma Co.', status: 'Healthy' },
  { id: 'b4', medicine: 'Metformin 500mg', batchNo: 'B004', qty: 200, expiry: '2026-09-05', supplier: 'CareLife', status: 'Healthy' },
  { id: 'b5', medicine: 'Ciprofloxacin 500mg', batchNo: 'B005', qty: 30, expiry: '2026-05-30', supplier: 'HealthPlus', status: 'Expiring Soon' },
  { id: 'b6', medicine: 'Omeprazole 20mg', batchNo: 'B006', qty: 150, expiry: '2027-02-15', supplier: 'MedSupply', status: 'Healthy' },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('usable');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch & Inventory Management"
        subtitle="Track stock levels by batch with immutable ledger and FEFO enforcement"
      >
        <Button variant="secondary" icon={ArrowUpFromLine}>
          Dispense Stock (FEFO)
        </Button>
        <Button variant="primary" icon={Plus}>
          + Add Batch
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab('usable')}
          className={`pb-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'usable' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Usable Stock (Active Batches)
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`pb-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'expired' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Expired & Quarantined Stock
        </button>
      </div>

      {/* Filter and Search Bar matching Screen 04 */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search batches, medicine, batch no..."
            className="input-base pl-9 text-xs py-2"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select className="input-base text-xs py-2 w-auto">
            <option>All Medicines</option>
            <option>Paracetamol 500mg</option>
            <option>Amoxicillin 250mg</option>
          </select>
          <select className="input-base text-xs py-2 w-auto">
            <option>All Suppliers</option>
            <option>HealthPlus</option>
            <option>MedSupply</option>
            <option>Pharma Co.</option>
          </select>
        </div>
      </div>

      {/* Table matching Screen 04 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Batch No.</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{b.medicine}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono">{b.batchNo}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{b.qty}</td>
                  <td className="py-3 px-4 text-slate-600">{b.expiry}</td>
                  <td className="py-3 px-4 text-slate-600">{b.supplier}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={b.status}>{b.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button className="hover:text-brand p-1" title="View history">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
