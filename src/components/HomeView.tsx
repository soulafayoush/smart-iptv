'use client';

import { useState } from 'react';
import { useStore, type Channel } from '@/lib/store';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Sparkles, Brain, Play, Heart } from 'lucide-react';

function ChannelCard({ channel, onClick, isFavorited, onToggleFavorite }: {
  channel: Channel;
  onClick: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}) {
  const colorClass = CATEGORY_COLORS[channel.category] || 'bg-gray-600/20 text-gray-400 border-gray-600/30';
  const icon = CATEGORY_ICONS[channel.category] || '📺';

  return (
    <Card
      className="channel-card cursor-pointer border-border/50 bg-card hover:border-[#e50914]/50 group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video bg-gradient-to-br from-muted to-secondary flex items-center justify-center overflow-hidden rounded-t-lg">
          <span className="text-4xl opacity-60 group-hover:scale-110 transition-transform duration-300">{icon}</span>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-12 h-12 rounded-full bg-[#e50914]/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-white mr-[-2px]" />
            </div>
          </div>
          {/* Favorite heart */}
          {onToggleFavorite && (
            <button
              onClick={e => { e.stopPropagation(); onToggleFavorite(e); }}
              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
            >
              <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'text-[#e50914] fill-[#e50914]' : 'text-white'}`} />
            </button>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-1">{channel.title}</h3>
          <Badge variant="outline" className={`text-[10px] ${colorClass}`}>
            {channel.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function HomeView() {
  const { channels, recommendations, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, setSelectedChannel, setView, setServerInfo, token, showToast } = useStore();
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const categories = ['الكل', ...Array.from(new Set(channels.map(c => c.category)))];

  // Load favorites
  useState(() => {
    if (!token) return;
    fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Channel[]) => setFavorites(new Set(data.map(c => c.id))))
      .catch(() => {});
  });

  const filtered = channels.filter(ch => {
    const matchCat = selectedCategory === 'الكل' || ch.category === selectedCategory;
    const matchSearch = !searchQuery ||
      ch.title.includes(searchQuery) ||
      ch.tags.includes(searchQuery) ||
      ch.category.includes(searchQuery);
    return matchCat && matchSearch;
  });

  const handlePlay = async (channel: Channel) => {
    setSelectedChannel(channel);
    setView('player');
    try {
      const res = await fetch(`/api/stream/${channel.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.server) {
        setServerInfo({
          serverName: data.server.serverName,
          region: data.server.region,
          load: data.server.load,
          message: data.message,
        });
      }
    } catch {}
  };

  const handleToggleFavorite = async (e: React.MouseEvent, channelId: number) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(prev => {
          const next = new Set(prev);
          if (data.favorited) next.add(channelId);
          else next.delete(channelId);
          return next;
        });
        showToast(data.favorited ? 'تمت الإضافة إلى المفضلة' : 'تمت الإزالة من المفضلة', 'success');
      }
    } catch {}
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Search bar */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ابحث عن قناة أو محتوى..."
          className="pr-10 bg-card border-border/50 h-11"
          dir="rtl"
        />
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#e50914]" />
            <h2 className="text-xl font-bold">مقترح لك</h2>
            <Badge variant="outline" className="bg-[#e50914]/10 text-[#e50914] border-[#e50914]/30 text-xs">
              <Brain className="w-3 h-3 mr-1" />
              توصيات ذكية
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recommendations.slice(0, 10).map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onClick={() => handlePlay(ch)}
                isFavorited={favorites.has(ch.id)}
                onToggleFavorite={e => handleToggleFavorite(e, ch.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`category-pill px-4 py-2 rounded-full text-sm border whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'active bg-[#e50914] text-white border-[#e50914]'
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat !== 'الكل' && <span className="ml-1">{CATEGORY_ICONS[cat]}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* All channels */}
      <section>
        <h2 className="text-xl font-bold mb-4">جميع القنوات</h2>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد قنوات تطابق البحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onClick={() => handlePlay(ch)}
                isFavorited={favorites.has(ch.id)}
                onToggleFavorite={e => handleToggleFavorite(e, ch.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
