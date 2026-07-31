import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { selectBestServer } from '@/lib/ai-engine';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || '';

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

    const userIp = req.headers.get('x-forwarded-for') || '192.168.1.100';
    const servers = await db.server.findMany({ where: { status: 'active' } });

    // === محرك اختيار السيرفر الأساسي (TypeScript) ===
    const bestServer = selectBestServer(servers, userIp);
    let serverResult: any = null;
    let aiAlgorithm = 'Multi-factor Server Selection (Built-in AI Engine)';

    if (bestServer) {
      serverResult = {
        server_name: bestServer.serverName,
        region: bestServer.region,
        load: bestServer.currentLoad,
      };
    }

    // === اختياري: محسن بـ Python Microservice ===
    if (AI_SERVICE_URL) {
      try {
        const aiRes = await fetch(`${AI_SERVICE_URL}/ai/select-server`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_ip: userIp,
            servers: servers.map(s => ({
              id: s.id, serverName: s.serverName, ipAddress: s.ipAddress,
              region: s.region, currentLoad: s.currentLoad, status: s.status,
            })),
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.selected_server) {
            serverResult = aiData.selected_server;
            aiAlgorithm = `Python AI Microservice: ${aiData.algorithm}`;
          }
        }
      } catch {
        // Python not available, built-in engine already has result
      }
    }

    return NextResponse.json({
      streamUrl: channel.streamUrl,
      server: serverResult ? {
        serverName: serverResult.server_name,
        region: serverResult.region,
        load: serverResult.load,
      } : null,
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
