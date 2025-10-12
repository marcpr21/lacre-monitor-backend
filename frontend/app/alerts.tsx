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

interface EmailRecipient {
  email: string;
  enabled: boolean;
  employee_alerts: {
    [employeeId: string]: {
      lacre?: boolean;
      medidor_manha?: boolean;
      medidor_tarde?: boolean;
    };
  };
  alert_all_photos: {
    [employeeId: string]: boolean;
  };
}

export default function AlertsScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([
    { email: '', enabled: false, employee_alerts: {}, alert_all_photos: {} },
    { email: '', enabled: false, employee_alerts: {}, alert_all_photos: {} },
    { email: '', enabled: false, employee_alerts: {}, alert_all_photos: {} },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRecipients, setExpandedRecipients] = useState<Set<number>>(new Set([0]));
  const [searchQueries, setSearchQueries] = useState<string[]>(['', '', '']);

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

      setEmployees(employeesRes.data || []);
      
      const loadedRecipients = configRes.data?.recipients || [];
      // Ensure we always have 3 recipients
      while (loadedRecipients.length < 3) {
        loadedRecipients.push({ email: '', enabled: false, employee_alerts: {}, alert_all_photos: {} });
      }
      setRecipients(loadedRecipients.slice(0, 3));
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate enabled recipients have valid emails
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      if (recipient.enabled) {
        if (!recipient.email) {
          Alert.alert('Erro', `Email ${i + 1}: Por favor, insira um email`);
          return;
        }
        if (!recipient.email.includes('@')) {
          Alert.alert('Erro', `Email ${i + 1}: Email inválido`);
          return;
        }
      }
    }

    try {
      setSaving(true);
      const token = await getAuthToken();
      
      await axios.post(
        `${API_URL}/api/admin/email-alerts/config`,
        { recipients },
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

  const updateRecipient = (index: number, updates: Partial<EmailRecipient>) => {
    setRecipients(prev => {
      const newRecipients = [...prev];
      newRecipients[index] = { ...newRecipients[index], ...updates };
      return newRecipients;
    });
  };

  const toggleAllPhotos = (recipientIndex: number, employeeId: string, value: boolean) => {
    setRecipients(prev => {
      const newRecipients = [...prev];
      const recipient = { ...newRecipients[recipientIndex] };
      
      if (!recipient.alert_all_photos) recipient.alert_all_photos = {};
      recipient.alert_all_photos[employeeId] = value;
      
      // If turning on "all photos", enable all photo types
      if (value) {
        if (!recipient.employee_alerts[employeeId]) {
          recipient.employee_alerts[employeeId] = {};
        }
        recipient.employee_alerts[employeeId] = {
          lacre: true,
          medidor_manha: true,
          medidor_tarde: true,
        };
      }
      
      newRecipients[recipientIndex] = recipient;
      return newRecipients;
    });
  };

  const togglePhotoType = (recipientIndex: number, employeeId: string, photoType: 'lacre' | 'medidor_manha' | 'medidor_tarde', value: boolean) => {
    setRecipients(prev => {
      const newRecipients = [...prev];
      const recipient = { ...newRecipients[recipientIndex] };
      
      if (!recipient.employee_alerts[employeeId]) {
        recipient.employee_alerts[employeeId] = {};
      }
      
      recipient.employee_alerts[employeeId][photoType] = value;
      
      // If any type is unchecked, turn off "all photos"
      if (!value && recipient.alert_all_photos[employeeId]) {
        recipient.alert_all_photos[employeeId] = false;
      }
      
      // If all types are checked, turn on "all photos"
      const alerts = recipient.employee_alerts[employeeId];
      if (alerts.lacre && alerts.medidor_manha && alerts.medidor_tarde) {
        if (!recipient.alert_all_photos) recipient.alert_all_photos = {};
        recipient.alert_all_photos[employeeId] = true;
      }
      
      newRecipients[recipientIndex] = recipient;
      return newRecipients;
    });
  };

  const toggleRecipientExpanded = (index: number) => {
    setExpandedRecipients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const updateSearchQuery = (index: number, query: string) => {
    setSearchQueries(prev => {
      const newQueries = [...prev];
      newQueries[index] = query;
      return newQueries;
    });
  };

  const getActiveAlertsCount = (recipient: EmailRecipient) => {
    let count = 0;
    Object.values(recipient.employee_alerts).forEach((alerts) => {
      Object.values(alerts).forEach((enabled) => {
        if (enabled) count++;
      });
    });
    return count;
  };

  const getFilteredEmployees = (recipientIndex: number) => {
    const query = searchQueries[recipientIndex].toLowerCase();
    if (!query) return employees;
    return employees.filter(emp => emp.name.toLowerCase().includes(query));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Alertas por Email</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <Text style={styles.infoText}>
            Configure até 3 emails para receber alertas quando funcionários enviarem fotos
          </Text>
        </View>

        {recipients.map((recipient, recipientIndex) => {
          const isExpanded = expandedRecipients.has(recipientIndex);
          const activeAlerts = getActiveAlertsCount(recipient);
          const filteredEmployees = getFilteredEmployees(recipientIndex);

          return (
            <View key={recipientIndex} style={styles.recipientCard}>
              <TouchableOpacity
                style={styles.recipientHeader}
                onPress={() => toggleRecipientExpanded(recipientIndex)}
              >
                <View style={styles.recipientHeaderLeft}>
                  <View style={[styles.recipientNumber, recipient.enabled && styles.recipientNumberActive]}>
                    <Text style={[styles.recipientNumberText, recipient.enabled && styles.recipientNumberTextActive]}>
                      {recipientIndex + 1}
                    </Text>
                  </View>
                  <View style={styles.recipientHeaderInfo}>
                    <Text style={styles.recipientTitle}>
                      Email {recipientIndex + 1}
                      {recipient.email && ` - ${recipient.email}`}
                    </Text>
                    {recipient.enabled && activeAlerts > 0 && (
                      <Text style={styles.recipientSubtitle}>{activeAlerts} alerta(s) ativo(s)</Text>
                    )}
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.recipientContent}>
                  {/* Email Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Endereço de Email</Text>
                    <TextInput
                      style={styles.input}
                      value={recipient.email}
                      onChangeText={(text) => updateRecipient(recipientIndex, { email: text })}
                      placeholder="exemplo@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Enable Toggle */}
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <Ionicons
                        name={recipient.enabled ? 'notifications' : 'notifications-off'}
                        size={24}
                        color={recipient.enabled ? '#34C759' : '#999'}
                      />
                      <Text style={styles.toggleLabel}>
                        {recipient.enabled ? 'Alertas Ativos' : 'Alertas Desativados'}
                      </Text>
                    </View>
                    <Switch
                      value={recipient.enabled}
                      onValueChange={(value) => updateRecipient(recipientIndex, { enabled: value })}
                      trackColor={{ false: '#767577', true: '#34C759' }}
                      thumbColor="#FFF"
                    />
                  </View>

                  {recipient.enabled && (
                    <>
                      {/* Search Bar */}
                      <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#999" />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Buscar funcionário..."
                          value={searchQueries[recipientIndex]}
                          onChangeText={(text) => updateSearchQuery(recipientIndex, text)}
                        />
                        {searchQueries[recipientIndex].length > 0 && (
                          <TouchableOpacity onPress={() => updateSearchQuery(recipientIndex, '')}>
                            <Ionicons name="close-circle" size={20} color="#999" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.sectionTitle}>Selecionar Funcionários e Fotos</Text>

                      {/* Employee List */}
                      {filteredEmployees.map((employee) => {
                        const allPhotos = recipient.alert_all_photos[employee.id] || false;
                        const alerts = recipient.employee_alerts[employee.id] || {};
                        const hasAnyAlert = alerts.lacre || alerts.medidor_manha || alerts.medidor_tarde;

                        return (
                          <View key={employee.id} style={styles.employeeItem}>
                            <View style={styles.employeeHeader}>
                              <Text style={styles.employeeName}>{employee.name}</Text>
                              {hasAnyAlert && (
                                <View style={styles.alertBadge}>
                                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                                </View>
                              )}
                            </View>

                            {/* All Photos Toggle */}
                            <TouchableOpacity
                              style={[styles.photoOption, allPhotos && styles.photoOptionActive]}
                              onPress={() => toggleAllPhotos(recipientIndex, employee.id, !allPhotos)}
                            >
                              <Ionicons
                                name={allPhotos ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={allPhotos ? '#007AFF' : '#999'}
                              />
                              <Text style={[styles.photoOptionText, allPhotos && styles.photoOptionTextActive]}>
                                Todas as Fotos
                              </Text>
                            </TouchableOpacity>

                            {/* Individual Photo Types */}
                            <View style={styles.photoTypes}>
                              <TouchableOpacity
                                style={[styles.photoTypeOption, alerts.lacre && styles.photoTypeOptionActive]}
                                onPress={() => togglePhotoType(recipientIndex, employee.id, 'lacre', !alerts.lacre)}
                              >
                                <Ionicons
                                  name={alerts.lacre ? 'checkbox' : 'square-outline'}
                                  size={20}
                                  color={alerts.lacre ? '#007AFF' : '#999'}
                                />
                                <Text style={[styles.photoTypeText, alerts.lacre && styles.photoTypeTextActive]}>
                                  Lacres
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.photoTypeOption, alerts.medidor_manha && styles.photoTypeOptionActive]}
                                onPress={() => togglePhotoType(recipientIndex, employee.id, 'medidor_manha', !alerts.medidor_manha)}
                              >
                                <Ionicons
                                  name={alerts.medidor_manha ? 'checkbox' : 'square-outline'}
                                  size={20}
                                  color={alerts.medidor_manha ? '#007AFF' : '#999'}
                                />
                                <Text style={[styles.photoTypeText, alerts.medidor_manha && styles.photoTypeTextActive]}>
                                  Med. Manhã
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.photoTypeOption, alerts.medidor_tarde && styles.photoTypeOptionActive]}
                                onPress={() => togglePhotoType(recipientIndex, employee.id, 'medidor_tarde', !alerts.medidor_tarde)}
                              >
                                <Ionicons
                                  name={alerts.medidor_tarde ? 'checkbox' : 'square-outline'}
                                  size={20}
                                  color={alerts.medidor_tarde ? '#007AFF' : '#999'}
                                />
                                <Text style={[styles.photoTypeText, alerts.medidor_tarde && styles.photoTypeTextActive]}>
                                  Med. Tarde
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0F8FF',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
  recipientCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  recipientHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  recipientNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientNumberActive: {
    backgroundColor: '#007AFF',
  },
  recipientNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
  },
  recipientNumberTextActive: {
    color: '#FFF',
  },
  recipientHeaderInfo: {
    flex: 1,
  },
  recipientTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recipientSubtitle: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 2,
  },
  recipientContent: {
    padding: 16,
    paddingTop: 0,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
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
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 16,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  employeeItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  alertBadge: {
    backgroundColor: '#34C759',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 6,
    marginBottom: 8,
    gap: 10,
  },
  photoOptionActive: {
    backgroundColor: '#F0F8FF',
  },
  photoOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  photoOptionTextActive: {
    color: '#007AFF',
  },
  photoTypes: {
    flexDirection: 'row',
    gap: 8,
  },
  photoTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 6,
    gap: 6,
  },
  photoTypeOptionActive: {
    backgroundColor: '#F0F8FF',
  },
  photoTypeText: {
    fontSize: 12,
    color: '#666',
  },
  photoTypeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
