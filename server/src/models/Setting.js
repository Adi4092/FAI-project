import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    expiryWarningDays: {
      type: Number,
      default: 30
    },
    expiryBands: {
      type: [Number],
      default: [7, 30, 60, 90]
    },
    defaultForecastHorizon: {
      type: Number,
      enum: [7, 15, 30],
      default: 15
    },
    serviceLevelZ: {
      type: Number,
      default: 1.65
    },
    targetCoverageDays: {
      type: Number,
      default: 30
    },
    minHistoryDaysRandomForest: {
      type: Number,
      default: 60
    },
    minHistoryDaysBaseline: {
      type: Number,
      default: 14
    },
    riskThresholds: {
      mediumLeftoverPct: { type: Number, default: 10 },
      highLeftoverPct: { type: Number, default: 30 },
      criticalLeftoverPct: { type: Number, default: 60 },
      criticalDaysToExpiry: { type: Number, default: 14 }
    },
    notificationPrefs: {
      emailAlerts: { type: Boolean, default: false },
      inAppAlerts: { type: Boolean, default: true }
    },
    currency: {
      type: String,
      default: 'INR'
    },
    aiRetrainMinNewDays: {
      type: Number,
      default: 14
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

export const Setting = mongoose.model('Setting', settingSchema);
