import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { inventoryService } from '../../services/inventoryService';
import { medicineService } from '../../services/medicineService';
import { supplierService } from '../../services/supplierService';
import { useToast } from '../../context/ToastContext';

export default function ReceiveStockModal({ isOpen, onClose, onSuccess }) {
  const { showToast } = useToast();

  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [formData, setFormData] = useState({
    medicineId: '',
    supplierId: '',
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    quantity: '',
    purchaseCostPerUnit: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingData(true);
      Promise.all([
        medicineService.getMedicines({ limit: 100, status: 'active' }),
        supplierService.getSuppliers({ limit: 100, isActive: 'true' }),
      ])
        .then(([medRes, supRes]) => {
          setMedicines(medRes.data || []);
          setSuppliers(supRes.data || []);
        })
        .catch(() => {
          showToast('Failed to load medicine or supplier lists', 'error');
        })
        .finally(() => {
          setLoadingData(false);
        });

      // Default dates
      const today = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      const defaultExp = nextYear.toISOString().split('T')[0];

      setFormData({
        medicineId: '',
        supplierId: '',
        batchNumber: '',
        manufacturingDate: today,
        expiryDate: defaultExp,
        quantity: '',
        purchaseCostPerUnit: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.medicineId) newErrors.medicineId = 'Please select a medicine';
    if (!formData.supplierId) newErrors.supplierId = 'Please select a supplier';
    if (!formData.batchNumber.trim()) newErrors.batchNumber = 'Batch number is required';
    if (!formData.manufacturingDate) newErrors.manufacturingDate = 'Manufacturing date is required';
    if (!formData.expiryDate) newErrors.expiryDate = 'Expiry date is required';
    if (
      formData.manufacturingDate &&
      formData.expiryDate &&
      new Date(formData.expiryDate) <= new Date(formData.manufacturingDate)
    ) {
      newErrors.expiryDate = 'Expiry date must be after manufacturing date';
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be at least 1';
    }
    if (formData.purchaseCostPerUnit !== '' && Number(formData.purchaseCostPerUnit) < 0) {
      newErrors.purchaseCostPerUnit = 'Cost per unit must be non-negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      await inventoryService.receiveStock({
        medicineId: formData.medicineId,
        supplierId: formData.supplierId,
        batchNumber: formData.batchNumber.trim().toUpperCase(),
        manufacturingDate: formData.manufacturingDate,
        expiryDate: formData.expiryDate,
        quantity: Number(formData.quantity),
        purchaseCostPerUnit:
          formData.purchaseCostPerUnit === '' ? 0 : Number(formData.purchaseCostPerUnit),
      });

      showToast(`Stock received successfully: +${formData.quantity} units logged to ledger!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.error?.message || 'Failed to receive stock';
      showToast(msg, 'error');
      if (err.error?.details) {
        const fieldErrors = {};
        err.error.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const medicineOptions = medicines.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.medicineCode})`,
  }));

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Stock Batch"
      subtitle="Register incoming stock batch and record an immutable receipt transaction in ledger"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Medicine *"
          name="medicineId"
          value={formData.medicineId}
          onChange={handleChange}
          options={medicineOptions}
          placeholder={loadingData ? 'Loading medicines...' : 'Select a medicine...'}
          error={errors.medicineId}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Batch Number *"
            name="batchNumber"
            value={formData.batchNumber}
            onChange={handleChange}
            placeholder="e.g. B-2026-101"
            error={errors.batchNumber}
          />
          <Select
            label="Supplier *"
            name="supplierId"
            value={formData.supplierId}
            onChange={handleChange}
            options={supplierOptions}
            placeholder={loadingData ? 'Loading suppliers...' : 'Select supplier...'}
            error={errors.supplierId}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Manufacturing Date *"
            name="manufacturingDate"
            type="date"
            value={formData.manufacturingDate}
            onChange={handleChange}
            error={errors.manufacturingDate}
          />
          <Input
            label="Expiry Date *"
            name="expiryDate"
            type="date"
            value={formData.expiryDate}
            onChange={handleChange}
            error={errors.expiryDate}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Received Quantity (Units) *"
            name="quantity"
            type="number"
            min="1"
            value={formData.quantity}
            onChange={handleChange}
            placeholder="e.g. 500"
            error={errors.quantity}
          />
          <Input
            label="Purchase Cost per Unit ($/unit)"
            name="purchaseCostPerUnit"
            type="number"
            step="0.01"
            min="0"
            value={formData.purchaseCostPerUnit}
            onChange={handleChange}
            placeholder="e.g. 1.25"
            error={errors.purchaseCostPerUnit}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            Receive & Post to Ledger
          </Button>
        </div>
      </form>
    </Modal>
  );
}
