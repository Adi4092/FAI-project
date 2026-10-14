import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { medicineService } from '../../services/medicineService';
import { useToast } from '../../context/ToastContext';

const CATEGORY_OPTIONS = [
  { value: 'Antibiotic', label: 'Antibiotic' },
  { value: 'Analgesic', label: 'Analgesic' },
  { value: 'NSAID', label: 'NSAID' },
  { value: 'Antidiabetic', label: 'Antidiabetic' },
  { value: 'PPI', label: 'PPI (Proton-Pump Inhibitor)' },
  { value: 'Antihypertensive', label: 'Antihypertensive' },
  { value: 'Antihistamine', label: 'Antihistamine' },
  { value: 'Respiratory', label: 'Respiratory' },
  { value: 'Antiviral', label: 'Antiviral' },
  { value: 'Other', label: 'Other' },
];

const UNIT_OPTIONS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'vial', label: 'Vial' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'bottle', label: 'Bottle (ml)' },
  { value: 'tube', label: 'Tube (g)' },
];

export default function MedicineFormModal({
  isOpen,
  onClose,
  medicine = null, // null for create, object for edit
  onSuccess,
}) {
  const isEdit = !!medicine;
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    medicineCode: '',
    name: '',
    category: 'Antibiotic',
    unit: 'tablet',
    description: '',
    reorderLevel: 50,
    safetyStock: 20,
    isActive: true,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (medicine) {
      setFormData({
        medicineCode: medicine.medicineCode || '',
        name: medicine.name || '',
        category: medicine.category || 'Antibiotic',
        unit: medicine.unit || 'tablet',
        description: medicine.description || '',
        reorderLevel: medicine.reorderLevel ?? 50,
        safetyStock: medicine.safetyStock ?? 20,
        isActive: medicine.isActive ?? true,
      });
    } else {
      setFormData({
        medicineCode: '',
        name: '',
        category: 'Antibiotic',
        unit: 'tablet',
        description: '',
        reorderLevel: 50,
        safetyStock: 20,
        isActive: true,
      });
    }
    setErrors({});
  }, [medicine, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? value === '' ? '' : Number(value)
          : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!isEdit && !formData.medicineCode.trim()) {
      newErrors.medicineCode = 'Medicine code is required (e.g. MED-001)';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Medicine name is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.unit) {
      newErrors.unit = 'Unit is required';
    }
    if (formData.reorderLevel === '' || formData.reorderLevel < 0) {
      newErrors.reorderLevel = 'Reorder level must be a non-negative integer';
    }
    if (formData.safetyStock === '' || formData.safetyStock < 0) {
      newErrors.safetyStock = 'Safety stock must be a non-negative integer';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      if (isEdit) {
        await medicineService.updateMedicine(medicine.id, {
          name: formData.name.trim(),
          category: formData.category,
          unit: formData.unit,
          description: formData.description.trim(),
          reorderLevel: Number(formData.reorderLevel),
          safetyStock: Number(formData.safetyStock),
        });
        showToast('Medicine updated successfully!', 'success');
      } else {
        await medicineService.createMedicine({
          medicineCode: formData.medicineCode.trim().toUpperCase(),
          name: formData.name.trim(),
          category: formData.category,
          unit: formData.unit,
          description: formData.description.trim(),
          reorderLevel: Number(formData.reorderLevel),
          safetyStock: Number(formData.safetyStock),
          isActive: formData.isActive,
        });
        showToast('Medicine created successfully!', 'success');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.error?.message || (isEdit ? 'Failed to update medicine' : 'Failed to create medicine');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Medicine — ${medicine?.medicineCode}` : 'Add New Medicine'}
      subtitle={
        isEdit
          ? 'Update threshold configurations and formulation details'
          : 'Register a new medicine into the inventory catalogue'
      }
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <Input
            label="Medicine Code *"
            name="medicineCode"
            value={formData.medicineCode}
            onChange={handleChange}
            placeholder="e.g. MED-042"
            error={errors.medicineCode}
            helperText="Unique uppercase identifier for cataloguing and tracking"
          />
        )}

        <Input
          label="Medicine Name *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. Paracetamol 500mg"
          error={errors.name}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category *"
            name="category"
            value={formData.category}
            onChange={handleChange}
            options={CATEGORY_OPTIONS}
            error={errors.category}
          />
          <Select
            label="Dosage Unit *"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            options={UNIT_OPTIONS}
            error={errors.unit}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Reorder Level *"
            name="reorderLevel"
            type="number"
            min="0"
            value={formData.reorderLevel}
            onChange={handleChange}
            error={errors.reorderLevel}
            helperText="Triggers replenishment alert"
          />
          <Input
            label="Safety Stock"
            name="safetyStock"
            type="number"
            min="0"
            value={formData.safetyStock}
            onChange={handleChange}
            error={errors.safetyStock}
            helperText="Buffer against lead time volatility"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            name="description"
            rows="2"
            value={formData.description}
            onChange={handleChange}
            className="input-base text-xs"
            placeholder="Clinical notes, storage temperature, or formulation specifications..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Medicine'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
