import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Plus, Search, Truck } from 'lucide-react';

const mockSuppliers = [
  { id: '1', name: 'Pharma Co.', contact: 'John Doe', phone: '+91 98765 43210', email: 'john@pharmaco.com', leadTime: '5 days', status: 'Active' },
  { id: '2', name: 'HealthPlus', contact: 'Sarah Johnson', phone: '+91 87654 32109', email: 'sarah@healthplus.com', leadTime: '7 days', status: 'Active' },
  { id: '3', name: 'MedSupply', contact: 'Rajesh Kumar', phone: '+91 76543 21098', email: 'rajesh@medsupply.com', leadTime: '6 days', status: 'Active' },
  { id: '4', name: 'CareLife', contact: 'Priya Sharma', phone: '+91 65432 10987', email: 'priya@carelife.com', leadTime: '4 days', status: 'Active' },
];

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Management"
        subtitle="Maintain vendor records, contracted lead times, and catalogue procurement links"
      >
        <Button variant="primary" icon={Plus}>
          + Add Supplier
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search suppliers..."
            className="input-base pl-9 text-xs py-2"
          />
        </div>
      </div>

      {/* Table matching Screen 10 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Lead Time</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{s.name}</td>
                  <td className="py-3 px-4 text-slate-600">{s.contact}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono">{s.phone}</td>
                  <td className="py-3 px-4 text-slate-600">{s.email}</td>
                  <td className="py-3 px-4 text-slate-600">{s.leadTime}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge status="healthy">{s.status}</Badge>
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
