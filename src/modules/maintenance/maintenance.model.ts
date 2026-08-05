import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';

export enum MaintenanceType {
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
}

export enum MaintenanceStatus {
  OPEN = 'open',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface IMaintenance extends Document {
  _id: Types.ObjectId;
  asset: Types.ObjectId;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  vendor?: string;
  cost?: number;
  scheduledDate?: Date;
  startedDate: Date;
  completedDate?: Date;
  resolvedNotes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceSchema = new Schema<IMaintenance>(
  {
    asset: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    type: { type: String, enum: Object.values(MaintenanceType), required: true },
    status: { type: String, enum: Object.values(MaintenanceStatus), default: MaintenanceStatus.OPEN },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    vendor: { type: String, trim: true, maxlength: 150 },
    cost: { type: Number, min: 0 },
    scheduledDate: { type: Date },
    startedDate: { type: Date, required: true, default: Date.now },
    completedDate: { type: Date },
    resolvedNotes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

maintenanceSchema.index({ asset: 1, createdAt: -1 });
maintenanceSchema.index({ status: 1 });
// Prevents opening a second maintenance record while one is already OPEN for the same asset.
maintenanceSchema.index(
  { asset: 1 },
  { unique: true, partialFilterExpression: { status: MaintenanceStatus.OPEN } }
);

export const Maintenance =
  (mongoose.models.Maintenance as Model<IMaintenance>) ??
  model<IMaintenance>('Maintenance', maintenanceSchema);
