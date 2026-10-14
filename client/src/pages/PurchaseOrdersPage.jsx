import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Plus, Search, Eye, Edit2 } from 'lucide-react';

const mockOrders = [
  { id: '1', poNo: 'PO-001', supplier: 'Pharma Co.', orderDate: '2026-04-20', expected: '2026-04-25', status: 'Pending' },
  { id: '2', poNo: 'PO-002', supplier: 'HealthPlus', orderDate: '2026-04-18', expected: '2026-04-25', status: 'Approved' },
  { id: '3', poNo: 'PO-003', supplier: 'MedSupply', orderDate: '2026-04-15', expected: '2026-04-15', status: 'Approved' },
  { id: '4', poNo: 'PO-004', supplier: 'CareLife', orderDate: '2026-04-10', expected: '2026-04-12', status: 'Received' },
  { id: '5', poNo: 'PO-005', supplier: 'Pharma Co.', orderDate: '2026-04-05', expected: '2026-04-12', status: 'Cancelled' },
];

export default function PurchaseOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage end-to-end procurement lifecycle from draft requisition to multi-batch stock receipt"
      >
        <Button variant="primary" icon={Plus}>
          + Create PO
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search purchase orders..."
            className="input-base pl-9 text-xs py-2"
          />
        </div>
      </div>

      {/* Table matching Screen 11 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">PO No.</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Expected Delivery</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{po.poNo}</td>
                  <td className="py-3 px-4 text-slate-700">{po.supplier}</td>
                  <td className="py-3 px-4 text-slate-600">{po.orderDate}</td>
                  <td className="py-3 px-4 text-slate-600">{po.expected}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={po.status}>{po.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button className="hover:text-brand p-1" title="View details">
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
