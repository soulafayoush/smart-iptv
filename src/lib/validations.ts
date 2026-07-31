/**
 * Zod Validation Schemas - Smart IPTV Platform
 * ============================================
 * Centralized input validation for all API endpoints.
 */

import { z } from 'zod';

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(50, 'الاسم طويل جداً'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل')
    .max(100, 'كلمة المرور طويلة جداً'),
});

// ---- Channels ----
export const createChannelSchema = z.object({
  title: z.string().min(2, 'اسم القناة مطلوب (حرفين على الأقل)').max(100, 'اسم القناة طويل جداً'),
  category: z.string().min(1, 'التصنيف مطلوب').max(50, 'التصنيف طويل جداً'),
  tags: z.string().max(500, 'الكلمات المفتاحية طويلة جداً').default(''),
  thumbnailUrl: z.string().url('رابط الصورة غير صالح').max(500).default('').or(z.literal('')),
  streamUrl: z.string().url('رابط البث غير صالح').max(500, 'رابط البث طويل جداً').default('').or(z.literal('')),
});

// ---- Ratings ----
export const createRatingSchema = z.object({
  channelId: z.number().int().positive('معرّف القناة غير صالح'),
  score: z.number().int().min(1, 'التقييم لا يقل عن 1').max(5, 'التقييم لا يتجاوز 5'),
});

// ---- History ----
export const createHistorySchema = z.object({
  channelId: z.number().int().positive('معرّف القناة غير صالح'),
  watchDuration: z.number().int().min(0, 'مدة المشاهدة لا يمكن أن تكون سالبة'),
});

// ---- AI ----
export const recommendRequestSchema = z.object({
  userId: z.number().int().positive(),
  watchHistory: z.array(
    z.object({
      channelId: z.number().int().positive(),
      watchDuration: z.number().int().min(0),
      channel: z.object({
        id: z.number().int().positive(),
        title: z.string(),
        category: z.string(),
        tags: z.string(),
        thumbnailUrl: z.string(),
        streamUrl: z.string(),
      }),
    })
  ),
  channels: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      category: z.string(),
      tags: z.string(),
      thumbnailUrl: z.string(),
      streamUrl: z.string(),
    })
  ),
  topN: z.number().int().positive().default(10),
});

export const selectServerRequestSchema = z.object({
  userIp: z.string().default('127.0.0.1'),
});

// ---- Profile ----
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(50).optional(),
  email: z.string().email('البريد الإلكتروني غير صالح').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'),
});

// ---- Favorites ----
export const toggleFavoriteSchema = z.object({
  channelId: z.number().int().positive('معرّف القناة غير صالح'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export type CreateHistoryInput = z.infer<typeof createHistorySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
