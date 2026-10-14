import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { stockMovementService } from '../../services/stockMovementService';
import { useToast } from '../../context/ToastContext';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function CorrectMovementModal({ isOpen, onClose, movement, onSuccess }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!movement) return null;

  const compensatingChange = -movement.quantityChange;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is mandatory for logging a compensating ledger correction');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await stockMovementService.correctStockMovement(movement.id, reason.trim());
      showToast('Compensating correction logged to ledger successfully!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.error?.message || 'Failed to create compensating correction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Compensating Correction"
      subtitle="Stock movements are strictly immutable. Correction posts a compensating entry."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-status-critical border border-red-200 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Original Movement Context */}
        <div className="p-3.5 bg-slate-50 border border-border rounded-lg text-xs space-y-2">
          <div className="font-semibold text-slate-800">Target Movement:</div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              Medicine:{' '}
              <strong className="text-slate-800">
                {movement.medicine?.name || 'Unknown'}
              </strong>
            </div>
            <div>
              Batch:{' '}
              <strong className="font-mono text-slate-800">
                {movement.batch?.batchNumber || '—'}
              </strong>
            </div>
            <div>
              Original Type:{' '}
              <Badge variant="neutral">{movement.movementType}</Badge>
            </div>
            <div>
              Original Qty Change:{' '}
              <strong className={movement.quantityChange > 0 ? 'text-status-success' : 'text-status-critical'}>
                {movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}
              </strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 text-slate-800">
            Compensating Entry To Be Logged:{' '}
            <strong className="text-brand font-bold">
              {compensatingChange > 0 ? `+${compensatingChange}` : compensatingChange} units
            </strong>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Mandatory Correction Reason *
          </label>
          <textarea
            rows="3"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="e.g. Data entry discrepancy discovered during cycle count reconciliation"
            className="input-base text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" icon={RotateCcw} loading={submitting}>
            Post Compensating Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
}
