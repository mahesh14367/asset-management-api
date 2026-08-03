import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';


export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ASSET_MANAGER = 'asset_manager',
  EMPLOYEE = 'employee',
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId: Types.ObjectId | null;
  isActive: boolean;
  refreshTokenHash?: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default in queries
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.EMPLOYEE,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// sparse: true means the uniqueness constraint only applies to documents where employeeId
// is NOT null — otherwise every self-registered user with employeeId: null would collide
// on a "duplicate null" unique-index error. This enforces: at most ONE User per Employee.
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });


export const User = (mongoose.models.User as Model<IUser>) ?? model<IUser>('User', userSchema);