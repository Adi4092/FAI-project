import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    address: {
      type: String,
      default: '',
      trim: true
    },
    defaultLeadTimeDays: {
      type: Number,
      required: true,
      min: 0,
      default: 7
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

export const Supplier = mongoose.model('Supplier', supplierSchema);
