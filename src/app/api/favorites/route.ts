import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { toggleFavoriteSchema } from '@/lib/validations';

// GET /api/favorites - Get user's favorites
export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const favorites = await db.favorite.findMany({
      where: { userId: payload.userId },
      include: { channel: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(favorites.map(f => f.channel));
  } catch (error) {
    console.error('Get favorites error:', error);
    return NextResponse.json({ error: 'خطأ في جلب المفضلة' }, { status: 500 });
  }
}

// POST /api/favorites - Toggle favorite (add or remove)
export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const body = await req.json();
    const parsed = toggleFavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { channelId } = parsed.data;

    // Check if already a favorite
    const existing = await db.favorite.findUnique({
      where: { userId_channelId: { userId: payload.userId, channelId } },
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    } else {
      await db.favorite.create({ data: { userId: payload.userId, channelId } });
      return NextResponse.json({ favorited: true });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return NextResponse.json({ error: 'خطأ في تحديث المفضلة' }, { status: 500 });
  }
}
