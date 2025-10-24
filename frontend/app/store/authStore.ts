import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://lacre-monitor-backend-production.up.railway.app';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  required_photos?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  initAuth: async () => {
    try {
      // Always clear storage to require fresh login
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      console.log('🔄 Starting fresh - login required');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      router.replace('/login');
    } catch (error) {
      console.error('Init auth error:', error);
      set({ isLoading: false });
      router.replace('/login');
    }
  },

  login: async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });

      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      set({ user, token, isAuthenticated: true });

      if (user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.detail || 'Erro ao fazer login');
    }
  },

  logout: async () => {
    try {
      console.log('🚪 Logout initiated');
      
      // Clear storage
      try {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        console.log('✅ Storage cleared');
      } catch (storageError) {
        console.warn('⚠️ Storage clear failed:', storageError);
      }
      
      // Update state immediately
      set({ user: null, token: null, isAuthenticated: false });
      console.log('✅ Auth state cleared');
      
      // Navigate to login - multiple strategies
      console.log('🔄 Attempting navigation...');
      
      // Strategy 1: Router replace
      try {
        router.replace('/login');
        console.log('✅ Router navigation successful');
        return;
      } catch (routerError) {
        console.warn('⚠️ Router failed:', routerError);
      }
      
      // Strategy 2: Router push (fallback)
      try {
        router.push('/login');
        console.log('✅ Router push successful');
        return;
      } catch (pushError) {
        console.warn('⚠️ Router push failed:', pushError);
      }
      
      // Strategy 3: Window location (web fallback)
      if (typeof window !== 'undefined') {
        console.log('🌐 Using window navigation for web');
        window.location.href = '/login';
        return;
      }
      
      console.log('✅ Logout completed');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Emergency fallback - just clear state
      set({ user: null, token: null, isAuthenticated: false });
      
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  },
}));

export const getAuthToken = async () => {
  return await AsyncStorage.getItem('token');
};
