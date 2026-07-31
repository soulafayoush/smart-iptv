'use client';

import { useEffect, useState } from 'react';
import { useStore, type Channel } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Play, Loader2, X } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/constants';

function FavoriteCard({ channel, onPlay, onRemove }: {
  channel: Channel;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const colorClass = CATEGORY_COLORS[channel.category] || 'bg-gray-600/20 text-gray-400 border-gray-600/30';
  const icon = CATEGORY_ICONS[channel.category] || '📺';

  return (
    <Card className="border-border/50 bg-card hover:border-[#e50914]/50 group relative">
      <CardContent className="p-0">
        <div className="relative aspect-video bg-gradient-to-br from-muted to-secondary flex items-center justify-center overflow-hidden rounded-t-lg">
          <span className="text-4xl opacity-60 group-hover:scale-110 transition-transform duration-300">{icon}</span>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-12 h-12 rounded-full bg-[#e50914]/90 flex items-center justify-center cursor-pointer" onClick={onPlay}>
              <Play className="w-5 h-5 text-white mr-[-2px]" />
            </div>
          </div>
          {/* Remove button */}
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#e50914]"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {/* Heart indicator */}
          <div className="absolute top-2 right-2">
            <Heart className="w-5 h-5 text-[#e50914] fill-[#e50914]" />
          </div>
        </div>
        <div className="p-3 cursor-pointer" onClick={onPlay}>
          <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-1">{channel.title}</h3>
          <Badge variant="outline" className={`text-[10px] ${colorClass}`}>
            {channel.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function FavoritesView() {
  const { token, showToast, setSelectedChannel, setView, setServerInfo } = useStore();
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFavorites(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadFavorites(); }, [token]);

  const handlePlay = async (channel: Channel) => {
    setSelectedChannel(channel);
    setView('player');
    try {
      const res = await fetch(`/api/stream/${channel.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.server) {
        setServerInfo({ serverName: data.server.serverName, region: data.server.region, load: data.server.load, message: data.message });
      }
    } catch {}
  };

  const handleToggleFavorite = async (channelId: number) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.favorited) {
          setFavorites(prev => prev.filter(ch => ch.id !== channelId));
          showToast('تمت الإزالة من المفضلة', 'info');
        }
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Heart className="w-6 h-6 text-[#e50914]" />
        المفضلة
      </h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد قنوات في المفضلة</p>
          <p className="text-sm mt-1">أضف قنوات إلى المفضلة من خلال الضغط على أيقونة القلب</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favorites.map(ch => (
            <FavoriteCard
              key={ch.id}
              channel={ch}
              onPlay={() => handlePlay(ch)}
              onRemove={() => handleToggleFavorite(ch.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
