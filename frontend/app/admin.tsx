import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, getAuthToken } from './store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Photo {
  id: string;
  employee_id: string;
  employee_name: string;
  photo_type: string;
  image_base64: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  scheduled_period: string;
}

interface Employee {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function Admin() {
  const { user, logout } = useAuthStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'lacre' | 'medidor'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar esta área');
      logout();
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadPhotos(), loadEmployees()]);
  };

  const loadPhotos = async () => {
    try {
      const token = await getAuthToken();
      const params: any = { limit: 100 };

      if (filterType !== 'all') {
        params.photo_type = filterType;
      }

      if (selectedEmployee !== 'all') {
        params.employee_id = selectedEmployee;
      }

      const response = await axios.get(`${API_URL}/api/photos`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setPhotos(response.data.photos);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Erro', 'Não foi possível carregar as fotos');
    }
  };

  const loadEmployees = async () => {
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/api/users/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEmployees(response.data);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openPhotoDetails = (photo: Photo) => {
    setSelectedPhoto(photo);
    setShowModal(true);
  };

  const applyFilters = async () => {
    setShowFilters(false);
    await loadPhotos();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <Text style={styles.headerTitle}>Painel Admin</Text>
          <Text style={styles.headerSubtitle}>{user?.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => router.push('/users')}
          >
            <Ionicons name="people" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Tipo de Foto:</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
              onPress={() => setFilterType('all')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterType === 'all' && styles.filterTabTextActive,
                ]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filterType === 'lacre' && styles.filterTabActive]}
              onPress={() => setFilterType('lacre')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterType === 'lacre' && styles.filterTabTextActive,
                ]}
              >
                Lacre
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filterType === 'medidor' && styles.filterTabActive]}
              onPress={() => setFilterType('medidor')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterType === 'medidor' && styles.filterTabTextActive,
                ]}
              >
                Medidor
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterLabel}>Funcionário:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.employeeChip,
                selectedEmployee === 'all' && styles.employeeChipActive,
              ]}
              onPress={() => setSelectedEmployee('all')}
            >
              <Text
                style={[
                  styles.employeeChipText,
                  selectedEmployee === 'all' && styles.employeeChipTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>
            {employees.map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={[
                  styles.employeeChip,
                  selectedEmployee === emp.id && styles.employeeChipActive,
                ]}
                onPress={() => setSelectedEmployee(emp.id)}
              >
                <Text
                  style={[
                    styles.employeeChipText,
                    selectedEmployee === emp.id && styles.employeeChipTextActive,
                  ]}
                >
                  {emp.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
            <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.photoCount}>Total: {photos.length} fotos</Text>

        {(() => {
          // Group photos by date
          const groupedPhotos: { [key: string]: Photo[] } = {};
          
          photos.forEach((photo) => {
            const date = new Date(photo.timestamp);
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!groupedPhotos[dateKey]) {
              groupedPhotos[dateKey] = [];
            }
            groupedPhotos[dateKey].push(photo);
          });

          // Sort dates in descending order (most recent first)
          const sortedDates = Object.keys(groupedPhotos).sort((a, b) => 
            new Date(b).getTime() - new Date(a).getTime()
          );

          if (sortedDates.length === 0) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Nenhuma foto encontrada</Text>
              </View>
            );
          }

          return sortedDates.map((dateKey) => {
            const datePhotos = groupedPhotos[dateKey];
            const date = new Date(dateKey + 'T12:00:00'); // Avoid timezone issues
            
            // Format date
            const dateStr = date.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            });

            // Capitalize first letter
            const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

            return (
              <View key={dateKey} style={styles.dateSection}>
                <View style={styles.dateSectionHeader}>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.dateSectionTitle}>{formattedDate}</Text>
                  <View style={styles.dateCountBadge}>
                    <Text style={styles.dateCountText}>{datePhotos.length}</Text>
                  </View>
                </View>

                {datePhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.photoCard}
                    onPress={() => openPhotoDetails(photo)}
                  >
                    <Image source={{ uri: photo.image_base64 }} style={styles.thumbnail} />
                    <View style={styles.photoInfo}>
                      <View style={styles.photoHeader}>
                        <Text style={styles.employeeName}>{photo.employee_name}</Text>
                        <View
                          style={[
                            styles.typeBadge,
                            { backgroundColor: photo.photo_type === 'lacre' ? '#FF6B6B20' : '#4ECDC420' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeText,
                              { color: photo.photo_type === 'lacre' ? '#FF6B6B' : '#4ECDC4' },
                            ]}
                          >
                            {photo.photo_type === 'lacre' ? 'Lacre' : 'Medidor'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.period}>{photo.scheduled_period}</Text>
                      <View style={styles.photoMeta}>
                        <Ionicons name="time-outline" size={14} color="#666" />
                        <Text style={styles.metaText}>{formatDate(photo.timestamp)}</Text>
                      </View>
                      {photo.location_name && (
                        <View style={styles.photoMeta}>
                          <Ionicons name="location-outline" size={14} color="#666" />
                          <Text style={styles.metaText} numberOfLines={1}>
                            {photo.location_name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          });
        })()}
      </ScrollView>

      {/* Photo Details Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes da Foto</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedPhoto && (
            <ScrollView style={styles.modalContent}>
              <Image
                source={{ uri: selectedPhoto.image_base64 }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={20} color="#007AFF" />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Funcionário</Text>
                    <Text style={styles.detailValue}>{selectedPhoto.employee_name}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name={selectedPhoto.photo_type === 'lacre' ? 'lock-closed' : 'speedometer'}
                    size={20}
                    color="#007AFF"
                  />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Tipo</Text>
                    <Text style={styles.detailValue}>
                      {selectedPhoto.photo_type === 'lacre' ? 'Lacre' : 'Medidor'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Período</Text>
                    <Text style={styles.detailValue}>{selectedPhoto.scheduled_period}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="time" size={20} color="#007AFF" />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Data/Hora</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedPhoto.timestamp)}</Text>
                  </View>
                </View>

                {selectedPhoto.location_name && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={20} color="#007AFF" />
                    <View style={styles.detailText}>
                      <Text style={styles.detailLabel}>Localização</Text>
                      <Text style={styles.detailValue}>{selectedPhoto.location_name}</Text>
                    </View>
                  </View>
                )}

                {selectedPhoto.latitude && selectedPhoto.longitude && (
                  <View style={styles.detailRow}>
                    <Ionicons name="navigate" size={20} color="#007AFF" />
                    <View style={styles.detailText}>
                      <Text style={styles.detailLabel}>Coordenadas</Text>
                      <Text style={styles.detailValue}>
                        {selectedPhoto.latitude.toFixed(6)}, {selectedPhoto.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  employeeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  employeeChipActive: {
    backgroundColor: '#007AFF',
  },
  employeeChipText: {
    fontSize: 14,
    color: '#666',
  },
  employeeChipTextActive: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  photoCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  photoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  photoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  period: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  photoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  fullImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#f5f5f5',
  },
  detailsContainer: {
    padding: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailText: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
