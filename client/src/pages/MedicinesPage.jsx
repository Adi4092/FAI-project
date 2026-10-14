import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Plus, Search, Filter, Pill, Eye, Edit2, Archive } from 'lucide-react';

const mockMedicines = [
  { id: '1', code: 'MED-001', name: 'Paracetamol 500mg', category: 'Analgesic', unit: 'tablet', totalStock: 250, reorderLevel: 50, status: 'Healthy' },
  { id: '2', code: 'MED-002', name: 'Amoxicillin 250mg', category: 'Antibiotic', unit: 'capsule', totalStock: 120, reorderLevel: 30, status: 'Healthy' },
  { id: '3', code: 'MED-003', name: 'Ibuprofen 400mg', category: 'NSAID', unit: 'tablet', totalStock: 80, reorderLevel: 20, status: 'Low Stock' },
  { id: '4', code: 'MED-004', name: 'Metformin 500mg', category: 'Antidiabetic', unit: 'tablet', totalStock: 200, reorderLevel: 50, status: 'Healthy' },
  { id: '5', code: 'MED-005', name: 'Ciprofloxacin 500mg', category: 'Antibiotic', unit: 'tablet', totalStock: 45, reorderLevel: 15, status: 'Low Stock' },
  { id: '6', code: 'MED-006', name: 'Omeprazole 20mg', category: 'PPI', unit: 'capsule', totalStock: 150, reorderLevel: 30, status: 'Healthy' },
];

export default function MedicinesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Catalogue"
        subtitle="Manage your medicine master data, active units, and replenishment thresholds"
      >
        <Button variant="primary" icon={Plus}>
          + Add Medicine
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or code..."
            className="input-base pl-9 text-xs py-2"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select className="input-base text-xs py-2 w-auto">
            <option>All Categories</option>
            <option>Antibiotic</option>
            <option>Analgesic</option>
            <option>NSAID</option>
            <option>Antidiabetic</option>
          </select>
          <select className="input-base text-xs py-2 w-auto">
            <option>All Status</option>
            <option>Healthy</option>
            <option>Low Stock</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      {/* Medicines Table matching Screen 03 */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4 text-right">Total Stock</th>
                <th className="py-3 px-4 text-right">Reorder Level</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockMedicines.map((med) => (
                <tr key={med.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{med.name}</div>
                    <div className="text-[10px] text-slate-400">{med.code}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{med.category}</td>
                  <td className="py-3 px-4 text-slate-600 capitalize">{med.unit}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{med.totalStock}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{med.reorderLevel}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={med.status}>{med.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button className="hover:text-brand p-1 transition-colors" title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="hover:text-brand p-1 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="hover:text-status-critical p-1 transition-colors" title="Archive">
                        <Archive className="w-3.5 h-3.5" />
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
