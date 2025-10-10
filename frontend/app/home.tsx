import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from './store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

interface ScheduleItem {
  type: 'lacre' | 'medidor';
  title: string;
  description: string;
  allowed: boolean;
  message: string;
  icon: string;
  color: string;
}

export default function Home() {
  const { user, logout } = useAuthStore();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSchedules();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    // Cancel all existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday
    const hour = now.getHours();

    // LACRE NOTIFICATIONS - Every 1 hour on valid days (Monday, Wednesday, Friday)
    const lacreDays = [1, 3, 5]; // Monday, Wednesday, Friday
    
    if (lacreDays.includes(dayOfWeek) && hour < 12) {
      // Schedule notifications every 1 hour until 12:00
      for (let h = hour + 1; h <= 12; h++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔒 Lembrete: Fotos de Lacre Pendentes',
            body: `Não esqueça de tirar as fotos dos lacres! Você tem até 12:00 (${12 - h}h restantes)`,
            sound: true,
            priority: 'high',
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            hour: h,
            minute: 0,
            repeats: false,
          },
        });
      }
    }

    // Schedule for next valid days
    lacreDays.forEach(async (day) => {
      // Morning reminders (8, 9, 10, 11 AM)
      for (let h = 8; h <= 11; h++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔒 Lembrete: Fotos de Lacre',
            body: 'Hora de tirar as fotos dos lacres! Prazo até 12:00',
            sound: true,
            priority: 'high',
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            weekday: day,
            hour: h,
            minute: 0,
            repeats: true,
          },
        });
      }
    });

    // MEDIDOR NOTIFICATIONS - Every 15 minutes during valid periods
    
    // Morning period: 06:00-09:00
    if (hour >= 6 && hour < 9) {
      // Schedule for remaining time in current period
      const minutesOptions = [0, 15, 30, 45];
      const currentMinutes = now.getMinutes();
      
      for (let h = hour; h < 9; h++) {
        for (const minute of minutesOptions) {
          if (h === hour && minute <= currentMinutes) continue;
          
          const remainingTime = (9 - h - 1) * 60 + (60 - minute);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚡ Lembrete: Foto do Medidor (Manhã)',
              body: `Tire a foto do medidor agora! Período: 06:00-09:00 (${Math.ceil(remainingTime / 60)}h restantes)`,
              sound: true,
              priority: 'max',
              vibrate: [0, 250, 250, 250],
            },
            trigger: {
              hour: h,
              minute: minute,
              repeats: false,
            },
          });
        }
      }
    }

    // Evening period: 17:00-18:00
    if (hour >= 17 && hour < 18) {
      // Schedule for remaining time in current period
      const minutesOptions = [0, 15, 30, 45];
      const currentMinutes = now.getMinutes();
      
      for (const minute of minutesOptions) {
        if (minute <= currentMinutes) continue;
        
        const remainingTime = 60 - minute;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚡ Lembrete: Foto do Medidor (Tarde)',
            body: `Tire a foto do medidor agora! Período: 17:00-18:00 (${remainingTime}min restantes)`,
            sound: true,
            priority: 'max',
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            hour: 17,
            minute: minute,
            repeats: false,
          },
        });
      }
    }

    // Schedule for future days - Morning period (every 15 min from 6-9 AM)
    const minutesOptions = [0, 15, 30, 45];
    for (let h = 6; h < 9; h++) {
      for (const minute of minutesOptions) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚡ Foto do Medidor - Manhã',
            body: 'Lembrete: Tire a foto do medidor agora! (06:00-09:00)',
            sound: true,
            priority: 'max',
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            hour: h,
            minute: minute,
            repeats: true,
          },
        });
      }
    }

    // Schedule for future days - Evening period (every 15 min from 5-6 PM)
    for (const minute of minutesOptions) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚡ Foto do Medidor - Tarde',
          body: 'Lembrete: Tire a foto do medidor agora! (17:00-18:00)',
          sound: true,
          priority: 'max',
          vibrate: [0, 250, 250, 250],
        },
        trigger: {
          hour: 17,
          minute: minute,
          repeats: true,
        },
      });
    }

    console.log('✅ Notificações agendadas com sucesso');
  };

  const loadSchedules = async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday
    const hour = now.getHours();

    const scheduleData: ScheduleItem[] = [];

    // CHECK IF USER IS "teste" - bypass all validations
    const isTestUser = user?.username?.toLowerCase() === 'teste';

    // Check Lacre schedule
    const lacreDays = [1, 3, 5]; // Monday, Wednesday, Friday
    const isLacreDay = lacreDays.includes(dayOfWeek);
    const isBeforeNoon = hour < 12;

    scheduleData.push({
      type: 'lacre',
      title: 'Foto de Lacre',
      description: isTestUser ? 'Teste - Horário livre' : 'Segunda, Quarta e Sexta até 12:00',
      allowed: isTestUser || (isLacreDay && isBeforeNoon),
      message: isTestUser 
        ? 'Usuário de teste - sempre disponível!'
        : isLacreDay
        ? isBeforeNoon
          ? 'Disponível agora!'
          : 'Período encerrado (até 12:00)'
        : 'Disponível apenas em Seg/Qua/Sex',
      icon: 'lock-closed',
      color: '#FF6B6B',
    });

    // Check Medidor schedule - Morning and Afternoon separately
    const isMorning = hour >= 6 && hour < 9;
    const isEvening = hour >= 17 && hour < 18;

    // Morning medidor
    scheduleData.push({
      type: 'medidor',
      title: 'Medidor - Manhã',
      description: isTestUser ? 'Teste - Horário livre' : '06:00-09:00',
      allowed: isTestUser || isMorning,
      message: isTestUser 
        ? 'Usuário de teste - sempre disponível!'
        : isMorning ? 'Disponível agora!' : 'Período: 06:00-09:00',
      icon: 'sunny',
      color: '#FFA726',
    });

    // Afternoon medidor
    scheduleData.push({
      type: 'medidor',
      title: 'Medidor - Tarde',
      description: isTestUser ? 'Teste - Horário livre' : '17:00-18:00',
      allowed: isTestUser || isEvening,
      message: isTestUser 
        ? 'Usuário de teste - sempre disponível!'
        : isEvening ? 'Disponível agora!' : 'Período: 17:00-18:00',
      icon: 'moon',
      color: '#5C6BC0',
    });

    setSchedules(scheduleData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedules();
    setRefreshing(false);
  };

  const handleTakePhoto = (photoType: 'lacre' | 'medidor', allowed: boolean) => {
    if (!allowed) {
      Alert.alert(
        'Fora do horário',
        photoType === 'lacre'
          ? 'Fotos de lacre só podem ser tiradas em Segunda, Quarta e Sexta até 12:00'
          : 'Fotos de medidor devem ser tiradas entre 06:00-09:00 ou 17:00-18:00'
      );
      return;
    }

    router.push(`/camera?type=${photoType}`);
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Tarefas de Hoje</Text>

        {schedules.map((schedule, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.scheduleCard,
              !schedule.allowed && styles.scheduleCardDisabled,
            ]}
            onPress={() => handleTakePhoto(schedule.type, schedule.allowed)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: schedule.color + '20' }]}>
              <Ionicons name={schedule.icon as any} size={32} color={schedule.color} />
            </View>

            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleTitle}>{schedule.title}</Text>
              <Text style={styles.scheduleDescription}>{schedule.description}</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: schedule.allowed ? '#4CAF50' : '#FFA726' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: schedule.allowed ? '#4CAF50' : '#FFA726' },
                  ]}
                >
                  {schedule.message}
                </Text>
              </View>
            </View>

            <Ionicons
              name="camera"
              size={24}
              color={schedule.allowed ? schedule.color : '#CCCCCC'}
            />
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Importante</Text>
            <Text style={styles.infoText}>
              As fotos serão tiradas diretamente pela câmera e não serão salvas no seu celular.
              Você receberá lembretes nos horários corretos.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scheduleCardDisabled: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scheduleDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
