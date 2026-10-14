import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import { medicineService } from '../../services/medicineService';
import { formatDate } from '../../utils/formatDate';
import { Pill, Boxes, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';

export default function MedicineDetailModal({ isOpen, onClose, medicine }) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    if (medicine?.id && isOpen) {
      setLoadingBatches(true);
      medicineService
        .getMedicineBatches(medicine.id)
        .then((res) => {
          setBatches(res.data || []);
        })
        .catch(() => {
          setBatches([]);
        })
        .finally(() => {
          setLoadingBatches(false);
        });
    }
  }, [medicine?.id, isOpen]);

  if (!medicine) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${medicine.name} (${medicine.medicineCode})`}
      subtitle={`Category: ${medicine.category} • Unit: ${medicine.unit}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-slate-500 font-medium">Usable Stock</span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {medicine.usableStock ?? 0}{' '}
              <span className="text-xs font-normal text-slate-500">{medicine.unit}s</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-slate-500 font-medium">Reorder Level</span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {medicine.reorderLevel ?? 0}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-slate-500 font-medium">Safety Stock</span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {medicine.safetyStock ?? 0}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-slate-500 font-medium">Status</span>
            <div className="mt-1.5">
              <Badge status={medicine.isActive ? 'active' : 'inactive'}>
                {medicine.isActive ? 'Active' : 'Archived'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        {medicine.description && (
          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 block mb-0.5">Description:</span>
            {medicine.description}
          </div>
        )}

        {/* Associated Batches */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-brand" />
              Active Inventory Batches ({batches.length})
            </h4>
          </div>

          {loadingBatches ? (
            <Skeleton variant="table-row" count={3} />
          ) : batches.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg text-slate-400 text-xs">
              No active batches on record for this medicine.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-border text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Batch No</th>
                    <th className="py-2.5 px-3 text-right">Available Qty</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Days to Expiry</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((b) => (
                    <tr key={b.id || b._id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        {b.batchNumber}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {b.currentQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatDate(b.expiryDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            b.daysToExpiry <= 30
                              ? 'text-status-critical'
                              : b.daysToExpiry <= 90
                              ? 'text-status-warning'
                              : 'text-slate-600'
                          }`}
                        >
                          {b.daysToExpiry != null ? `${b.daysToExpiry} days` : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          status={
                            b.isExpired
                              ? 'expired'
                              : b.daysToExpiry <= 30
                              ? 'expiring'
                              : 'healthy'
                          }
                        >
                          {b.isExpired
                            ? 'Expired'
                            : b.daysToExpiry <= 30
                            ? 'Expiring Soon'
                            : 'Healthy'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
