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

interface ComplianceReport {
  employee_id: string;
  employee_name: string;
  missing_lacres: {
    date: string;
    date_formatted: string;
    weekday: string;
  }[];
  missing_medidor: {
    date: string;
    date_formatted: string;
    period: string;
    weekday: string;
  }[];
  total_missing_lacres: number;
  total_missing_medidor: number;
  total_missing: number;
  lacre_compliance: number;
  medidor_compliance: number;
  overall_compliance: number;
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
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedPhotoTypes, setExpandedPhotoTypes] = useState<Set<string>>(new Set());
  
  // New state for compliance report
  const [activeTab, setActiveTab] = useState<'photos' | 'compliance'>('photos');
  const [complianceData, setComplianceData] = useState<ComplianceReport[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [compliancePeriod, setCompliancePeriod] = useState(30);
  const [expandedCompliance, setExpandedCompliance] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar esta área');
      logout();
      return;
    }

    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'compliance') {
      loadComplianceData();
    }
  }, [activeTab, compliancePeriod]);

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

  const loadComplianceData = async () => {
    try {
      setComplianceLoading(true);
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/api/analytics/missing-photos`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days_back: compliancePeriod },
      });

      setComplianceData(response.data.report);
    } catch (error) {
      console.error('Error loading compliance data:', error);
      Alert.alert('Erro', 'Não foi possível carregar o relatório de conformidade');
    } finally {
      setComplianceLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'photos') {
      await loadData();
    } else {
      await loadComplianceData();
    }
    setRefreshing(false);
  };

  const toggleComplianceExpansion = (employeeId: string) => {
    const newExpanded = new Set(expandedCompliance);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedCompliance(newExpanded);
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

  const toggleDateExpansion = (dateKey: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedDates(newExpanded);
  };

  const toggleEmployeeExpansion = (employeeKey: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeKey)) {
      newExpanded.delete(employeeKey);
    } else {
      newExpanded.add(employeeKey);
    }
    setExpandedEmployees(newExpanded);
  };

  const togglePhotoTypeExpansion = (photoTypeKey: string) => {
    const newExpanded = new Set(expandedPhotoTypes);
    if (newExpanded.has(photoTypeKey)) {
      newExpanded.delete(photoTypeKey);
    } else {
      newExpanded.add(photoTypeKey);
    }
    setExpandedPhotoTypes(newExpanded);
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
          {activeTab === 'photos' && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="filter" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photos' && styles.activeTab]}
          onPress={() => setActiveTab('photos')}
        >
          <Ionicons 
            name="images" 
            size={20} 
            color={activeTab === 'photos' ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'photos' && styles.activeTabText
          ]}>
            Fotos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'compliance' && styles.activeTab]}
          onPress={() => setActiveTab('compliance')}
        >
          <Ionicons 
            name="analytics" 
            size={20} 
            color={activeTab === 'compliance' ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'compliance' && styles.activeTabText
          ]}>
            Conformidade
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && activeTab === 'photos' && (
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
        {activeTab === 'photos' ? (
          <>
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

            // Group by employee within date
            const employeeGroups: { [key: string]: Photo[] } = {};
            datePhotos.forEach((photo) => {
              const employeeKey = photo.employee_id;
              if (!employeeGroups[employeeKey]) {
                employeeGroups[employeeKey] = [];
              }
              employeeGroups[employeeKey].push(photo);
            });

            // Sort employees by name
            const sortedEmployees = Object.keys(employeeGroups).sort((a, b) => {
              const nameA = employeeGroups[a][0].employee_name;
              const nameB = employeeGroups[b][0].employee_name;
              return nameA.localeCompare(nameB);
            });

            const isExpanded = expandedDates.has(dateKey);

            return (
              <View key={dateKey} style={styles.dateSection}>
                <TouchableOpacity 
                  style={styles.dateSectionHeader}
                  onPress={() => toggleDateExpansion(dateKey)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.dateSectionTitle}>{formattedDate}</Text>
                  <View style={styles.dateCountBadge}>
                    <Text style={styles.dateCountText}>{datePhotos.length}</Text>
                  </View>
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>

                {/* Employee Groups - Only show if expanded */}
                {isExpanded && sortedEmployees.map((employeeId) => {
                  const employeePhotos = employeeGroups[employeeId];
                  const employeeName = employeePhotos[0].employee_name;
                  
                  // Group by photo type within employee
                  const lacrePhotos = employeePhotos.filter(p => p.photo_type === 'lacre');
                  const medidorPhotos = employeePhotos.filter(p => p.photo_type === 'medidor');

                  const employeeKey = `${dateKey}-${employeeId}`;
                  const isEmployeeExpanded = expandedEmployees.has(employeeKey);

                  return (
                    <View key={employeeId} style={styles.employeeSection}>
                      <TouchableOpacity 
                        style={styles.employeeSectionHeader}
                        onPress={() => toggleEmployeeExpansion(employeeKey)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person" size={18} color="#9C27B0" />
                        <Text style={styles.employeeSectionTitle}>{employeeName}</Text>
                        <View style={[styles.employeeCountBadge, { backgroundColor: '#9C27B0' }]}>
                          <Text style={styles.employeeCountText}>{employeePhotos.length}</Text>
                        </View>
                        <Ionicons 
                          name={isEmployeeExpanded ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color="#9C27B0" 
                        />
                      </TouchableOpacity>

                      {/* Lacre Photos - Only show if employee is expanded */}
                      {isEmployeeExpanded && lacrePhotos.length > 0 && (() => {
                        const lacreKey = `${employeeKey}-lacre`;
                        const isLacreExpanded = expandedPhotoTypes.has(lacreKey);

                        return (
                          <View style={styles.typeSection}>
                            <TouchableOpacity 
                              style={styles.typeSectionHeader}
                              onPress={() => togglePhotoTypeExpansion(lacreKey)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="lock-closed" size={16} color="#FF6B6B" />
                              <Text style={styles.typeSectionTitle}>Lacres</Text>
                              <View style={[styles.typeCountBadge, { backgroundColor: '#FF6B6B' }]}>
                                <Text style={styles.typeCountText}>{lacrePhotos.length}</Text>
                              </View>
                              <Ionicons 
                                name={isLacreExpanded ? "chevron-up" : "chevron-down"} 
                                size={18} 
                                color="#FF6B6B" 
                              />
                            </TouchableOpacity>

                            {isLacreExpanded && lacrePhotos.map((photo) => (
                            <TouchableOpacity
                              key={photo.id}
                              style={styles.photoCard}
                              onPress={() => openPhotoDetails(photo)}
                            >
                              <Image source={{ uri: photo.image_base64 }} style={styles.thumbnail} />
                              <View style={styles.photoInfo}>
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
                      })()}

                      {/* Medidor Photos - Only show if employee is expanded */}
                      {isEmployeeExpanded && medidorPhotos.length > 0 && (() => {
                        const medidorKey = `${employeeKey}-medidor`;
                        const isMedidorExpanded = expandedPhotoTypes.has(medidorKey);

                        return (
                          <View style={styles.typeSection}>
                            <TouchableOpacity 
                              style={styles.typeSectionHeader}
                              onPress={() => togglePhotoTypeExpansion(medidorKey)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="speedometer" size={16} color="#4ECDC4" />
                              <Text style={styles.typeSectionTitle}>Medidor</Text>
                              <View style={[styles.typeCountBadge, { backgroundColor: '#4ECDC4' }]}>
                                <Text style={styles.typeCountText}>{medidorPhotos.length}</Text>
                              </View>
                              <Ionicons 
                                name={isMedidorExpanded ? "chevron-up" : "chevron-down"} 
                                size={18} 
                                color="#4ECDC4" 
                              />
                            </TouchableOpacity>

                            {isMedidorExpanded && medidorPhotos.map((photo) => (
                            <TouchableOpacity
                              key={photo.id}
                              style={styles.photoCard}
                              onPress={() => openPhotoDetails(photo)}
                            >
                              <Image source={{ uri: photo.image_base64 }} style={styles.thumbnail} />
                              <View style={styles.photoInfo}>
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
                      })()}
                    </View>
                  );
                })}
              </View>
            );
          });
        })()}
          </>
        ) : (
          // Compliance Report Content
          <>
            <View style={styles.complianceHeader}>
              <Text style={styles.complianceTitle}>Relatório de Conformidade</Text>
              <Text style={styles.complianceSubtitle}>Últimos {compliancePeriod} dias</Text>
              
              {/* Period Selector */}
              <View style={styles.periodSelector}>
                <TouchableOpacity
                  style={[styles.periodButton, compliancePeriod === 7 && styles.periodButtonActive]}
                  onPress={() => setCompliancePeriod(7)}
                >
                  <Text style={[styles.periodButtonText, compliancePeriod === 7 && styles.periodButtonTextActive]}>
                    7 dias
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, compliancePeriod === 30 && styles.periodButtonActive]}
                  onPress={() => setCompliancePeriod(30)}
                >
                  <Text style={[styles.periodButtonText, compliancePeriod === 30 && styles.periodButtonTextActive]}>
                    30 dias
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, compliancePeriod === 90 && styles.periodButtonActive]}
                  onPress={() => setCompliancePeriod(90)}
                >
                  <Text style={[styles.periodButtonText, compliancePeriod === 90 && styles.periodButtonTextActive]}>
                    90 dias
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {complianceLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Carregando relatório...</Text>
              </View>
            ) : (
              complianceData.map((employee) => {
                const isExpanded = expandedCompliance.has(employee.employee_id);
                const getComplianceColor = (compliance: number) => {
                  if (compliance >= 90) return '#4CAF50';
                  if (compliance >= 70) return '#FF9800';
                  return '#F44336';
                };

                return (
                  <View key={employee.employee_id} style={styles.complianceCard}>
                    <TouchableOpacity
                      style={styles.complianceCardHeader}
                      onPress={() => toggleComplianceExpansion(employee.employee_id)}
                    >
                      <View style={styles.complianceEmployeeInfo}>
                        <Text style={styles.complianceEmployeeName}>{employee.employee_name}</Text>
                        <View style={styles.complianceStats}>
                          <View style={[styles.complianceBadge, { backgroundColor: getComplianceColor(employee.overall_compliance) }]}>
                            <Text style={styles.complianceBadgeText}>{employee.overall_compliance}%</Text>
                          </View>
                          <Text style={styles.complianceMissing}>
                            {employee.total_missing} foto{employee.total_missing !== 1 ? 's' : ''} perdida{employee.total_missing !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.complianceDetails}>
                        {/* Lacres Section */}
                        <View style={styles.complianceSection}>
                          <View style={styles.complianceSectionHeader}>
                            <Ionicons name="lock-closed" size={16} color="#FF6B6B" />
                            <Text style={styles.complianceSectionTitle}>Lacres</Text>
                            <View style={[styles.complianceBadge, { backgroundColor: getComplianceColor(employee.lacre_compliance) }]}>
                              <Text style={styles.complianceBadgeText}>{employee.lacre_compliance}%</Text>
                            </View>
                          </View>
                          {employee.missing_lacres.length > 0 ? (
                            <View style={styles.missingList}>
                              {employee.missing_lacres.slice(0, 5).map((missing, index) => (
                                <Text key={index} style={styles.missingItem}>
                                  • {missing.date_formatted} ({missing.weekday})
                                </Text>
                              ))}
                              {employee.missing_lacres.length > 5 && (
                                <Text style={styles.moreItems}>
                                  +{employee.missing_lacres.length - 5} mais...
                                </Text>
                              )}
                            </View>
                          ) : (
                            <Text style={styles.noMissing}>✅ Todas as fotos em dia</Text>
                          )}
                        </View>

                        {/* Medidor Section */}
                        <View style={styles.complianceSection}>
                          <View style={styles.complianceSectionHeader}>
                            <Ionicons name="speedometer" size={16} color="#4ECDC4" />
                            <Text style={styles.complianceSectionTitle}>Medidor</Text>
                            <View style={[styles.complianceBadge, { backgroundColor: getComplianceColor(employee.medidor_compliance) }]}>
                              <Text style={styles.complianceBadgeText}>{employee.medidor_compliance}%</Text>
                            </View>
                          </View>
                          {employee.missing_medidor.length > 0 ? (
                            <View style={styles.missingList}>
                              {employee.missing_medidor.slice(0, 5).map((missing, index) => (
                                <Text key={index} style={styles.missingItem}>
                                  • {missing.date_formatted} - {missing.period} ({missing.weekday})
                                </Text>
                              ))}
                              {employee.missing_medidor.length > 5 && (
                                <Text style={styles.moreItems}>
                                  +{employee.missing_medidor.length - 5} mais...
                                </Text>
                              )}
                            </View>
                          ) : (
                            <Text style={styles.noMissing}>✅ Todas as fotos em dia</Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
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
  dateSection: {
    marginBottom: 24,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  dateSectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dateCountBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 30,
    alignItems: 'center',
  },
  dateCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  typeSection: {
    marginBottom: 16,
    marginLeft: 8,
  },
  typeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
    borderLeftWidth: 3,
  },
  typeSectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  typeCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  typeCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  employeeSection: {
    marginBottom: 16,
    marginLeft: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  employeeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  employeeSectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  employeeCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  employeeCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
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
