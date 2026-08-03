import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

// NOTE: this is a DIFFERENT concept from UserRole.EMPLOYEE (the RBAC permission tier).
// This enum describes the person's employment lifecycle state — it has nothing to do
// with what they're allowed to click in the ITAM app.
export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  workLocation: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  dateOfJoining: Date;
  dateOfLeaving?: Date;
  reportingManager?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    // Immutable, human-readable business identifier — distinct from Mongo's _id.
    // This is what gets printed on asset tags, shown in reports, and referenced by HR/finance.
    employeeCode: { type: String, required: true, unique: true, immutable: true },

    firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true, maxlength: 50 },

    // Company/work email — the identity used for asset-assignment notifications, etc.
    // Deliberately independent of User.email: an employee can exist (and receive
    // asset notifications) long before — or without ever — getting a system login.
    email: {
      type: String,
      required: [true, 'Company email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: { type: String, trim: true },

    // Free-text for now (MVP) — see note below on why this isn't a `Department` collection yet.
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    workLocation: { type: String, required: true, trim: true },

    employmentType: {
      type: String,
      enum: Object.values(EmploymentType),
      default: EmploymentType.FULL_TIME,
    },
    employmentStatus: {
      type: String,
      enum: Object.values(EmploymentStatus),
      default: EmploymentStatus.ACTIVE,
    },

    dateOfJoining: { type: Date, required: true },
    dateOfLeaving: { type: Date }, // set only when status becomes RESIGNED/TERMINATED

    // Self-referential — org-chart hierarchy. Nullable: top-level execs have no manager.
    reportingManager: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true }
);

// Query patterns this supports: department rosters, active/inactive filtering, org-chart lookups
employeeSchema.index({ department: 1, employmentStatus: 1 });
employeeSchema.index({ reportingManager: 1 });

// Business rule: an employee cannot report to themselves.
// NOTE: this only catches a DIRECT self-reference (A → A). It does NOT detect longer
// cycles (A manages B, B manages A). Full cycle detection requires walking the chain
// and is worth adding once an org-chart feature actually needs it — not core to this module.
employeeSchema.pre('validate', function () {
  if (this.reportingManager && this.reportingManager.equals(this._id)) {
    throw new Error('An employee cannot be their own reporting manager');
  }
});

// Convenience virtual — computed, not stored, so it can never drift out of sync with firstName/lastName.
employeeSchema.virtual('fullName').get(function (this: IEmployee) {
  return `${this.firstName} ${this.lastName}`;
});
employeeSchema.set('toJSON', { virtuals: true });

export const Employee = (mongoose.models.Employee as Model<IEmployee>) ?? model<IEmployee>('Employee', employeeSchema);