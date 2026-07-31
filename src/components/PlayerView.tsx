'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useStore } from '@/lib/store';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, ChevronLeft, Clock, Wifi, Brain, Server, Heart, Info } from 'lucide-react';

export function PlayerView() {
  const { selectedChannel, setView, token, user, serverInfo, showToast } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef(0);

  // Load ratings and favorite status
  useEffect(() => {
    if (!selectedChannel) return;
    fetch(`/api/ratings?channelId=${selectedChannel.id}`)
      .then(r => r.json())
      .then(data => { setAvgRating(data.averageRating); setRatingCount(data.count); })
      .catch(() => {});
    if (token) {
      fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then((data: any[]) => setIsFavorited(data.some((c: any) => c.id === selectedChannel?.id)))
        .catch(() => {});
    }
  }, [selectedChannel?.id, token]);

  useEffect(() => {
    if (!selectedChannel?.streamUrl || !videoRef.current) return;

    const url = selectedChannel.streamUrl;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) showToast('خطأ في تحميل البث', 'error');
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      });
    }

    // Track watch time + heartbeat every 30s
    watchTimerRef.current = setInterval(() => {
      setWatchSeconds(prev => {
        const next = prev + 1;
        // Heartbeat: save every 30 seconds
        if (next % 30 === 0 && next > 5 && token && selectedChannel) {
          fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ channelId: selectedChannel.id, watchDuration: 30 }),
          }).catch(() => {});
        }
        return next;
      });
    }, 1000);

    // Save on unmount (remaining seconds not saved by heartbeat)
    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
      if (hlsRef.current) hlsRef.current.destroy();
      const remaining = (watchSeconds % 30) || (watchSeconds > 5 ? watchSeconds : 0);
      if (token && selectedChannel && remaining > 5) {
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ channelId: selectedChannel.id, watchDuration: remaining }),
        }).catch(() => {});
      }
    };
  }, [selectedChannel, token]);

  if (!selectedChannel) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const icon = CATEGORY_ICONS[selectedChannel.category] || '📺';
  const colorClass = CATEGORY_COLORS[selectedChannel.category] || '';

  const handleToggleFavorite = async () => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelId: selectedChannel.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFavorited(data.favorited);
        showToast(data.favorited ? 'تمت الإضافة إلى المفضلة' : 'تمت الإزالة من المفضلة', 'success');
      }
    } catch {}
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <button onClick={() => setView('home')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ChevronLeft className="w-4 h-4" />
        العودة للرئيسية
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="video-container rounded-xl overflow-hidden border border-border/50">
            <video ref={videoRef} controls playsInline className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0 }} />
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <span>{icon}</span>
                  {selectedChannel.title}
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Badge variant="outline" className={colorClass}>{selectedChannel.category}</Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />{formatTime(watchSeconds)}
                  </span>
                  <span className={`text-sm flex items-center gap-1 ${isPlaying ? 'text-green-400' : 'text-muted-foreground'}`}>
                    <Wifi className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} />
                    {isPlaying ? 'مباشر' : 'جاري التحميل...'}
                  </span>
                </div>
              </div>
              <button onClick={handleToggleFavorite} className="flex-shrink-0 w-10 h-10 rounded-lg border border-border/50 hover:border-[#e50914]/50 flex items-center justify-center transition-all">
                <Heart className={`w-5 h-5 transition-colors ${isFavorited ? 'text-[#e50914] fill-[#e50914]' : 'text-muted-foreground'}`} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedChannel.tags.split(/\s+/).filter(Boolean).map((tag, i) => (
                <span key={i} className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Rating */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-yellow-400" />
                قيّم هذا المحتوى
              </h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => {
                      setUserRating(star);
                      fetch('/api/ratings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ channelId: selectedChannel.id, score: star }),
                      }).then(() => {
                        showToast(`تم التقييم ${star}/5`, 'success');
                        fetch(`/api/ratings?channelId=${selectedChannel.id}`)
                          .then(r => r.json())
                          .then(data => { setAvgRating(data.averageRating); setRatingCount(data.count); });
                      });
                    }}
                    className="w-10 h-10 rounded-lg border border-border/50 hover:bg-yellow-400/10 hover:border-yellow-400/50 flex items-center justify-center transition-all"
                  >
                    <Star className={`w-5 h-5 ${star <= userRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>
              {avgRating > 0 && (
                <p className="text-xs text-muted-foreground mt-2">متوسط التقييم: {avgRating}/5 ({ratingCount} تقييم)</p>
              )}
            </CardContent>
          </Card>

          {/* AI Server */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-[#e50914]" />
                خادم البث الذكي
              </h3>
              {serverInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium">{serverInfo.serverName}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المنطقة</span>
                      <span>{serverInfo.region}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">الحمل</span>
                        <span className={serverInfo.load > 70 ? 'text-orange-400' : 'text-green-400'}>{serverInfo.load}%</span>
                      </div>
                      <Progress value={serverInfo.load} className="h-2" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-muted/50 leading-relaxed">{serverInfo.message}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">جاري اختيار أفضل سيرفر...</p>
              )}
            </CardContent>
          </Card>

          {/* Algorithm info */}
          <Card className="border-border/50 bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-400" />
                كيف يعمل النظام؟
              </h3>
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p><strong className="text-foreground">محرك التوصية:</strong> يستخدم خوارزمية TF-IDF + Cosine Similarity لتحليل سجل مشاهدتك وخصائص المحتوى وتقديم توصيات مخصصة.</p>
                <p><strong className="text-foreground">اختيار السيرفر:</strong> يحدد أنسب سيرفر بناءً على الحمل والقرب الجغرافي وسرعة الاستجابة بتقييم متعدد العوامل.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
