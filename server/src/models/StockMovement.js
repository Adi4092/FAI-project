import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    movementType: {
      type: String,
      enum: ['receipt', 'dispense', 'return', 'adjustment', 'expiry_writeoff', 'correction'],
      required: true,
      index: true
    },
    quantityChange: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return Number.isInteger(v) && v !== 0;
        },
        message: 'quantityChange must be a non-zero integer.'
      }
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },
    referenceType: {
      type: String,
      enum: ['purchase_order', 'manual', 'import', 'system'],
      default: 'manual'
    },
    referenceId: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      default: ''
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    reversesMovementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockMovement',
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

// Compound indexes
stockMovementSchema.index({ batchId: 1, timestamp: -1 });
stockMovementSchema.index({ medicineId: 1, timestamp: -1 });

// Strictly enforce immutability: block updates and deletes
const immutableError = new Error('StockMovement ledger entries are immutable and cannot be modified or deleted.');

stockMovementSchema.pre('updateOne', function () { throw immutableError; });
stockMovementSchema.pre('updateMany', function () { throw immutableError; });
stockMovementSchema.pre('findOneAndUpdate', function () { throw immutableError; });
stockMovementSchema.pre('deleteOne', function () { throw immutableError; });
stockMovementSchema.pre('deleteMany', function () { throw immutableError; });
stockMovementSchema.pre('findOneAndDelete', function () { throw immutableError; });
stockMovementSchema.pre('findOneAndReplace', function () { throw immutableError; });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
