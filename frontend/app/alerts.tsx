import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import { getAuthToken } from './store/authStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Employee {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface EmailAlertConfig {
  admin_email: string;
  enabled: boolean;
  employee_alerts: {
    [employeeId: string]: {
      lacre?: boolean;
      medidor_manha?: boolean;
      medidor_tarde?: boolean;
    };
  };
}

export default function AlertsScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [config, setConfig] = useState<EmailAlertConfig>({
    admin_email: '',
    enabled: false,
    employee_alerts: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      const [employeesRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/api/users/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/admin/email-alerts/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setEmployees(employeesRes.data);
      
      const loadedConfig = configRes.data;
      setConfig({
        admin_email: loadedConfig.admin_email || '',
        enabled: loadedConfig.enabled || false,
        employee_alerts: loadedConfig.alerts || {},
      });
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (config.enabled && !config.admin_email) {
      Alert.alert('Erro', 'Por favor, insira um email de administrador');
      return;
    }

    if (config.enabled && !config.admin_email.includes('@')) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    try {
      setSaving(true);
      const token = await getAuthToken();
      
      await axios.post(
        `${API_URL}/api/admin/email-alerts/config`,
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving config:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível salvar as configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleAlert = (employeeId: string, photoType: 'lacre' | 'medidor_manha' | 'medidor_tarde') => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      if (!newConfig.employee_alerts[employeeId]) {
        newConfig.employee_alerts[employeeId] = {};
      }
      newConfig.employee_alerts[employeeId][photoType] = !newConfig.employee_alerts[employeeId][photoType];
      return newConfig;
    });
  };

  const getAlertStatus = (employeeId: string, photoType: string) => {
    return config.employee_alerts[employeeId]?.[photoType as keyof typeof config.employee_alerts[string]] || false;
  };

  const getActiveAlertsCount = () => {
    let count = 0;
    Object.values(config.employee_alerts).forEach((alerts) => {
      Object.values(alerts).forEach((enabled) => {
        if (enabled) count++;
      });
    });
    return count;
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Configurar Alertas</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="checkmark" size={28} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Email Configuration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mail" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Email do Administrador</Text>
          </View>
          
          <TextInput
            style={styles.emailInput}
            value={config.admin_email}
            onChangeText={(text) => setConfig({ ...config, admin_email: text })}
            placeholder="admin@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Enable/Disable Alerts */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="notifications" size={24} color="#FF9500" />
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Alertas por Email</Text>
                <Text style={styles.toggleSubtitle}>
                  {config.enabled ? 'Ativado' : 'Desativado'}
                </Text>
              </View>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={(value) => setConfig({ ...config, enabled: value })}
              trackColor={{ false: '#767577', true: '#34C759' }}
              thumbColor="#FFF"
            />
          </View>
          
          {config.enabled && (
            <View style={styles.alertInfo}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.alertInfoText}>
                Você receberá um email quando os funcionários selecionados enviarem fotos
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        {config.enabled && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={28} color="#007AFF" />
              <Text style={styles.statValue}>{employees.length}</Text>
              <Text style={styles.statLabel}>Funcionários</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="notifications-circle" size={28} color="#34C759" />
              <Text style={styles.statValue}>{getActiveAlertsCount()}</Text>
              <Text style={styles.statLabel}>Alertas Ativos</Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        {config.enabled && (
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar funcionário..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionSubtitle}>
              Selecione os funcionários e tipos de foto para receber alertas
            </Text>

            {/* Employee Alert Configuration */}
            {filteredEmployees.map((employee) => {
              const hasAlerts = 
                getAlertStatus(employee.id, 'lacre') ||
                getAlertStatus(employee.id, 'medidor_manha') ||
                getAlertStatus(employee.id, 'medidor_tarde');

              return (
                <View key={employee.id} style={styles.employeeCard}>
                  <View style={styles.employeeHeader}>
                    <View style={styles.employeeTitleRow}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      {hasAlerts && (
                        <View style={styles.activeBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.alertOptions}>
                    <TouchableOpacity
                      style={[
                        styles.alertOption,
                        getAlertStatus(employee.id, 'lacre') && styles.alertOptionActive,
                      ]}
                      onPress={() => toggleAlert(employee.id, 'lacre')}
                    >
                      <Ionicons
                        name={getAlertStatus(employee.id, 'lacre') ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={getAlertStatus(employee.id, 'lacre') ? '#007AFF' : '#999'}
                      />
                      <View style={styles.alertOptionText}>
                        <Text style={[
                          styles.alertOptionTitle,
                          getAlertStatus(employee.id, 'lacre') && styles.alertOptionTitleActive
                        ]}>
                          Lacres
                        </Text>
                        <Text style={styles.alertOptionSubtitle}>Seg/Qua/Sex 06:00-12:00</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.alertOption,
                        getAlertStatus(employee.id, 'medidor_manha') && styles.alertOptionActive,
                      ]}
                      onPress={() => toggleAlert(employee.id, 'medidor_manha')}
                    >
                      <Ionicons
                        name={getAlertStatus(employee.id, 'medidor_manha') ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={getAlertStatus(employee.id, 'medidor_manha') ? '#007AFF' : '#999'}
                      />
                      <View style={styles.alertOptionText}>
                        <Text style={[
                          styles.alertOptionTitle,
                          getAlertStatus(employee.id, 'medidor_manha') && styles.alertOptionTitleActive
                        ]}>
                          Medidor Manhã
                        </Text>
                        <Text style={styles.alertOptionSubtitle}>Todos os dias 06:00-09:00</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.alertOption,
                        getAlertStatus(employee.id, 'medidor_tarde') && styles.alertOptionActive,
                      ]}
                      onPress={() => toggleAlert(employee.id, 'medidor_tarde')}
                    >
                      <Ionicons
                        name={getAlertStatus(employee.id, 'medidor_tarde') ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={getAlertStatus(employee.id, 'medidor_tarde') ? '#007AFF' : '#999'}
                      />
                      <View style={styles.alertOptionText}>
                        <Text style={[
                          styles.alertOptionTitle,
                          getAlertStatus(employee.id, 'medidor_tarde') && styles.alertOptionTitleActive
                        ]}>
                          Medidor Tarde
                        </Text>
                        <Text style={styles.alertOptionSubtitle}>Todos os dias 17:00-18:00</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {!config.enabled && (
          <View style={styles.disabledState}>
            <Ionicons name="notifications-off" size={64} color="#CCC" />
            <Text style={styles.disabledText}>
              Ative os alertas por email para configurar notificações
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  alertInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 4,
  },
  employeeCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeHeader: {
    marginBottom: 12,
  },
  employeeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#34C759',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertOptions: {
    gap: 12,
  },
  alertOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  alertOptionActive: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  alertOptionText: {
    flex: 1,
  },
  alertOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  alertOptionTitleActive: {
    color: '#007AFF',
  },
  alertOptionSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  disabledState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  disabledText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
