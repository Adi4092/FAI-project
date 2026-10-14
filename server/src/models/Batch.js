import mongoose from 'mongoose';
import { isBatchExpired, calculateDaysToExpiry } from '../utils/dates.js';

const batchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
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
    manufacturingDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    currentQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    purchaseCostPerUnit: {
      type: Number,
      min: 0,
      default: 0
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'depleted', 'expired', 'quarantined'],
      default: 'active',
      index: true
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null
    },
    isDemo: {
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
        ret.isExpired = isBatchExpired(ret.expiryDate);
        ret.daysToExpiry = calculateDaysToExpiry(ret.expiryDate);
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes
batchSchema.index({ supplierId: 1, medicineId: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ medicineId: 1, expiryDate: 1 });
batchSchema.index({ medicineId: 1, status: 1 });

batchSchema.pre('validate', function (next) {
  if (this.manufacturingDate && this.expiryDate) {
    if (new Date(this.expiryDate) <= new Date(this.manufacturingDate)) {
      this.invalidate('expiryDate', 'Expiry date must be after manufacturing date.');
    }
  }
  next();
});

export const Batch = mongoose.model('Batch', batchSchema);
