import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';

// Only actions that are security-sensitive or change important state get logged.
// Adding a new one here is deliberate — resist the urge to log everything.
export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_CREATED_BY_ADMIN = 'USER_CREATED_BY_ADMIN',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  EMPLOYEE_CREATED = 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED = 'EMPLOYEE_UPDATED',
  EMPLOYEE_STATUS_CHANGED = 'EMPLOYEE_STATUS_CHANGED',
  USER_ACCESS_GRANTED = 'USER_ACCESS_GRANTED',
  USER_ACCESS_REVOKED = 'USER_ACCESS_REVOKED',
  ASSET_CREATED = 'ASSET_CREATED',
  ASSET_UPDATED = 'ASSET_UPDATED',
  ASSET_STATUS_CHANGED = 'ASSET_STATUS_CHANGED',
  ASSET_ASSIGNED = 'ASSET_ASSIGNED',
  ASSET_RETURNED = 'ASSET_RETURNED',
  LICENSE_SEAT_ALLOCATED = 'LICENSE_SEAT_ALLOCATED',
  LICENSE_SEAT_REVOKED = 'LICENSE_SEAT_REVOKED',
  MAINTENANCE_STARTED = 'MAINTENANCE_STARTED',
  MAINTENANCE_COMPLETED = 'MAINTENANCE_COMPLETED',
  MAINTENANCE_CANCELLED = 'MAINTENANCE_CANCELLED',
  REPORT_DOWNLOADED = 'REPORT_DOWNLOADED',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export interface AuditActor {
  id?: Types.ObjectId;
  name: string;
  email: string;
  role: string;
}

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuditLog extends Document {
  actor: AuditActor;
  action: AuditAction;
  status: AuditStatus;
  entityType: string;
  entityId?: Types.ObjectId;
  description: string;
  changes?: AuditChanges;
  metadata?: AuditMetadata;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      id: { type: Schema.Types.ObjectId, ref: 'User' }, // kept for querying "actions by this user ID", even though name/email/role are the source of truth for display
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
    },
    action: { type: String, enum: AuditAction, required: true },
    status: { type: String, enum: AuditStatus, required: true, default: AuditStatus.SUCCESS },
    entityType: { type: String, required: true }, // e.g. 'User', 'Asset' (string, not a hard enum — new modules add new entity types over time)
    entityId: { type: Schema.Types.ObjectId },
    description: { type: String, required: true }, // human-readable summary, e.g. "Role changed from employee to asset_manager"
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // immutable — there's no legitimate "updatedAt"
  }
);

// Query patterns this schema is optimized for:
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 }); // "history of this specific asset/user"
auditLogSchema.index({ 'actor.id': 1, createdAt: -1 });              // "everything this admin did"
auditLogSchema.index({ action: 1, createdAt: -1 });                  // "all failed logins"
auditLogSchema.index({ createdAt: -1 });                             // general reverse-chronological listing

// ---- Defense in depth: block mutation at the driver level ----
// The API layer never exposes update/delete routes for this collection.
// These hooks guard against a future developer accidentally adding one,
// or direct DB access bypassing the API entirely.
const blockMutation = (next: (err?: Error) => void): void => {
  next(new Error('AuditLog entries are immutable and cannot be modified or deleted'));
};
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('updateOne', function (next) { blockMutation(next); });
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('findOneAndUpdate', function (next) { blockMutation(next); });
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('updateMany', function (next) { blockMutation(next); });
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('deleteOne', function (next) { blockMutation(next); });
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('findOneAndDelete', function (next) { blockMutation(next); });
// @ts-ignore - Mongoose query hook signature differs from document hook
auditLogSchema.pre('deleteMany', function (next) { blockMutation(next); });

export const AuditLog = (mongoose.models.AuditLog as Model<IAuditLog>) ?? model<IAuditLog>('AuditLog', auditLogSchema);