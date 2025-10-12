import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
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

interface Authorization {
  authorized: boolean;
  expires_at: string;
  authorized_by: string;
}

export default function AuthorizationsScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [authorizations, setAuthorizations] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState('');
  const [duration, setDuration] = useState('24');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const [employeesRes, authsRes] = await Promise.all([
        axios.get(`${API_URL}/api/users/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/admin/authorizations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setEmployees(employeesRes.data);
      setAuthorizations(authsRes.data.authorizations || {});
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const openAuthorizeModal = (employee: Employee, photoType: string) => {
    setSelectedEmployee(employee);
    setSelectedPhotoType(photoType);
    setShowModal(true);
  };

  const handleAuthorize = async () => {
    if (!selectedEmployee || !selectedPhotoType || !duration) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    try {
      const token = await getAuthToken();
      await axios.post(
        `${API_URL}/api/admin/authorize`,
        {
          employee_id: selectedEmployee.id,
          photo_type: selectedPhotoType,
          duration_hours: parseInt(duration),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Sucesso', 'Autorização concedida!');
      setShowModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error authorizing:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível autorizar');
    }
  };

  const handleRevoke = async (employeeId: string, photoType: string) => {
    Alert.alert(
      'Confirmar',
      'Deseja revogar esta autorização?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              await axios.delete(
                `${API_URL}/api/admin/authorizations/${employeeId}/${photoType}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Sucesso', 'Autorização revogada');
              loadData();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível revogar a autorização');
            }
          },
        },
      ]
    );
  };

  const getPhotoTypeLabel = (type: string) => {
    const labels: any = {
      lacre: 'Lacres',
      medidor_manha: 'Medidor Manhã',
      medidor_tarde: 'Medidor Tarde',
    };
    return labels[type] || type;
  };

  const formatExpiry = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
        <Text style={styles.title}>Autorizações</Text>
        <TouchableOpacity onPress={loadData}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.subtitle}>
          Autorize funcionários a tirar fotos fora do horário permitido
        </Text>

        {employees.map((employee) => {
          const empAuths = authorizations[employee.id] || {};
          const hasAuths = Object.keys(empAuths).length > 0;

          return (
            <View key={employee.id} style={styles.employeeCard}>
              <View style={styles.employeeHeader}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                {hasAuths && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Ativo</Text>
                  </View>
                )}
              </View>

              {hasAuths && (
                <View style={styles.activeAuths}>
                  {Object.entries(empAuths).map(([type, auth]: [string, any]) => (
                    <View key={type} style={styles.authItem}>
                      <View style={styles.authInfo}>
                        <Text style={styles.authType}>{getPhotoTypeLabel(type)}</Text>
                        <Text style={styles.authExpiry}>
                          Válido até: {formatExpiry(auth.expires_at)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevoke(employee.id, type)}
                        style={styles.revokeButton}
                      >
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.authButtons}>
                <TouchableOpacity
                  style={styles.authButton}
                  onPress={() => openAuthorizeModal(employee, 'lacre')}
                >
                  <Ionicons name="lock-closed" size={20} color="#007AFF" />
                  <Text style={styles.authButtonText}>Lacres</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.authButton}
                  onPress={() => openAuthorizeModal(employee, 'medidor_manha')}
                >
                  <Ionicons name="sunny" size={20} color="#007AFF" />
                  <Text style={styles.authButtonText}>Med. Manhã</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.authButton}
                  onPress={() => openAuthorizeModal(employee, 'medidor_tarde')}
                >
                  <Ionicons name="moon" size={20} color="#007AFF" />
                  <Text style={styles.authButtonText}>Med. Tarde</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conceder Autorização</Text>

            <Text style={styles.modalLabel}>Funcionário:</Text>
            <Text style={styles.modalValue}>{selectedEmployee?.name}</Text>

            <Text style={styles.modalLabel}>Tipo de Foto:</Text>
            <Text style={styles.modalValue}>{getPhotoTypeLabel(selectedPhotoType)}</Text>

            <Text style={styles.modalLabel}>Válido por (horas):</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="24"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAuthorize}
              >
                <Text style={styles.confirmButtonText}>Autorizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  employeeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activeBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  activeAuths: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  authItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authInfo: {
    flex: 1,
  },
  authType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  authExpiry: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  revokeButton: {
    padding: 4,
  },
  authButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  authButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  authButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
