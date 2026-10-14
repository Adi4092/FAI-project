import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { inventoryService } from '../../services/inventoryService';
import { medicineService } from '../../services/medicineService';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatDate';
import { ShieldCheck, AlertTriangle, ArrowUpFromLine } from 'lucide-react';

export default function DispenseModal({ isOpen, onClose, onSuccess, initialMedicineId = '' }) {
  const { showToast } = useToast();

  const [medicines, setMedicines] = useState([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  const [medicineId, setMedicineId] = useState(initialMedicineId);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  // FEFO preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fefoPlan, setFefoPlan] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingMedicines(true);
      medicineService
        .getMedicines({ limit: 100, status: 'active' })
        .then((res) => {
          setMedicines(res.data || []);
        })
        .catch(() => {
          showToast('Failed to load medicine list', 'error');
        })
        .finally(() => {
          setLoadingMedicines(false);
        });

      setMedicineId(initialMedicineId || '');
      setQuantity('');
      setNote('');
      setFefoPlan(null);
      setPreviewError(null);
    }
  }, [isOpen, initialMedicineId]);

  // Fetch FEFO Preview whenever medicine and valid positive quantity are selected
  useEffect(() => {
    if (!medicineId || !quantity || Number(quantity) <= 0) {
      setFefoPlan(null);
      setPreviewError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const res = await inventoryService.getFefoPreview(medicineId, Number(quantity));
        setFefoPlan(res.data);
      } catch (err) {
        setFefoPlan(null);
        setPreviewError(err.error?.message || 'Unable to generate FEFO preview');
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [medicineId, quantity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicineId) {
      showToast('Please select a medicine to dispense', 'error');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      showToast('Quantity must be at least 1 unit', 'error');
      return;
    }
    if (fefoPlan && !fefoPlan.sufficientStock) {
      showToast('Cannot dispense: Insufficient active stock', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await inventoryService.dispenseStock({
        medicineId,
        quantity: Number(quantity),
        note: note.trim(),
        // If allocations are left empty or omitted, backend strictly enforces server-side FEFO
      });

      const totalDispensed = res.data?.totalDispensed || quantity;
      showToast(`Successfully dispensed ${totalDispensed} units via FEFO allocation!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.error?.message || 'Failed to dispense stock', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const medicineOptions = medicines.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.medicineCode}) — ${m.usableStock ?? 0} ${m.unit}s available`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispense Stock (FEFO Enforced)"
      subtitle="First-Expiry-First-Out algorithm automatically selects the earliest-expiring active batches"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Select Medicine *"
          name="medicineId"
          value={medicineId}
          onChange={(e) => setMedicineId(e.target.value)}
          options={medicineOptions}
          placeholder={loadingMedicines ? 'Loading medicines catalogue...' : 'Choose a medicine...'}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity to Dispense *"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 30"
          />
          <Input
            label="Prescription / Requisition Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Ward 3 Inpatient Requisition"
          />
        </div>

        {/* Live FEFO Plan Breakdown */}
        {previewLoading && (
          <div className="p-4 bg-slate-50 rounded-lg border border-border text-center text-xs text-slate-500 animate-pulse">
            Calculating optimal FEFO batch allocations...
          </div>
        )}

        {previewError && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-status-critical flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{previewError}</span>
          </div>
        )}

        {fefoPlan && !previewLoading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-status-success" />
                FEFO Allocation Plan
              </span>
              <span className="text-[11px] text-slate-500">
                Total Required:{' '}
                <strong className="text-slate-800">{fefoPlan.requestedQuantity}</strong> units
              </span>
            </div>

            {!fefoPlan.sufficientStock && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>
                  Insufficient usable stock available. Only{' '}
                  <strong>
                    {fefoPlan.allocations?.reduce((acc, a) => acc + a.allocatedQuantity, 0) || 0}
                  </strong>{' '}
                  units can be allocated from non-expired batches.
                </span>
              </div>
            )}

            <div className="border border-border rounded-lg overflow-hidden bg-white text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-semibold">
                    <th className="py-2 px-3">Batch</th>
                    <th className="py-2 px-3">Expiry Date</th>
                    <th className="py-2 px-3 text-right">Available</th>
                    <th className="py-2 px-3 text-right text-brand">Allocated</th>
                    <th className="py-2 px-3 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fefoPlan.allocations && fefoPlan.allocations.length > 0 ? (
                    fefoPlan.allocations.map((a, idx) => (
                      <tr key={a.batchId || idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">
                          {a.batchNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{formatDate(a.expiryDate)}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{a.currentQuantity}</td>
                        <td className="py-2 px-3 text-right font-bold text-brand">
                          -{a.allocatedQuantity}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-800">
                          {a.balanceAfter}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No active non-expired batches available for allocation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 rounded bg-blue-50/60 text-[11px] text-blue-800 border border-blue-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-brand" />
              <span>
                Safety Rule: Expired batches are excluded from dispensing. Every allocation will
                write an individual immutable ledger record.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={ArrowUpFromLine}
            loading={submitting}
            disabled={!fefoPlan || !fefoPlan.sufficientStock || previewLoading}
          >
            Confirm & Dispense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
