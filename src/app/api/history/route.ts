import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const { channelId, watchDuration } = await req.json();
    if (!channelId) return NextResponse.json({ error: 'معرّف القناة مطلوب' }, { status: 400 });

    const history = await db.watchHistory.create({
      data: {
        userId: payload.userId,
        channelId: parseInt(channelId),
        watchDuration: watchDuration || 0,
      },
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'خطأ في تسجيل المشاهدة' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const history = await db.watchHistory.findMany({
      where: { userId: payload.userId },
      include: { channel: true },
      orderBy: { watchedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json({ error: 'خطأ في جلب سجل المشاهدة' }, { status: 500 });
  }
}
