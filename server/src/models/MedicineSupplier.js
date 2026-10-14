import mongoose from 'mongoose';

const medicineSupplierSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true
    },
    leadTimeDays: {
      type: Number,
      min: 0,
      default: 7
    },
    minOrderQty: {
      type: Number,
      min: 1,
      default: 1
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0
    },
    isPreferred: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

medicineSupplierSchema.index({ medicineId: 1, supplierId: 1 }, { unique: true });

export const MedicineSupplier = mongoose.model('MedicineSupplier', medicineSupplierSchema);
