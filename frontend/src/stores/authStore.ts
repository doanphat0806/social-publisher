import { create } from 'zustand';
import { User } from '../types/index.js';
import { api } from '../services/api.js';
import { disconnectSocket } from '../services/socket.js';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('xeko_user') || 'null'),
  token: localStorage.getItem('xeko_token') || null,
  isAuthenticated: !!localStorage.getItem('xeko_token'),
  isLoading: false,

  login: (token: string, user: User) => {
    localStorage.setItem('xeko_token', token);
    localStorage.setItem('xeko_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('xeko_token');
    localStorage.removeItem('xeko_user');
    disconnectSocket();
    set({ token: null, user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get('/auth/me');
      const user = res.data.data.user;
      localStorage.setItem('xeko_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('xeko_token');
      localStorage.removeItem('xeko_user');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

