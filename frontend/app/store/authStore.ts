import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
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
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isLoading: false });
        
        if (user.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/home');
        }
      } else {
        set({ isLoading: false });
        router.replace('/login');
      }
    } catch (error) {
      console.error('Init auth error:', error);
      set({ isLoading: false });
      router.replace('/login');
    }
  },

  login: async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/users/login`, {
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
      console.log('Logout function called');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      console.log('Storage cleared');
      set({ user: null, token: null, isAuthenticated: false });
      console.log('State updated');
      router.replace('/login');
      console.log('Navigated to login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if storage fails
      set({ user: null, token: null, isAuthenticated: false });
      router.replace('/login');
    }
  },
}));

export const getAuthToken = async () => {
  return await AsyncStorage.getItem('token');
};
