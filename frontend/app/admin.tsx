import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const API_BASE_URL = 'https://lacre-monitor-backend.onrender.com/api';

type PhotoType = 'lacre' | 'medidor';

type Photo = {
  _id: string;
  imageUrl: string;
  type: PhotoType;
  employeeName: string;
  employeeId?: string;
  createdAt: string;
  notes?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  status?: string;
};

type FilterType = 'all' | PhotoType;
type PeriodFilter = 'today' | 'week' | 'month' | 'all';

export default function AdminScreen() {
  const { user, token, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'photos'>('photos');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<string[]>([]);

  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const authHeaders = {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  };

  const getPeriodStartDate = (period: PeriodFilter): Date | null => {
    const now = new Date();
    if (period === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return start;
    }
    return null;
  };

  const loadPhotos = useCallback(
    async (resetPage: boolean = false) => {
      try {
        if (resetPage) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const currentPage = resetPage ? 1 : page;
        const params: Record<string, string | number> = {
          page: currentPage,
          limit: 20,
        };

        if (filterType !== 'all') {
          params.type = filterType;
        }

        if (filterEmployee !== 'all') {
          params.employeeName = filterEmployee;
        }

        const startDate = getPeriodStartDate(filterPeriod);
        if (startDate) {
          params.startDate = startDate.toISOString();
        }

        const response = await axios.get(`${API_BASE_URL}/photos`, {
          ...authHeaders,
          params,
        });

        const data = response.data;
        const newPhotos: Photo[] = data.photos || data.data || [];
        const totalPagesResp: number = data.totalPages || data.pages || 1;

        if (resetPage) {
          setPhotos(newPhotos);
          setPage(1);
        } else {
          setPhotos((prev) => [...prev, ...newPhotos]);
        }
        setTotalPages(totalPagesResp);

        const employeeNames = Array.from(
          new Set(newPhotos.map((p) => p.employeeName).filter(Boolean))
        ) as string[];
        if (resetPage) {
          setEmployees(employeeNames);
        } else {
          setEmployees((prev) =>
            Array.from(new Set([...prev, ...employeeNames]))
          );
        }
      } catch (error) {
        console.error('Erro ao carregar fotos:', error);
        Alert.alert('Erro', 'Não foi possível carregar as fotos.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filterType, filterPeriod, filterEmployee, page, token]
  );

  useEffect(() => {
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterPeriod, filterEmployee]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPhotos(true);
  };

  const loadMore = () => {
    if (page < totalPages && !loadingMore) {
      setPage((prev) => prev + 1);
      loadPhotos(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const openPhotoDetail = (photo: Photo) => {
    setSelectedPhoto(photo);
    setModalVisible(true);
  };

  const closePhotoDetail = () => {
    setModalVisible(false);
    setSelectedPhoto(null);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: PhotoType): string => {
    return type === 'lacre' ? 'Lacre' : 'Medidor';
  };

  const renderPhotoCard = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => openPhotoDetail(item)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.photoThumbnail}
        resizeMode="cover"
      />
      <View style={styles.photoInfo}>
        <Text style={styles.photoEmployee} numberOfLines={1}>
          {item.employeeName || 'Funcionário não informado'}
        </Text>
        <Text style={styles.photoDate} numberOfLines={1}>
          {formatDate(item.createdAt)}
        </Text>
        <View style={styles.photoTypeBadge}>
          <Ionicons
            name={item.type === 'lacre' ? 'lock-closed' : 'speedometer'}
            size={12}
            color="#FF6D00"
          />
          <Text style={styles.photoTypeText}>{getTypeLabel(item.type)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (
    label: string,
    value: string,
    currentValue: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        currentValue === value && styles.filterButtonActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterButtonText,
          currentValue === value && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPhotoDetailModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={closePhotoDetail}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes da Foto</Text>
            <TouchableOpacity onPress={closePhotoDetail} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {selectedPhoto && (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Image
                source={{ uri: selectedPhoto.imageUrl }}
                style={styles.modalPhoto}
                resizeMode="contain"
              />

              <View style={styles.detailRow}>
                <Ionicons name="person" size={18} color="#FF6D00" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Funcionário</Text>
                  <Text style={styles.detailValue}>
                    {selectedPhoto.employeeName || 'Não informado'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={18} color="#FF6D00" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Data</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedPhoto.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name={selectedPhoto.type === 'lacre' ? 'lock-closed' : 'speedometer'}
                  size={18}
                  color="#FF6D00"
                />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Tipo</Text>
                  <Text style={styles.detailValue}>
                    {getTypeLabel(selectedPhoto.type)}
                  </Text>
                </View>
              </View>

              {selectedPhoto.notes ? (
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={18} color="#FF6D00" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Observações</Text>
                    <Text style={styles.detailValue}>{selectedPhoto.notes}</Text>
                  </View>
                </View>
              ) : null}

              {selectedPhoto.location &&
              selectedPhoto.location.latitude &&
              selectedPhoto.location.longitude ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={18} color="#FF6D00" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Localização</Text>
                    <Text style={styles.detailValue}>
                      {selectedPhoto.location.latitude.toFixed(6)},{' '}
                      {selectedPhoto.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {selectedPhoto.status ? (
                <View style={styles.detailRow}>
                  <Ionicons name="information-circle" size={18} color="#FF6D00" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>{selectedPhoto.status}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Painel Administrativo</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {user?.name || user?.email || 'Administrador'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photos' && styles.activeTab]}
          onPress={() => setActiveTab('photos')}
        >
          <Ionicons
            name="images"
            size={20}
            color={activeTab === 'photos' ? '#FF6D00' : '#666666'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'photos' && styles.activeTabText,
            ]}
          >
            Fotos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photos Tab Content */}
      {activeTab === 'photos' && (
        <View style={styles.tabContent}>
          {/* Filters */}
          <View style={styles.filtersContainer}>
            <Text style={styles.filterSectionTitle}>Tipo de Foto</Text>
            <View style={styles.filterRow}>
              {renderFilterButton('Todas', 'all', filterType, () => setFilterType('all'))}
              {renderFilterButton('Lacre', 'lacre', filterType, () => setFilterType('lacre'))}
              {renderFilterButton('Medidor', 'medidor', filterType, () => setFilterType('medidor'))}
            </View>

            <Text style={styles.filterSectionTitle}>Período</Text>
            <View style={styles.filterRow}>
              {renderFilterButton('Hoje', 'today', filterPeriod, () => setFilterPeriod('today'))}
              {renderFilterButton('Semana', 'week', filterPeriod, () => setFilterPeriod('week'))}
              {renderFilterButton('Mês', 'month', filterPeriod, () => setFilterPeriod('month'))}
              {renderFilterButton('Tudo', 'all', filterPeriod, () => setFilterPeriod('all'))}
            </View>

            {employees.length > 0 && (
              <>
                <Text style={styles.filterSectionTitle}>Funcionário</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.employeeFilterScroll}
                >
                  <View style={styles.filterRow}>
                    {renderFilterButton(
                      'Todos',
                      'all',
                      filterEmployee,
                      () => setFilterEmployee('all')
                    )}
                    {employees.map((emp) =>
                      renderFilterButton(
                        emp,
                        emp,
                        filterEmployee,
                        () => setFilterEmployee(emp)
                      )
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {/* Photo Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6D00" />
              <Text style={styles.loadingText}>Carregando fotos...</Text>
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>Nenhuma foto encontrada</Text>
              <Text style={styles.emptySubtext}>
                Ajuste os filtros ou aguarde novos envios.
              </Text>
            </View>
          ) : (
            <FlatList
              data={photos}
              keyExtractor={(item) => item._id}
              renderItem={renderPhotoCard}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#FF6D00']}
                  tintColor="#FF6D00"
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color="#FF6D00" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}

      {/* Photo Detail Modal */}
      {renderPhotoDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#0D1B2A',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#FF6D00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#0D1B2A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D1B2A',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#0D1B2A',
    borderColor: '#0D1B2A',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  employeeFilterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
  },
  gridContainer: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoCard: {
    width: (width - 36) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  photoThumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#EEEEEE',
  },
  photoInfo: {
    padding: 10,
  },
  photoEmployee: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D1B2A',
    marginBottom: 2,
  },
  photoDate: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 6,
  },
  photoTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  photoTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6D00',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#0D1B2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalPhoto: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#0D1B2A',
    fontWeight: '500',
  },
});
