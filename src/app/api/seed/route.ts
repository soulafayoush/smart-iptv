import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * Seed endpoint - populates the database with demo data.
 * Protected: requires admin auth for force-reset, read-only otherwise.
 * Call: GET /api/seed  |  GET /api/seed?force=1
 */
export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get('force') === '1';

    // Force-reset requires admin authentication
    if (force) {
      const token = extractTokenFromHeader(req.headers.get('authorization'));
      if (!token) return NextResponse.json({ error: 'غير مصرح - التوقيع مطلوب لإعادة التعيين' }, { status: 401 });

      const payload = verifyToken(token);
      if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'صلاحيات غير كافية - فقط الأدمن يمكنه إعادة تعيين البيانات' }, { status: 403 });
      }
    }

    const existingUsers = await db.user.count();

    if (existingUsers > 0 && !force) {
      const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true } });
      const channels = await db.channel.count();
      const servers = await db.server.count();
      const history = await db.watchHistory.count();
      return NextResponse.json({
        message: 'البيانات موجودة بالفعل',
        stats: { users: users.length, channels, servers, history },
        testAccounts: {
          admin: { email: 'admin@iptv.com', password: 'admin123' },
          user1: { email: 'ahmed@test.com', password: '123456' },
          user2: { email: 'sara@test.com', password: '123456' },
        },
      });
    }

    // Clear existing data
    await db.watchHistory.deleteMany();
    await db.rating.deleteMany();
    await db.channel.deleteMany();
    await db.server.deleteMany();
    await db.user.deleteMany();

    // --- Users ---
    const admin = await db.user.create({
      data: { name: 'مدير النظام', email: 'admin@iptv.com', passwordHash: hashPassword('admin123'), role: 'admin' },
    });
    const user1 = await db.user.create({
      data: { name: 'أحمد محمد', email: 'ahmed@test.com', passwordHash: hashPassword('123456'), role: 'user' },
    });
    const user2 = await db.user.create({
      data: { name: 'سارة علي', email: 'sara@test.com', passwordHash: hashPassword('123456'), role: 'user' },
    });

    // --- Channels with realistic stream URLs ---
    const channelsData = [
      { title: 'قناة الجزيرة مباشر', category: 'أخبار', tags: 'أخبار عربية عاجلة سياسة تقارير تحقيقات', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'قناة العربية', category: 'أخبار', tags: 'أخبار سياسة اقتصاد برامج حوارية', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'قناة دبي الرياضية', category: 'رياضة', tags: 'رياضة كرة قدم مباريات دوريات', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
      { title: 'beIN Sports 1', category: 'رياضة', tags: 'رياضة كرة قدم دوري أبطال أوروبا', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'beIN Sports 2', category: 'رياضة', tags: 'رياضة كرة سلة تنس مباريات', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة MBC برو', category: 'أفلام', tags: 'أفلام عربية سينما مسرحيات دراما', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة MBC أكشن', category: 'أفلام', tags: 'أفلام أكشن هوليوود مغامرات إثارة', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة MBC 4', category: 'أفلام', tags: 'أفلام أجنبية هوليوود كوميديا رعب', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'طيور الجنة', category: 'أطفال', tags: 'أطفال أناشيد برامج تعليمية رسوم متحركة', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'كارتون نتورك عربي', category: 'أطفال', tags: 'أطفال كرتون رسوم متحركة برامج مغامرات', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
      { title: 'ناشيونال جيوغرافيك أبوظبي', category: 'وثائقيات', tags: 'وثائقيات طبيعة علم تاريخ حيوانات', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة اكتشاف', category: 'وثائقيات', tags: 'وثائقيات تقنية علوم فضاء اختراعات', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'روتانا كليب', category: 'موسيقى', tags: 'موسيقى أغاني فيديو كليب فنانين', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة الشارقة', category: 'ثقافة', tags: 'ثقافة تعليم برامج حوارية مجتمع', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'السعودية الأولى', category: 'عامة', tags: 'عامة برامج متنوعة أخبار ثقافة', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'قناة نور الشام', category: 'دراما', tags: 'دراما مسلسلات عربية تركية', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
      { title: 'OSN Ya Hala', category: 'أفلام', tags: 'أفلام عربية مسلسلات دراما أكشن', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة الحوار', category: 'أخبار', tags: 'أخبار سياسة حوارات تحليلات مقابلات', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnailUrl: '' },
      { title: 'SpaceToon عربي', category: 'أطفال', tags: 'أطفال كرتون مغامرات تعليمية رسوم متحركة', streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8', thumbnailUrl: '' },
      { title: 'قناة سامبا سبورت', category: 'رياضة', tags: 'رياضة محلية كرة قدم سعودية دوري', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', thumbnailUrl: '' },
    ];

    const channels: any[] = [];
    for (const ch of channelsData) {
      channels.push(await db.channel.create({ data: ch }));
    }

    // --- Servers ---
    const serversData = [
      { serverName: 'ME-Server-1', ipAddress: '10.0.1.10', region: 'Middle East - Dubai', currentLoad: 35, status: 'active' },
      { serverName: 'EU-Server-1', ipAddress: '10.0.2.10', region: 'Europe - Frankfurt', currentLoad: 72, status: 'active' },
      { serverName: 'US-Server-1', ipAddress: '10.0.3.10', region: 'US - New York', currentLoad: 58, status: 'active' },
      { serverName: 'AS-Server-1', ipAddress: '10.0.4.10', region: 'Asia - Singapore', currentLoad: 15, status: 'active' },
      { serverName: 'ME-Server-2', ipAddress: '10.0.1.20', region: 'Middle East - Riyadh', currentLoad: 88, status: 'active' },
    ];

    const servers: any[] = [];
    for (const s of serversData) {
      servers.push(await db.server.create({ data: s }));
    }

    // --- Watch History ---
    const historyData = [
      { userId: user1.id, channelId: 1, watchDuration: 1200 },
      { userId: user1.id, channelId: 3, watchDuration: 1800 },
      { userId: user1.id, channelId: 4, watchDuration: 2400 },
      { userId: user1.id, channelId: 2, watchDuration: 600 },
      { userId: user1.id, channelId: 5, watchDuration: 900 },
    ];
    for (const h of historyData) { await db.watchHistory.create({ data: h }); }

    const historyData2 = [
      { userId: user2.id, channelId: 6, watchDuration: 3600 },
      { userId: user2.id, channelId: 7, watchDuration: 3000 },
      { userId: user2.id, channelId: 11, watchDuration: 2400 },
      { userId: user2.id, channelId: 12, watchDuration: 1800 },
      { userId: user2.id, channelId: 8, watchDuration: 2700 },
    ];
    for (const h of historyData2) { await db.watchHistory.create({ data: h }); }

    // --- Ratings ---
    const ratingsData = [
      { userId: user1.id, channelId: 1, score: 5 },
      { userId: user1.id, channelId: 3, score: 4 },
      { userId: user1.id, channelId: 4, score: 5 },
      { userId: user1.id, channelId: 2, score: 3 },
      { userId: user1.id, channelId: 5, score: 4 },
      { userId: user1.id, channelId: 7, score: 2 },
      { userId: user2.id, channelId: 6, score: 5 },
      { userId: user2.id, channelId: 7, score: 4 },
      { userId: user2.id, channelId: 11, score: 5 },
      { userId: user2.id, channelId: 12, score: 4 },
      { userId: user2.id, channelId: 8, score: 5 },
      { userId: user2.id, channelId: 1, score: 2 },
    ];
    for (const r of ratingsData) { await db.rating.create({ data: r }); }

    return NextResponse.json({
      message: 'تم تثبيت البيانات التجريبية بنجاح',
      stats: { users: 3, channels: channels.length, servers: servers.length, watchHistory: historyData.length + historyData2.length, ratings: ratingsData.length },
      testAccounts: {
        admin: { email: 'admin@iptv.com', password: 'admin123' },
        user1: { email: 'ahmed@test.com', password: '123456' },
        user2: { email: 'sara@test.com', password: '123456' },
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'خطأ في تثبيت البيانات' }, { status: 500 });
  }
}
