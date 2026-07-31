import { create } from 'zustand';

export type ViewType =
  | 'auth'
  | 'home'
  | 'player'
  | 'admin'
  | 'history'
  | 'favorites'
  | 'profile';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Channel {
  id: number;
  title: string;
  category: string;
  tags: string;
  thumbnailUrl: string;
  streamUrl: string;
  createdAt: string;
}

export interface WatchRecord {
  id: number;
  userId: number;
  channelId: number;
  watchedAt: string;
  watchDuration: number;
  channel: Channel;
}

interface AppState {
  // Auth
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;

  // Navigation
  currentView: ViewType;
  setView: (view: ViewType) => void;

  // Selected channel for player
  selectedChannel: Channel | null;
  setSelectedChannel: (channel: Channel) => void;

  // Channels
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;

  // Recommendations
  recommendations: Channel[];
  setRecommendations: (channels: Channel[]) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;

  // Toast
  toastMessage: string;
  toastType: 'success' | 'error' | 'info';
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Server info from AI
  serverInfo: { serverName: string; region: string; load: number; message: string } | null;
  setServerInfo: (info: { serverName: string; region: string; load: number; message: string } | null) => void;
}

export const useStore = create<AppState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('iptv_token') : null,
  user: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('iptv_user') || 'null')
    : null,
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('iptv_token', token);
      localStorage.setItem('iptv_user', JSON.stringify(user));
    }
    set({ token, user });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iptv_token');
      localStorage.removeItem('iptv_user');
    }
    set({ token: null, user: null, currentView: 'auth' });
  },

  currentView: 'auth',
  setView: (view) => set({ currentView: view }),

  selectedChannel: null,
  setSelectedChannel: (channel) => set({ selectedChannel: channel }),

  channels: [],
  setChannels: (channels) => set({ channels }),

  recommendations: [],
  setRecommendations: (channels) => set({ recommendations: channels }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  selectedCategory: 'الكل',
  setSelectedCategory: (c) => set({ selectedCategory: c }),

  toastMessage: '',
  toastType: 'info',
  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => set({ toastMessage: '' }), 3500);
  },

  serverInfo: null,
  setServerInfo: (info) => set({ serverInfo: info }),
}));