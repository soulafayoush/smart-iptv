'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { CATEGORY_COLORS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Star,
  Shield,
  Plus,
  Loader2,
  Tv,
  Server,
  Clock,
  TrendingUp,
  Brain,
  Trash2,
  Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#d97706', '#6b7280', '#ef4444'];

// ============================================================
// ADMIN VIEW
// ============================================================
export function AdminView() {
  const { token, channels, setChannels, showToast, user } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', tags: '', streamUrl: '' });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!token || !isAdmin) return;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (!data.error) setStats(data); })
      .catch(() => {});
  }, [token, isAdmin]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast('تمت إضافة القناة', 'success');
      setForm({ title: '', category: '', tags: '', streamUrl: '' });
      setShowAdd(false);
      const chRes = await fetch('/api/channels');
      setChannels(await chRes.json());
    } catch { showToast('خطأ', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه القناة؟')) return;
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('تم حذف القناة', 'success');
        const chRes = await fetch('/api/channels');
        setChannels(await chRes.json());
      }
    } catch { showToast('خطأ في الحذف', 'error'); }
  };

  const overview = stats?.overview;
  const catData = (stats?.channelsPerCategory || []).map((c: any, i: number) => ({
    name: c.name,
    count: c.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const topCh = stats?.topChannels || [];
  const topRat = stats?.topRated || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          لوحة تحكم الأدمن
        </h1>
        <Button
          onClick={() => { setShowAdd(!showAdd); setForm({ title: '', category: '', tags: '', streamUrl: '' }); }}
          className="bg-[#e50914] hover:bg-[#c40812] text-white gap-1.5"
        >
          <Plus className="w-4 h-4" />
          إضافة قناة
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">إضافة قناة جديدة</h3>
            <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم القناة</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="قناة الجزيرة" dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="أخبار" dir="rtl" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>الكلمات المفتاحية</Label>
                <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="أخبار سياسة تقارير" dir="rtl" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>رابط البث (m3u8)</Label>
                <Input value={form.streamUrl} onChange={e => setForm({ ...form, streamUrl: e.target.value })} placeholder="https://...m3u8" dir="ltr" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={loading} className="bg-[#e50914] hover:bg-[#c40812] text-white">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ===== KPI Overview Cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {overview ? [
          { label: 'المستخدمين', value: overview.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'القنوات', value: overview.totalChannels, icon: Tv, color: 'text-[#e50914]', bg: 'bg-[#e50914]/10' },
          { label: 'السيرفرات', value: overview.totalServers, icon: Server, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'المشاهدات', value: overview.totalHistory, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { label: 'التقييمات', value: overview.totalRatings, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50 bg-card">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <p className="font-bold text-xl">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        )) : [
          { label: 'إجمالي القنوات', value: channels.length, icon: Tv, color: 'text-[#e50914]' },
          { label: 'التصنيفات', value: new Set(channels.map(c => c.category)).size, icon: Star, color: 'text-yellow-400' },
          { label: 'خوادم البث', value: overview?.totalServers ?? 5, icon: Server, color: 'text-green-400' },
          { label: 'محرك AI', value: 'نشط', icon: Brain, color: 'text-purple-400' },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50 bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="font-bold text-lg">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== Charts Row ===== */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Category Distribution - Bar Chart */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#e50914]" />
                توزيع التصنيفات
              </h3>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value} قناة`, 'العدد']}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                      {catData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
              )}
            </CardContent>
          </Card>

          {/* Category Distribution - Pie Chart */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Tv className="w-4 h-4 text-blue-400" />
                نسبة التصنيفات
              </h3>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={catData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="name"
                      stroke="none"
                    >
                      {catData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`${value} قناة`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
              )}
            </CardContent>
          </Card>

          {/* Top Watched - Horizontal Bar */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-green-400" />
                الأكثر مشاهدة
              </h3>
              {topCh.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={topCh.map((ch: any, i: number) => ({
                      name: ch.title.length > 15 ? ch.title.substring(0, 15) + '...' : ch.title,
                      fullName: ch.title,
                      views: ch.views,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      formatter={(value: number) => [`${value} مشاهدة`, 'المشاهدات']}
                    />
                    <Bar dataKey="views" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات مشاهدة</p>
              )}
            </CardContent>
          </Card>

          {/* Top Rated Channels */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-400" />
                الأعلى تقييماً
              </h3>
              {topRat.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={topRat.map((ch: any) => ({
                      name: ch.title.length > 15 ? ch.title.substring(0, 15) + '...' : ch.title,
                      fullName: ch.title,
                      rating: ch.avgRating,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" domain={[0, 5]} hide />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      formatter={(value: number) => [`${value}/5`, 'التقييم']}
                    />
                    <Bar dataKey="rating" fill="#eab308" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد تقييمات</p>
              )}
            </CardContent>
          </Card>

          {/* AI Service Status */}
          <Card className="border-border/50 bg-card md:col-span-2">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-purple-400" />
                حالة محرك الذكاء الاصطناعي
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">خدمة Python AI</span>
                    <span className="flex items-center gap-1.5 text-green-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      نشط
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                    <p className="text-xs text-muted-foreground">المحركات:</p>
                    <p className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">TF-IDF</Badge>
                      <Badge variant="outline" className="text-xs">Cosine Similarity</Badge>
                    </p>
                    <p className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Multi-factor Server</Badge>
                    </p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">أوزان اختيار السيرفر:</p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
                        <p className="font-bold">40%</p>
                        <p>الحمل</p>
                      </div>
                      <div className="p-1.5 rounded bg-green-500/10 text-green-400">
                        <p className="font-bold">35%</p>
                        <p>القرب</p>
                      </div>
                      <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                        <p className="font-bold">25%</p>
                        <p>الاستجابة</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground p-2 rounded bg-purple-500/5 border border-purple-500/20">
                    scikit-learn v1.5+ | FastAPI | Python Microservice on port 3001
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Channels table */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-right p-3 font-medium text-muted-foreground">القناة</th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">التصنيف</th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">الكلمات المفتاحية</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(ch => (
                  <tr key={ch.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{ch.title}</td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant="outline" className={CATEGORY_COLORS[ch.category] || ''}>{ch.category}</Badge>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{ch.tags}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(ch.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
