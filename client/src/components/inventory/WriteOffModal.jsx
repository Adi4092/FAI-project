import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { inventoryService } from '../../services/inventoryService';
import { useToast } from '../../context/ToastContext';
import { AlertOctagon } from 'lucide-react';

export default function WriteOffModal({ isOpen, onClose, batch, onSuccess }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('Expired batch disposal — quarantined and discarded');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!batch) return null;

  const currentQty = batch.currentQuantity ?? 0;
  const cost = (currentQty * (batch.purchaseCostPerUnit ?? 0)).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is mandatory for inventory write-offs');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await inventoryService.writeOffStock({
        batchId: batch.id,
        reason: reason.trim(),
      });

      const realizedWastage = res.data?.realizedWastageCost ?? cost;
      showToast(
        `Batch ${batch.batchNumber} written off: ${currentQty} units removed ($${realizedWastage} realized wastage)`,
        'success'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.error?.message || 'Failed to write off batch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Write Off Batch — ${batch.batchNumber}`}
      subtitle="Quarantine disposal and write-off of remaining units"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-status-critical border border-red-200 rounded-lg text-xs">
            {error}
          </div>
        )}

        <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-lg text-xs space-y-2">
          <div className="flex items-center gap-2 text-status-critical font-bold">
            <AlertOctagon className="w-4 h-4 flex-shrink-0" />
            <span>Permanent Stock Removal & Wastage Realization</span>
          </div>
          <div className="text-slate-700 leading-relaxed">
            This operation will zero out the batch balance (
            <strong>{currentQty} units</strong>) and log an immutable write-off entry.
            Estimated financial cost realized: <strong>${cost}</strong>.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Mandatory Disposal / Write-Off Reason *
          </label>
          <textarea
            rows="3"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="e.g. Batch passed expiration date; quarantined and sent for biological destruction"
            className="input-base text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" loading={submitting}>
            Confirm Write-Off
          </Button>
        </div>
      </form>
    </Modal>
  );
}
