import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';

/**
 * Internal AI Endpoint: /ai/recommend
 * ================================
 * Proxy to Python FastAPI AI Microservice.
 * Falls back to local TypeScript engine if Python service is unreachable.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.user_id || !body.all_channels) {
      return NextResponse.json({ error: 'user_id و all_channels مطلوبان' }, { status: 400 });
    }

    // === استدعاء خدمة Python FastAPI ===
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        console.log(`[AI Proxy] Recommend: ${aiData.count} results via Python, algo: ${aiData.algorithm}`);
        return NextResponse.json(aiData);
      } else {
        const errText = await aiRes.text();
        console.warn(`[AI Proxy] Python service returned ${aiRes.status}: ${errText}`);
      }
    } catch (proxyError) {
      console.warn('[AI Proxy] Python service unreachable, using local fallback:', proxyError);
    }

    // === Fallback: محرك TypeScript المحلي ===
    const { getRecommendations } = await import('@/lib/ai-engine');
    const recommendations = getRecommendations(
      body.watch_history || [],
      body.all_channels,
      body.top_n || 10
    );

    return NextResponse.json({
      user_id: body.user_id,
      recommendations,
      algorithm: 'TF-IDF + Cosine Similarity (Local TypeScript Fallback)',
      count: recommendations.length,
    });
  } catch (error) {
    console.error('AI Recommend error:', error);
    return NextResponse.json({ error: 'خطأ في محرك التوصية' }, { status: 500 });
  }
}
