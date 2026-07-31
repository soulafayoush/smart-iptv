import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { getRecommendations } from '@/lib/ai-engine';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || '';

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

    // Fetch user ratings for enhanced recommendations
    const userRatings = await db.rating.findMany({
      where: { userId: uid },
      select: { channelId: true, score: true },
    });

    const historyParsed = history.map(h => ({
      ...h,
      channel: { ...h.channel, createdAt: String(h.channel.createdAt) },
      watchedAt: String(h.watchedAt),
    }));
    const channelsParsed = allChannels.map(ch => ({ ...ch, createdAt: String(ch.createdAt) }));

    let recommendedIds: number[] = [];
    let algorithm = 'TF-IDF + Cosine Similarity (Built-in AI Engine)';

    // === محرك AI الأساسي (TypeScript - يعمل دائماً) ===
    recommendedIds = getRecommendations(historyParsed as any, channelsParsed as any, userRatings);

    // === اختياري: محسن بـ Python Microservice إذا كان متاح ===
    if (AI_SERVICE_URL) {
      try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/ai/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: uid, watch_history: historyParsed,
            all_channels: channelsParsed, ratings: userRatings, top_n: 10,
          }),
          signal: AbortSignal.timeout(3000), // 3 ثواني فقط
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.recommendations?.length > 0) {
            recommendedIds = aiData.recommendations;
            algorithm = `TF-IDF + Cosine Similarity (Python AI Microservice: ${aiData.algorithm})`;
          }
        }
      } catch {
        // Python service not available, built-in engine already has results
      }
    }

    console.log(`[AI] User ${uid}: ${recommendedIds.length} recommendations via: ${algorithm}`);

    // Return full channel objects for recommended IDs
    const recommendedChannels = allChannels.filter(ch => recommendedIds.includes(ch.id));

    return NextResponse.json(recommendedChannels);
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'خطأ في جلب التوصيات' }, { status: 500 });
  }
}
