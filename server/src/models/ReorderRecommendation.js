import mongoose from 'mongoose';

const reorderRecommendationSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    inputs: {
      usableStock: { type: Number, required: true },
      forecastLeadTimeDemand: { type: Number, required: true },
      safetyStock: { type: Number, required: true },
      reorderPoint: { type: Number, required: true },
      incomingConfirmed: { type: Number, required: true },
      outstandingOrders: { type: Number, required: true },
      targetCoverageDays: { type: Number, required: true },
      avgDailyDemand: { type: Number, required: true },
      leadTimeDays: { type: Number, required: true },
      minOrderQty: { type: Number, default: 0 },
      expiryRiskReduction: { type: Number, default: 0 }
    },
    suggestedQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    adjustedQuantity: {
      type: Number,
      default: null
    },
    preferredSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null
    },
    estimatedCost: {
      type: Number,
      default: null
    },
    reason: {
      type: String,
      required: true
    },
    formulaText: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'adjusted', 'ordered'],
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewNote: {
      type: String,
      default: null
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null
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

reorderRecommendationSchema.index({ medicineId: 1, status: 1 });

export const ReorderRecommendation = mongoose.model('ReorderRecommendation', reorderRecommendationSchema);
