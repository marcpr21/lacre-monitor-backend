import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;
          set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      loadUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data, isAuthenticated: true });
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (token) {
          try {
            const response = await api.get('/auth/me');
            set({ user: response.data, isAuthenticated: true });
          } catch {
            set({ user: null, token: null, isAuthenticated: false });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);