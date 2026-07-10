import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

// ============ CONSTANTS ============
const API_URL =
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  'http://192.168.0.100:3000/api';

const LACRE_DAYS = [1, 3, 5]; // Segunda(1), Quarta(3), Sexta(5)

// ============ TYPES ============
type TaskType = 'lacre' | 'medidor_manha' | 'medidor_tarde';

interface ScheduleItem {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  days: number[];
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ServerSchedule {
  type: TaskType;
  startTime: string;
  endTime: string;
  days: number[];
  enabled: boolean;
}

interface AuthUser {
  id?: string;
  username: string;
  name?: string;
  role?: string;
  authorizations?: string[];
  token?: string;
}

// ============ NOTIFICATION HANDLER ============
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============ DEFAULT TASKS ============
const DEFAULT_TASKS: ScheduleItem[] = [
  {
    id: 'lacre',
    type: 'lacre',
    title: 'Lacre',
    description: 'Foto do lacre de segurança',
    startTime: '00:00',
    endTime: '12:00',
    days: LACRE_DAYS,
    color: '#FF6B6B',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'medidor_manha',
    type: 'medidor_manha',
    title: 'Medidor Manhã',
    description: 'Leitura do medidor (06:00 - 09:00)',
    startTime: '06:00',
    endTime: '09:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    color: '#FFA726',
    icon: 'speedometer-outline',
  },
  {
    id: 'medidor_tarde',
    type: 'medidor_tarde',
    title: 'Medidor Tarde',
    description: 'Leitura do medidor (17:00 - 18:00)',
    startTime: '17:00',
    endTime: '18:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    color: '#5C6BC0',
    icon: 'time-outline',
  },
];

// ============ HELPER FUNCTIONS ============
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isTaskAvailable(task: ScheduleItem, user?: AuthUser | null): boolean {
  if (!user) return false;

  // Usuário "teste" sempre tem acesso
  if (user.username === 'teste') return true;

  // Autorizações do admin sobrepõem horários
  if (user.authorizations && user.authorizations.includes(task.type)) {
    return true;
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Verifica dia da semana
  if (task.days && task.days.length > 0 && !task.days.includes(currentDay)) {
    return false;
  }

  // Verifica horário
  const startMinutes = parseTimeToMinutes(task.startTime);
  const endMinutes = parseTimeToMinutes(task.endTime);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getDaysLabel(task: ScheduleItem): string {
  if (task.type === 'lacre') {
    return 'Seg, Qua, Sex';
  }
  return 'Todos os dias';
}

// ============ COMPONENT ============
export default function HomeScreen() {
  const { user, logout, token } = useAuthStore() as {
    user: AuthUser | null;
    logout: () => void;
    token?: string;
  };

  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_TASKS);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const notificationIds = useRef<string[]>([]);

  // ============ LOAD SCHEDULES ============
  const loadSchedules = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/schedules`, {
        headers,
        timeout: 10000,
      });

      if (response.data && Array.isArray(response.data)) {
        const serverSchedules: ServerSchedule[] = response.data;
        const updatedTasks = DEFAULT_TASKS.map((task) => {
          const serverSchedule = serverSchedules.find(
            (s) => s.type === task.type && s.enabled
          );
          if (serverSchedule) {
            return {
              ...task,
              startTime: serverSchedule.startTime || task.startTime,
              endTime: serverSchedule.endTime || task.endTime,
              days: serverSchedule.days || task.days,
            };
          }
          return task;
        });
        setSchedules(updatedTasks);
      }
    } catch (error) {
      console.warn('Erro ao carregar schedules do servidor:', error);
      setSchedules(DEFAULT_TASKS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // ============ SETUP NOTIFICATIONS ============
  const setupNotifications = useCallback(async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Permissão de notificação não concedida');
        return;
      }

      // Configura canal no Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Lacre Monitor',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6D00',
        });
      }

      // Cancela notificações anteriores
      await Notifications.cancelAllScheduledNotificationsAsync();
      notificationIds.current = [];

      // Agenda notificações para cada tarefa
      for (const task of schedules) {
        const [startH, startM] = task.startTime.split(':').map(Number);

        for (const day of task.days) {
          try {
            const notificationId =
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `📷 ${task.title}`,
                  body: `Está na hora de tirar a foto: ${task.description}`,
                  sound: true,
                  data: { taskType: task.type },
                },
                trigger: {
                  weekday: day + 1,
                  hour: startH,
                  minute: startM,
                  repeats: true,
                } as any,
              });
            notificationIds.current.push(notificationId);
          } catch (schedError) {
            console.warn(
              `Erro ao agendar notificação para ${task.title} (dia ${day}):`,
              schedError
            );
          }
        }
      }

      console.log(
        `✅ ${notificationIds.current.length} notificações agendadas`
      );
    } catch (error) {
      console.error('Erro ao configurar notificações:', error);
    }
  }, [schedules]);

  // ============ EFFECT: INITIAL LOAD ============
  useEffect(() => {
    (async () => {
      await loadSchedules();
    })();
  }, [loadSchedules]);

  // ============ EFFECT: NOTIFICATIONS ============
  useEffect(() => {
    if (!loading) {
      setupNotifications();
    }
  }, [loading, setupNotifications]);

  // ============ HANDLE TAKE PHOTO ============
  const handleTakePhoto = useCallback(
    (task: ScheduleItem) => {
      if (!isTaskAvailable(task, user)) {
        Alert.alert(
          'Indisponível',
          `A tarefa "${task.title}" não está disponível no momento.\n\nHorário permitido: ${task.startTime} - ${task.endTime}`,
          [{ text: 'OK' }]
        );
        return;
      }

      router.push({
        pathname: '/camera',
        params: {
          taskType: task.type,
          taskTitle: task.title,
        },
      });
    },
    [user]
  );

  // ============ ON REFRESH ============
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedules();
  }, [loadSchedules]);

  // ============ HANDLE LOGOUT ============
  const handleLogout = useCallback(() => {
    Alert.alert('Sair', 'Deseja realmente sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await Notifications.cancelAllScheduledNotificationsAsync();
          } catch (e) {
            // ignore
          }
          logout();
          router.replace('/login');
        },
      },
    ]);
  }, [logout]);

  // ============ RENDER CARD ============
  const renderCard = (task: ScheduleItem) => {
    const available = isTaskAvailable(task, user);

    return (
      <View key={task.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: task.color }]}>
            <Ionicons name={task.icon} size={28} color="#FFFFFF" />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            <Text style={styles.cardSubtitle}>{task.description}</Text>
          </View>
        </View>

        <View style={styles.cardTimeInfo}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.cardTimeText}>
              Horário: {task.startTime} - {task.endTime}
            </Text>
          </View>
          <View style={styles.timeRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.cardTimeText}>{getDaysLabel(task)}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: available ? '#22C55E' : '#CCC' },
            ]}
          />
          <Text
            style={
              available ? styles.statusAvailable : styles.statusUnavailable
            }
          >
            {available ? 'Disponível agora!' : 'Indisponível'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            !available && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTakePhoto(task)}
          disabled={!available}
          activeOpacity={0.8}
        >
          <Ionicons
            name="camera-outline"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.actionButtonText}>Tirar Foto</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ============ RENDER LOADING ============
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />
        <View style={styles.header}>
          <View style={styles.headerGradient} />
          <Text style={styles.headerTitle}>Lacre Monitor</Text>
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#FF6D00" />
          <Text style={styles.loadingText}>Carregando tarefas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ RENDER MAIN ============
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerGradient} />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Lacre Monitor</Text>
            <Text style={styles.headerSubtitle}>
              {user?.name || user?.username || 'Funcionário'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* SCROLL */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6D00']}
            tintColor="#FF6D00"
          />
        }
      >
        <Text style={styles.sectionTitle}>Tarefas Disponíveis</Text>
        <Text style={styles.sectionSubtitle}>
          Puxe para atualizar os horários
        </Text>

        {schedules.map((task) => renderCard(task))}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color="#999" />
          <Text style={styles.footerText}>
            {user?.username === 'teste'
              ? 'Modo teste: todas as tarefas disponíveis'
              : 'Verifique os horários permitidos'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#0D1B2A',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1B263B',
    opacity: 0.5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 109, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0D1B2A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D1B2A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  cardTimeInfo: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTimeText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusAvailable: {
    color: '#22C55E',
    fontWeight: '600',
    fontSize: 14,
  },
  statusUnavailable: {
    color: '#999',
    fontWeight: '500',
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#FF6D00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
    textAlign: 'center',
  },
});
