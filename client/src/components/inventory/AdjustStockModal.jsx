import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { inventoryService } from '../../services/inventoryService';
import { useToast } from '../../context/ToastContext';
import { Sliders } from 'lucide-react';

export default function AdjustStockModal({ isOpen, onClose, batch, onSuccess }) {
  const { showToast } = useToast();
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!batch) return null;

  const currentQty = batch.currentQuantity ?? 0;
  const changeNum = Number(quantityChange) || 0;
  const newBalance = currentQty + changeNum;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quantityChange || changeNum === 0) {
      setError('Quantity change must be a non-zero integer (+ or -)');
      return;
    }
    if (newBalance < 0) {
      setError(`Cannot adjust below 0. Current balance is ${currentQty}`);
      return;
    }
    if (!reason.trim()) {
      setError('A reason is mandatory for cycle audit adjustments');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await inventoryService.adjustStock({
        batchId: batch.id,
        quantityChange: changeNum,
        reason: reason.trim(),
      });

      showToast(`Batch ${batch.batchNumber} adjusted (${changeNum > 0 ? `+${changeNum}` : changeNum})!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.error?.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adjust Stock — Batch ${batch.batchNumber}`}
      subtitle={`Medicine: ${batch.medicineId?.name || 'Selected Medicine'} • Current Stock: ${currentQty}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-status-critical border border-red-200 rounded-lg text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Quantity Change (+ / -) *
          </label>
          <input
            type="number"
            value={quantityChange}
            onChange={(e) => {
              setQuantityChange(e.target.value);
              setError('');
            }}
            placeholder="e.g. -2 or +5"
            className="input-base text-sm font-semibold"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            Projected Balance After Adjustment:{' '}
            <strong className={newBalance < 0 ? 'text-status-critical' : 'text-slate-800'}>
              {newBalance}
            </strong>{' '}
            units
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Mandatory Reason *
          </label>
          <textarea
            rows="3"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="e.g. Physical cycle count discrepancy after quarterly audit"
            className="input-base text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            Commit Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
