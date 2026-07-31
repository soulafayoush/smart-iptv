import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createRatingSchema } from '@/lib/validations';

// POST /api/ratings - Add or update a rating
export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const body = await req.json();
    const parsed = createRatingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { channelId, score } = parsed.data;

    // Upsert: create or update rating
    const rating = await db.rating.upsert({
      where: {
        userId_channelId: { userId: payload.userId, channelId },
      },
      update: { score },
      create: { userId: payload.userId, channelId, score },
    });

    return NextResponse.json(rating);
  } catch (error) {
    console.error('Rating error:', error);
    return NextResponse.json({ error: 'خطأ في حفظ التقييم' }, { status: 500 });
  }
}

// GET /api/ratings?channelId=X - Get average rating for a channel
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelIdStr = searchParams.get('channelId');

    if (!channelIdStr) {
      return NextResponse.json({ error: 'معرّف القناة مطلوب' }, { status: 400 });
    }

    const channelId = parseInt(channelIdStr, 10);
    if (isNaN(channelId)) {
      return NextResponse.json({ error: 'معرّف القناة غير صالح' }, { status: 400 });
    }

    const ratings = await db.rating.findMany({ where: { channelId } });

    const avg = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    return NextResponse.json({
      channelId,
      count: ratings.length,
      averageRating: Math.round(avg * 10) / 10,
    });
  } catch (error) {
    console.error('Get rating error:', error);
    return NextResponse.json({ error: 'خطأ في جلب التقييم' }, { status: 500 });
  }
}
