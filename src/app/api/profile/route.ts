import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader, comparePassword, hashPassword } from '@/lib/auth';
import { updateProfileSchema, changePasswordSchema } from '@/lib/validations';

// GET /api/profile - Get current user profile
export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

    // Get stats
    const [historyCount, ratingsCount, favoritesCount] = await Promise.all([
      db.watchHistory.count({ where: { userId: payload.userId } }),
      db.rating.count({ where: { userId: payload.userId } }),
      db.favorite.count({ where: { userId: payload.userId } }),
    ]);

    return NextResponse.json({ ...user, historyCount, ratingsCount, favoritesCount });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'خطأ في جلب الملف الشخصي' }, { status: 500 });
  }
}

// PUT /api/profile - Update profile info
export async function PUT(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const body = await req.json();

    // Check if it's a password change
    if (body.currentPassword) {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }

      const user = await db.user.findUnique({ where: { id: payload.userId } });
      if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

      if (!comparePassword(parsed.data.currentPassword, user.passwordHash)) {
        return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });
      }

      await db.user.update({
        where: { id: payload.userId },
        data: { passwordHash: hashPassword(parsed.data.newPassword) },
      });

      return NextResponse.json({ message: 'تم تغيير كلمة المرور بنجاح' });
    }

    // Profile update
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const updateData: any = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.email) {
      const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (existing && existing.id !== payload.userId) {
        return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 });
      }
      updateData.email = parsed.data.email;
    }

    const user = await db.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ message: 'تم تحديث الملف الشخصي', user });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'خطأ في تحديث الملف الشخصي' }, { status: 500 });
  }
}
