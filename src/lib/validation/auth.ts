/**
 * Validation schemas for authentication using Zod
 * Provides type-safe validation for login, registration, and password reset
 */

import { z } from 'zod';

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Username requirements:
 * - 3-20 characters
 * - Only letters, numbers, and underscores
 * - Must start with a letter
 */
const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

/**
 * Password strength levels
 */
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

/**
 * Calculate password strength
 * @param password - Password to evaluate
 * @returns Password strength level and score
 */
export function calculatePasswordStrength(password: string): { 
  strength: PasswordStrength; 
  score: number;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
} {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
  
  const score = Object.values(requirements).filter(Boolean).length;
  
  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
  } else if (score === 3) {
    strength = 'fair';
  } else if (score === 4) {
    strength = 'good';
  } else {
    strength = 'strong';
  }
  
  return { strength, score, requirements };
}

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration validation schema
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  username: z
    .string()
    .min(1, 'El nombre de usuario es requerido')
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(20, 'El nombre de usuario no puede exceder 20 caracteres')
    .regex(usernameRegex, 'El nombre de usuario debe comenzar con una letra y solo puede contener letras, números y guiones bajos'),
  email: z
    .string()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(passwordRegex, 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  confirmPassword: z
    .string()
    .min(1, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Password reset request validation schema
 */
export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

/**
 * Password reset validation schema
 */
export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(passwordRegex, 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  confirmPassword: z
    .string()
    .min(1, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

/**
 * Email change validation schema
 */
export const emailChangeSchema = z.object({
  newEmail: z
    .string()
    .min(1, 'El nuevo correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña actual para confirmar'),
});

export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

/**
 * Password change validation schema
 */
export const passwordChangeSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Ingresa tu contraseña actual'),
  newPassword: z
    .string()
    .min(1, 'La nueva contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(passwordRegex, 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  confirmPassword: z
    .string()
    .min(1, 'Confirma tu nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Profile update validation schema
 */
export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios')
    .optional(),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(20, 'El nombre de usuario no puede exceder 20 caracteres')
    .regex(usernameRegex, 'El nombre de usuario debe comenzar con una letra y solo puede contener letras, números y guiones bajos')
    .optional(),
  bio: z
    .string()
    .max(160, 'La biografía no puede exceder 160 caracteres')
    .optional(),
  website: z
    .string()
    .url('Ingresa una URL válida')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(30, 'La ubicación no puede exceder 30 caracteres')
    .optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Validate a single field from the login schema
 * @param field - Field name
 * @param value - Value to validate
 * @returns Error message or null if valid
 */
export function validateLoginField(field: keyof LoginInput, value: unknown): string | null {
  const fieldSchema = loginSchema.shape[field];
  const result = fieldSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message || 'Valor inválido';
}

/**
 * Validate a single field from the register schema
 * @param field - Field name
 * @param value - Value to validate
 * @returns Error message or null if valid
 */
export function validateRegisterField(field: keyof RegisterInput, value: unknown): string | null {
  const fieldSchema = registerSchema.shape[field];
  const result = fieldSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message || 'Valor inválido';
}

/**
 * Validate entire login form
 * @param data - Data to validate
 * @returns Object with field errors or null if all valid
 */
export function validateLoginForm(data: unknown): Partial<Record<keyof LoginInput, string>> | null {
  const result = loginSchema.safeParse(data);
  
  if (result.success) {
    return null;
  }
  
  const errors: Partial<Record<keyof LoginInput, string>> = {};
  
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof LoginInput;
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  
  return errors;
}

/**
 * Validate entire registration form
 * @param data - Data to validate
 * @returns Object with field errors or null if all valid
 */
export function validateRegisterForm(data: unknown): Partial<Record<keyof RegisterInput, string>> | null {
  const result = registerSchema.safeParse(data);
  
  if (result.success) {
    return null;
  }
  
  const errors: Partial<Record<keyof RegisterInput, string>> = {};
  
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof RegisterInput;
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  
  return errors;
}
