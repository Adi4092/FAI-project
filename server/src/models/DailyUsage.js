import mongoose from 'mongoose';

const dailyUsageSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    unitsDispensed: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    unitsReceived: {
      type: Number,
      min: 0,
      default: 0
    },
    stockoutObserved: {
      type: Boolean,
      default: false
    },
    dataSource: {
      type: String,
      enum: ['ledger', 'import', 'synthetic'],
      default: 'ledger'
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

// One record per medicineId per date
dailyUsageSchema.index({ medicineId: 1, date: 1 }, { unique: true });

export const DailyUsage = mongoose.model('DailyUsage', dailyUsageSchema);
