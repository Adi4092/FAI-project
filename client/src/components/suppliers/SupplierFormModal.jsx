import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { supplierService } from '../../services/supplierService';
import { useToast } from '../../context/ToastContext';

export default function SupplierFormModal({
  isOpen,
  onClose,
  supplier = null,
  onSuccess,
}) {
  const isEdit = !!supplier;
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    defaultLeadTimeDays: 7,
    isActive: true,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        defaultLeadTimeDays: supplier.defaultLeadTimeDays ?? 7,
        isActive: supplier.isActive ?? true,
      });
    } else {
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        defaultLeadTimeDays: 7,
        isActive: true,
      });
    }
    setErrors({});
  }, [supplier, isOpen]);

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
    if (!formData.name.trim()) newErrors.name = 'Supplier name is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (formData.defaultLeadTimeDays === '' || formData.defaultLeadTimeDays < 0) {
      newErrors.defaultLeadTimeDays = 'Lead time must be a non-negative integer';
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
        await supplierService.updateSupplier(supplier.id, {
          name: formData.name.trim(),
          contactPerson: formData.contactPerson.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          defaultLeadTimeDays: Number(formData.defaultLeadTimeDays),
        });
        showToast('Supplier updated successfully!', 'success');
      } else {
        await supplierService.createSupplier({
          name: formData.name.trim(),
          contactPerson: formData.contactPerson.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          defaultLeadTimeDays: Number(formData.defaultLeadTimeDays),
          isActive: formData.isActive,
        });
        showToast('Supplier created successfully!', 'success');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.error?.message || (isEdit ? 'Failed to update supplier' : 'Failed to create supplier');
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
      title={isEdit ? `Edit Supplier — ${supplier?.name}` : 'Add New Supplier'}
      subtitle={
        isEdit
          ? 'Update supplier contact details and replenishment lead time defaults'
          : 'Register a pharmaceutical distributor or vendor'
      }
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Supplier / Vendor Name *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. HealthPlus Pharma Ltd."
          error={errors.name}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contact Person"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            placeholder="e.g. Sarah Johnson"
            error={errors.contactPerson}
          />
          <Input
            label="Contracted Lead Time (Days) *"
            name="defaultLeadTimeDays"
            type="number"
            min="0"
            value={formData.defaultLeadTimeDays}
            onChange={handleChange}
            error={errors.defaultLeadTimeDays}
            helperText="Used for reorder calculation"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="e.g. orders@healthplus.com"
            error={errors.email}
          />
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. +91 98765 43210"
            error={errors.phone}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Warehouse Address</label>
          <textarea
            name="address"
            rows="2"
            value={formData.address}
            onChange={handleChange}
            className="input-base text-xs"
            placeholder="Physical warehouse address, sector, city..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
