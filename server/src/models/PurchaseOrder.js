import mongoose from 'mongoose';

const poItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true
    },
    quantityOrdered: {
      type: Number,
      required: true,
      min: 1
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0
    },
    quantityReceived: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { _id: false }
);

const poReceiptLineSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true
    },
    batchNumber: {
      type: String,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true
    },
    manufacturingDate: {
      type: Date,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch'
    }
  },
  { _id: false }
);

const poReceiptSchema = new mongoose.Schema(
  {
    receiptId: {
      type: String,
      required: true
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lines: [poReceiptLineSchema]
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true
    },
    items: [poItemSchema],
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled'],
      default: 'draft',
      index: true
    },
    expectedDeliveryDate: {
      type: Date,
      default: null
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    estimatedTotalCost: {
      type: Number,
      min: 0,
      default: 0
    },
    cancelReason: {
      type: String,
      default: null
    },
    receipts: [poReceiptSchema],
    sourceRecommendationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReorderRecommendation',
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
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
