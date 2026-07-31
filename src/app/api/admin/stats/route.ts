import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const [
      totalUsers,
      totalChannels,
      totalServers,
      totalHistory,
      totalRatings,
    ] = await Promise.all([
      db.user.count(),
      db.channel.count(),
      db.server.count(),
      db.watchHistory.count(),
      db.rating.count(),
    ]);

    // Channels per category
    const categoryData = await db.channel.groupBy({
      by: ['category'],
      _count: true,
    });

    // Top 5 most watched channels
    const watchAgg = await db.watchHistory.groupBy({
      by: ['channelId'],
      _count: { watchDuration: true },
      _sum: { watchDuration: true },
      orderBy: { _count: { watchDuration: 'desc' } },
      take: 5,
    });
    const topChannels = await Promise.all(
      watchAgg.map(async (w) => {
        const ch = await db.channel.findUnique({ where: { id: w.channelId } });
        return {
          title: ch?.title || 'محذوف',
          category: ch?.category || '',
          views: w._count.watchDuration,
          totalDuration: w._sum.watchDuration || 0,
        };
      })
    );

    // Average ratings per channel (top rated)
    const ratingsAgg = await db.rating.groupBy({
      by: ['channelId'],
      _avg: { score: true },
      _count: { score: true },
      orderBy: { _avg: { score: 'desc' } },
      take: 5,
    });
    const topRated = await Promise.all(
      ratingsAgg.map(async (r) => {
        const ch = await db.channel.findUnique({ where: { id: r.channelId } });
        return {
          title: ch?.title || 'محذوف',
          category: ch?.category || '',
          avgRating: Math.round(((r._avg.score as number) || 0) * 10) / 10,
          ratingCount: r._count.score,
        };
      })
    );

    // Watch activity per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentHistory = await db.watchHistory.findMany({
      where: { watchedAt: { gte: sevenDaysAgo } },
      select: { watchedAt: true, watchDuration: true },
    });
    const dailyActivity: Record<string, number> = {};
    for (const h of recentHistory) {
    const day = h.watchedAt.toISOString().split('T')[0];
    dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    }

    return NextResponse.json({
      overview: { totalUsers, totalChannels, totalServers, totalHistory, totalRatings },
      channelsPerCategory: categoryData.map(c => ({ name: c.category, count: c._count })),
      topChannels,
      topRated,
      dailyActivity,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'خطأ في جلب الإحصائيات' }, { status: 500 });
  }
}
