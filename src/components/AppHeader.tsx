'use client';

import { useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tv, Home, Settings, History, Shield, LogOut, Heart, User as UserIcon } from 'lucide-react';

export function AppHeader() {
  const { user, logout, setView, currentView, channels, setChannels, token, recommendations, setRecommendations } = useStore();

  const goHome = useCallback(async () => {
    setView('home');
    const chRes = await fetch('/api/channels');
    const chData = await chRes.json();
    setChannels(chData);
    if (token && user) {
      const recRes = await fetch(`/api/recommendations/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData);
      }
    }
  }, [setView, token, user, setChannels, setRecommendations]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={goHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-[#e50914] flex items-center justify-center">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg hidden sm:block">Smart IPTV</span>
        </button>

        <nav className="flex items-center gap-1">
          <Button
            variant={currentView === 'home' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={goHome}
            className="text-sm gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </Button>

          <Button
            variant={currentView === 'favorites' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('favorites')}
            className="text-sm gap-1.5"
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">المفضلة</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setView('history')} className="text-sm gap-1.5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">سجل المشاهدة</span>
          </Button>

          {user?.role === 'admin' && (
            <Button
              variant={currentView === 'admin' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('admin')}
              className="text-sm gap-1.5"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setView('profile')} className="text-muted-foreground hover:text-foreground">
            <UserIcon className="w-4 h-4" />
          </Button>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium leading-tight">{user?.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {user?.role === 'admin' ? <Shield className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
              {user?.role === 'admin' ? 'مدير' : 'مستخدم'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
