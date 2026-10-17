import mongoose from 'mongoose';

const forecastDaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    predicted: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const forecastSchema = new mongoose.Schema(
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
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    forecastStartDate: {
      type: String,
      required: true
    },
    forecastEndDate: {
      type: String,
      required: true
    },
    horizonDays: {
      type: Number,
      enum: [7, 15, 30],
      required: true
    },
    modelName: {
      type: String,
      required: true
    },
    modelVersion: {
      type: String,
      required: true
    },
    predictedDailyDemand: [forecastDaySchema],
    predictedTotalDemand: {
      type: Number,
      required: true,
      min: 0
    },
    evaluationMetrics: {
      mae: { type: Number, default: null },
      rmse: { type: Number, default: null },
      wape: { type: Number, default: null },
      baselineMae: { type: Number, default: null },
      baselineRmse: { type: Number, default: null },
      baselineWape: { type: Number, default: null },
      holdoutDays: { type: Number, default: 0 }
    },
    dataWindow: {
      from: { type: String, default: null },
      to: { type: String, default: null },
      days: { type: Number, default: 0 },
      maskedDays: { type: Number, default: 0 }
    },
    provisional: {
      type: Boolean,
      default: false
    },
    warnings: [{ type: String }],
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed'
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

forecastSchema.index({ medicineId: 1, generatedAt: -1 });

export const Forecast = mongoose.model('Forecast', forecastSchema);
