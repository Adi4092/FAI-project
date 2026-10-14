import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Skeleton from '../common/Skeleton';
import { supplierService } from '../../services/supplierService';
import { formatDate } from '../../utils/formatDate';
import { Truck, Mail, Phone, MapPin, Clock, Boxes } from 'lucide-react';

export default function SupplierDetailModal({ isOpen, onClose, supplier }) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    if (supplier?.id && isOpen) {
      setLoadingBatches(true);
      supplierService
        .getSupplierBatches(supplier.id)
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
  }, [supplier?.id, isOpen]);

  if (!supplier) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier.name}
      subtitle={`Vendor ID: ${supplier.id} • Lead Time: ${supplier.defaultLeadTimeDays} days`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Contact Details Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-border rounded-lg text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Truck className="w-4 h-4 text-brand flex-shrink-0" />
            <span>Contact Person: <strong className="text-slate-900">{supplier.contactPerson || '—'}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-brand flex-shrink-0" />
            <span>Contracted Lead Time: <strong className="text-slate-900">{supplier.defaultLeadTimeDays} days</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="w-4 h-4 text-brand flex-shrink-0" />
            <span>Email: <strong className="text-slate-900">{supplier.email || '—'}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="w-4 h-4 text-brand flex-shrink-0" />
            <span>Phone: <strong className="text-slate-900">{supplier.phone || '—'}</strong></span>
          </div>
          {supplier.address && (
            <div className="sm:col-span-2 flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-200">
              <MapPin className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
              <span>Address: <span className="text-slate-900">{supplier.address}</span></span>
            </div>
          )}
        </div>

        {/* Supplied Batches */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Boxes className="w-4 h-4 text-brand" />
            Supplied Batches in Inventory ({batches.length})
          </h4>

          {loadingBatches ? (
            <Skeleton variant="table-row" count={3} />
          ) : batches.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg text-slate-400 text-xs">
              No batches on record from this supplier.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3 text-right">Current Qty</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((b) => (
                    <tr key={b.id || b._id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {b.medicineId?.name || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{b.batchNumber}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {b.currentQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{formatDate(b.expiryDate)}</td>
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
