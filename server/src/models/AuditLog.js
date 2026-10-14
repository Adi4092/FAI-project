import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      index: true
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    reason: {
      type: String,
      default: ''
    },
    ip: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
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

// Append-only rule: block update and delete
const appendOnlyError = new Error('AuditLog records are append-only and cannot be modified or deleted.');

auditLogSchema.pre('updateOne', function () { throw appendOnlyError; });
auditLogSchema.pre('updateMany', function () { throw appendOnlyError; });
auditLogSchema.pre('findOneAndUpdate', function () { throw appendOnlyError; });
auditLogSchema.pre('deleteOne', function () { throw appendOnlyError; });
auditLogSchema.pre('deleteMany', function () { throw appendOnlyError; });
auditLogSchema.pre('findOneAndDelete', function () { throw appendOnlyError; });
auditLogSchema.pre('findOneAndReplace', function () { throw appendOnlyError; });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
