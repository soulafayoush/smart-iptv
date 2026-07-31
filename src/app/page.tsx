'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { AuthView, Toast } from '@/components/AuthView';
import { AppHeader } from '@/components/AppHeader';
import { HomeView } from '@/components/HomeView';
import { PlayerView } from '@/components/PlayerView';
import { HistoryView } from '@/components/HistoryView';
import { AdminView } from '@/components/AdminView';
import { FavoritesView } from '@/components/FavoritesView';
import { ProfileView } from '@/components/ProfileView';

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const { token, user, currentView, setChannels, setRecommendations, channels } = useStore();

  useEffect(() => {
    if (token && user) {
      if (channels.length === 0) {
        fetch('/api/channels')
          .then(r => r.json())
          .then(data => setChannels(data))
          .catch(() => {});
      }
      fetch(`/api/recommendations/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => setRecommendations(data))
        .catch(() => {});
    }
  }, [token, user?.id, channels.length]);

  if (!token || !user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {currentView === 'home' && <HomeView />}
        {currentView === 'player' && <PlayerView />}
        {currentView === 'admin' && <AdminView />}
        {currentView === 'history' && <HistoryView />}
        {currentView === 'favorites' && <FavoritesView />}
        {currentView === 'profile' && <ProfileView />}
      </main>
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground">
        <p>منصة IPTV الذكية - مشروع تخرج | Full-Stack + AI Microservice</p>
      </footer>
      <Toast />
    </div>
  );
}
