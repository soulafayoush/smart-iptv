import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { selectBestServer } from '@/lib/ai-engine';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'توكن غير صالح' }, { status: 401 });

    const { channelId } = await params;
    const channel = await db.channel.findUnique({ where: { id: parseInt(channelId) } });
    if (!channel) return NextResponse.json({ error: 'القناة غير موجودة' }, { status: 404 });

    // Get user IP
    const userIp = req.headers.get('x-forwarded-for') || '192.168.1.100';

    // Fetch active servers
    const servers = await db.server.findMany({ where: { status: 'active' } });

    // === INTERNAL API CALL to Python AI Service ===
    // السيرفر الرئيسي يستدعي خدمة Python لاختيار السيرفر الأنسب
    let serverResult: any = null;
    let aiAlgorithm = '';
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/ai/select-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_ip: userIp,
          servers: servers.map(s => ({
            id: s.id,
            serverName: s.serverName,
            ipAddress: s.ipAddress,
            region: s.region,
            currentLoad: s.currentLoad,
            status: s.status,
          })),
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        serverResult = aiData.selected_server;
        aiAlgorithm = aiData.algorithm;
        console.log(`[AI Service] Server selected: ${serverResult?.server_name}, algo: ${aiAlgorithm}`);
      } else {
        console.warn('[AI Service] Failed, falling back to local engine');
        const fallback = selectBestServer(servers, userIp);
        serverResult = fallback ? {
          server_name: fallback.serverName,
          region: fallback.region,
          load: fallback.currentLoad,
        } : null;
        aiAlgorithm = 'Local fallback';
      }
    } catch (aiError) {
      console.warn('[AI Service] Unreachable, falling back to local engine:', aiError);
      const fallback = selectBestServer(servers, userIp);
      serverResult = fallback ? {
        server_name: fallback.serverName,
        region: fallback.region,
        load: fallback.currentLoad,
      } : null;
      aiAlgorithm = 'Local fallback';
    }

    return NextResponse.json({
      streamUrl: channel.streamUrl,
      server: serverResult
        ? {
            serverName: serverResult.server_name,
            region: serverResult.region,
            load: serverResult.load,
          }
        : null,
      message: serverResult
        ? `تم اختيار سيرفر ${serverResult.server_name} (${serverResult.region}) - الحمل: ${serverResult.load}%`
        : 'لا يوجد سيرفرات متاحة',
      aiAlgorithm,
    });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json({ error: 'خطأ في تحضير البث' }, { status: 500 });
  }
}
