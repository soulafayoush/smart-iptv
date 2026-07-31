import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';

/**
 * Internal AI Endpoint: /ai/select-server
 * ==========================================
 * Proxy to Python FastAPI AI Microservice.
 * Falls back to local TypeScript engine if Python service is unreachable.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.servers || !Array.isArray(body.servers)) {
      return NextResponse.json({ error: 'servers مطلوب' }, { status: 400 });
    }

    // === استدعاء خدمة Python FastAPI ===
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/ai/select-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        console.log(`[AI Proxy] Server selected: ${aiData.selected_server?.server_name}, algo: ${aiData.algorithm}`);
        return NextResponse.json(aiData);
      } else {
        const errText = await aiRes.text();
        console.warn(`[AI Proxy] Python service returned ${aiRes.status}: ${errText}`);
      }
    } catch (proxyError) {
      console.warn('[AI Proxy] Python service unreachable, using local fallback:', proxyError);
    }

    // === Fallback: محرك TypeScript المحلي ===
    const { selectBestServer } = await import('@/lib/ai-engine');
    const bestServer = selectBestServer(body.servers, body.client_ip || 'unknown');

    return NextResponse.json({
      selected_server: bestServer
        ? {
            id: bestServer.id,
            server_name: bestServer.serverName,
            region: bestServer.region,
            current_load: bestServer.currentLoad,
          }
        : null,
      algorithm: 'Multi-factor Scoring (Local TypeScript Fallback)',
    });
  } catch (error) {
    console.error('AI Server Select error:', error);
    return NextResponse.json({ error: 'خطأ في اختيار السيرفر' }, { status: 500 });
  }
}
