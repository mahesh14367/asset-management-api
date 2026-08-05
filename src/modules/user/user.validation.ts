import Joi from 'joi';
import { UserRole } from './user.model';

// export const createUserSchema = Joi.object({
//   name: Joi.string().trim().min(2).max(100).required(),
//   email: Joi.string().trim().email().required(),
//   password: Joi.string()
//     .min(8)
//     .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
//     .required()
//     .messages({
//       'string.pattern.base': 'Password must contain uppercase, lowercase, and a number',
//     }),
//   role: Joi.string()
//     .valid(...Object.values(UserRole))
//     .default(UserRole.EMPLOYEE),
// });

export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().trim().email(),
}).min(1); // at least one field must be present

export const updateRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required(),
});

export const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and a number',
    }),
});

export const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  role: Joi.string().valid(...Object.values(UserRole)),
  isActive: Joi.boolean(),
  search: Joi.string().trim().max(100), // matches name or email
});