import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { getRecommendations } from '@/lib/ai-engine';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const { userId } = await params;
    const uid = parseInt(userId);

    // Fetch user watch history with channel details
    const history = await db.watchHistory.findMany({
      where: { userId: uid },
      include: { channel: true },
      orderBy: { watchedAt: 'desc' },
    });

    // Fetch all channels
    const allChannels = await db.channel.findMany();

    // === INTERNAL API CALL to Python AI Service ===
    // السيرفر الرئيسي (Node.js) يستدعي خدمة الذكاء الاصطناعي (Python)
    let recommendedIds: number[] = [];

    // Fetch user ratings for enhanced recommendations
    const userRatings = await db.rating.findMany({
      where: { userId: uid },
      select: { channelId: true, score: true },
    });

    // === INTERNAL API CALL to Python AI Service ===
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          watch_history: history.map(h => ({
            ...h,
            channel: { ...h.channel, createdAt: String(h.channel.createdAt) },
            watchedAt: String(h.watchedAt),
          })),
          all_channels: allChannels.map(ch => ({
            ...ch,
            createdAt: String(ch.createdAt),
          })),
          ratings: userRatings,
          top_n: 10,
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        recommendedIds = aiData.recommendations || [];
        console.log(`[AI Service] Recommendations for user ${uid}: ${recommendedIds.length} items, algo: ${aiData.algorithm}`);
      } else {
        console.warn('[AI Service] Failed, falling back to local engine');
        recommendedIds = getRecommendations(
          history.map(h => ({
            ...h,
            channel: { ...h.channel, createdAt: String(h.channel.createdAt) },
            watchedAt: String(h.watchedAt),
          })) as any,
          allChannels.map(ch => ({ ...ch, createdAt: String(ch.createdAt) })) as any,
          userRatings,
        );
      }
    } catch (aiError) {
      console.warn('[AI Service] Unreachable, falling back to local engine:', aiError);
      recommendedIds = getRecommendations(
        history.map(h => ({
          ...h,
          channel: { ...h.channel, createdAt: String(h.channel.createdAt) },
          watchedAt: String(h.watchedAt),
        })) as any,
        allChannels.map(ch => ({ ...ch, createdAt: String(ch.createdAt) })) as any,
        userRatings,
      );
    }

    // Return full channel objects for recommended IDs
    const recommendedChannels = allChannels.filter(ch =>
      recommendedIds.includes(ch.id)
    );

    return NextResponse.json(recommendedChannels);
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'خطأ في جلب التوصيات' }, { status: 500 });
  }
}
