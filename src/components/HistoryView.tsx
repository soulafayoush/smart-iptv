'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { CATEGORY_ICONS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { History, Clock, Loader2 } from 'lucide-react';

// ============================================================
// HISTORY VIEW
// ============================================================
export function HistoryView() {
  const { token, showToast } = useStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => { setLoading(false); showToast('خطأ في جلب السجل', 'error'); });
  }, [token]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}س ${m}د`;
    return `${m} دقيقة`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <History className="w-6 h-6" />
        سجل المشاهدة
      </h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لم تشاهد أي محتوى بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record: any) => (
            <Card key={record.id} className="border-border/50 bg-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">
                  {CATEGORY_ICONS[record.channel?.category] || '📺'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{record.channel?.title || 'قناة محذوفة'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{record.channel?.category}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(record.watchDuration)}
                    </span>
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                  {new Date(record.watchedAt).toLocaleDateString('ar-SA')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
