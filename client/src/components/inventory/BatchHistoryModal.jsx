import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Skeleton from '../common/Skeleton';
import { batchService } from '../../services/batchService';
import { formatDate } from '../../utils/formatDate';
import { History, ShieldAlert } from 'lucide-react';

export default function BatchHistoryModal({ isOpen, onClose, batch }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (batch?.id && isOpen) {
      setLoading(true);
      setError(null);
      batchService
        .getBatchHistory(batch.id)
        .then((res) => {
          setHistory(res.data || []);
        })
        .catch((err) => {
          setError(err.error?.message || 'Failed to fetch batch ledger entries');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [batch?.id, isOpen]);

  if (!batch) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Batch Ledger History — ${batch.batchNumber}`}
      subtitle={`Medicine: ${batch.medicineId?.name || 'Selected Medicine'} • Immutable Ledger Trail`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {loading ? (
          <Skeleton variant="table-row" count={4} />
        ) : error ? (
          <div className="p-4 bg-red-50 text-status-critical rounded-lg text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-border rounded-lg">
            No stock movements recorded for this batch yet.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Change</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Reason / Ref</th>
                    <th className="py-2.5 px-3">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((m) => {
                    const isPositive = m.quantityChange > 0;
                    return (
                      <tr key={m.id || m._id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(m.timestamp)}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              m.movementType === 'receipt'
                                ? 'success'
                                : m.movementType === 'dispense'
                                ? 'critical'
                                : m.movementType === 'correction'
                                ? 'neutral'
                                : 'warning'
                            }
                          >
                            {m.movementType}
                          </Badge>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${
                            isPositive ? 'text-status-success' : 'text-status-critical'
                          }`}
                        >
                          {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {m.balanceBefore} → <strong className="text-slate-900">{m.balanceAfter}</strong>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={m.reason}>
                          {m.reason || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {m.performedBy?.name || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
