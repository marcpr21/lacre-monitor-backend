import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, getAuthToken } from './store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  required_photos?: string;
}

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'employee',
    required_photos: 'both',
  });
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar esta área');
      router.back();
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/api/users/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Erro', 'Não foi possível carregar os usuários');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'employee',
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
    });
    setShowModal(true);
  };

  const openPasswordModal = (userId: string) => {
    setSelectedUserId(userId);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.username) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (!editingUser && !formData.password) {
      Alert.alert('Erro', 'A senha é obrigatória para novos usuários');
      return;
    }

    setSubmitting(true);

    try {
      const token = await getAuthToken();

      if (editingUser) {
        // Update user
        await axios.put(
          `${API_URL}/api/users/${editingUser.id}`,
          {
            name: formData.name,
            username: formData.username,
            role: formData.role,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        Alert.alert('Sucesso', 'Usuário atualizado com sucesso!');
      } else {
        // Create user
        await axios.post(
          `${API_URL}/api/users/create`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        Alert.alert('Sucesso', 'Usuário criado com sucesso!');
      }

      setShowModal(false);
      await loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível salvar o usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSubmitting(true);

    try {
      const token = await getAuthToken();
      await axios.post(
        `${API_URL}/api/users/${selectedUserId}/reset-password`,
        { password: newPassword },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      setShowPasswordModal(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível alterar a senha');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja deletar o usuário "${user.name}"?\n\nTodas as fotos deste usuário também serão deletadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              await axios.delete(`${API_URL}/api/users/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Sucesso', 'Usuário deletado com sucesso!');
              await loadUsers();
            } catch (error: any) {
              console.error('Error deleting user:', error);
              Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível deletar o usuário');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
        <Text style={styles.headerTitle}>Gerenciar Usuários</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.statsText}>Total: {users.length} usuários</Text>

        {users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userIcon}>
              <Ionicons
                name={user.role === 'admin' ? 'shield-checkmark' : 'person'}
                size={24}
                color={user.role === 'admin' ? '#FF6B6B' : '#007AFF'}
              />
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userUsername}>@{user.username}</Text>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: user.role === 'admin' ? '#FF6B6B20' : '#007AFF20' },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: user.role === 'admin' ? '#FF6B6B' : '#007AFF' },
                  ]}
                >
                  {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                </Text>
              </View>
            </View>

            <View style={styles.userActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => openPasswordModal(user.id)}
              >
                <Ionicons name="key-outline" size={20} color="#FFA726" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(user)}>
                <Ionicons name="create-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              {user.id !== currentUser?.id && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteUser(user)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Create/Edit User Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Ex: João Silva"
            />

            <Text style={styles.label}>Nome de Usuário *</Text>
            <TextInput
              style={styles.input}
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              placeholder="Ex: joao"
              autoCapitalize="none"
            />

            {!editingUser && (
              <>
                <Text style={styles.label}>Senha *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                />
              </>
            )}

            <Text style={styles.label}>Tipo de Usuário *</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  formData.role === 'employee' && styles.roleOptionActive,
                ]}
                onPress={() => setFormData({ ...formData, role: 'employee' })}
              >
                <Ionicons
                  name="person"
                  size={20}
                  color={formData.role === 'employee' ? '#fff' : '#007AFF'}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    formData.role === 'employee' && styles.roleOptionTextActive,
                  ]}
                >
                  Funcionário
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleOption,
                  formData.role === 'admin' && styles.roleOptionActive,
                ]}
                onPress={() => setFormData({ ...formData, role: 'admin' })}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={formData.role === 'admin' ? '#fff' : '#007AFF'}
                />
                <Text
                  style={[
                    styles.roleOptionText,
                    formData.role === 'admin' && styles.roleOptionTextActive,
                  ]}
                >
                  Administrador
                </Text>
              </TouchableOpacity>
            </View>

            {formData.role === 'employee' && (
              <>
                <Text style={styles.label}>Fotos Obrigatórias *</Text>
                <View style={styles.photoSelector}>
                  <TouchableOpacity
                    style={[
                      styles.photoOption,
                      formData.required_photos === 'both' && styles.photoOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, required_photos: 'both' })}
                  >
                    <Ionicons
                      name="images"
                      size={20}
                      color={formData.required_photos === 'both' ? '#fff' : '#007AFF'}
                    />
                    <Text
                      style={[
                        styles.photoOptionText,
                        formData.required_photos === 'both' && styles.photoOptionTextActive,
                      ]}
                    >
                      Lacres + Medidores
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.photoOption,
                      formData.required_photos === 'lacre' && styles.photoOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, required_photos: 'lacre' })}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={formData.required_photos === 'lacre' ? '#fff' : '#FF6B6B'}
                    />
                    <Text
                      style={[
                        styles.photoOptionText,
                        formData.required_photos === 'lacre' && styles.photoOptionTextActive,
                      ]}
                    >
                      Apenas Lacres
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.photoOption,
                      formData.required_photos === 'medidor' && styles.photoOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, required_photos: 'medidor' })}
                  >
                    <Ionicons
                      name="speedometer"
                      size={20}
                      color={formData.required_photos === 'medidor' ? '#fff' : '#FFA726'}
                    />
                    <Text
                      style={[
                        styles.photoOptionText,
                        formData.required_photos === 'medidor' && styles.photoOptionTextActive,
                      ]}
                    >
                      Apenas Medidores
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {editingUser && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#007AFF" />
                <Text style={styles.infoText}>
                  Para alterar a senha, use o botão de chave na lista de usuários.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Redefinir Senha</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.label}>Nova Senha *</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleResetPassword}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Alterar Senha</Text>
              )}
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
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
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 8,
  },
  roleOptionActive: {
    backgroundColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  roleOptionTextActive: {
    color: '#fff',
  },
  photoSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  photoOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 8,
  },
  photoOptionActive: {
    backgroundColor: '#007AFF',
  },
  photoOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  photoOptionTextActive: {
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
