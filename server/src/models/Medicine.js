import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    medicineCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    reorderLevel: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    safetyStock: {
      type: Number,
      min: 0,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
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

medicineSchema.index({ name: 'text', description: 'text' });

export const Medicine = mongoose.model('Medicine', medicineSchema);
