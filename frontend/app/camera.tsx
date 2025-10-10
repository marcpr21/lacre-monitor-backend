import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import axios from 'axios';
import { getAuthToken } from './store/authStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Camera() {
  const { type } = useLocalSearchParams<{ type: 'lacre' | 'medidor' }>();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<any>(null);

  // Show web limitation message
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webNoticeContainer}>
          <Ionicons name="phone-portrait-outline" size={80} color="#007AFF" />
          <Text style={styles.webNoticeTitle}>Câmera Disponível Apenas no Mobile</Text>
          <Text style={styles.webNoticeText}>
            Para tirar fotos, acesse o aplicativo através do Expo Go no seu celular.
          </Text>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
    if (!locationPermission?.granted) {
      requestLocationPermission();
    }
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#666" />
          <Text style={styles.permissionText}>Permissão de câmera necessária</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Conceder Permissão</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      console.log('📸 Taking photo...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: false,
      });

      console.log('✅ Photo captured:', {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        base64Length: photo.base64 ? photo.base64.length : 0
      });

      if (!photo.base64 || photo.base64.length === 0) {
        console.error('❌ No base64 data in photo');
        Alert.alert('Erro', 'Imagem capturada está vazia');
        return;
      }

      const imageData = `data:image/jpeg;base64,${photo.base64}`;
      setCapturedPhoto(imageData);
      console.log('✅ Photo saved to state');
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto');
    }
  };

  const submitPhoto = async () => {
    if (!capturedPhoto) return;

    setUploading(true);

    try {
      // Get location
      let location = null;
      let locationName = 'Localização não disponível';

      if (locationPermission?.granted) {
        const loc = await Location.getCurrentPositionAsync({});
        location = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        // Get address
        try {
          const address = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });

          if (address[0]) {
            const addr = address[0];
            locationName = `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`;
          }
        } catch (e) {
          console.log('Error getting address:', e);
        }
      }

      const token = await getAuthToken();
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (!user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.replace('/login');
        return;
      }

      // Truncar imagem se muito grande (para evitar crash)
      let imageToSend = capturedPhoto;
      if (capturedPhoto.length > 2000000) { // 2MB
        // Reduzir qualidade da imagem
        const base64Data = capturedPhoto.replace(/^data:image\/[a-z]+;base64,/, '');
        const truncated = base64Data.substring(0, 1500000); // 1.5MB
        imageToSend = `data:image/jpeg;base64,${truncated}`;
      }

      await axios.post(
        `${API_URL}/api/photos/submit`,
        {
          employee_id: user.id,
          photo_type: type,
          image_base64: imageToSend,
          latitude: location?.latitude,
          longitude: location?.longitude,
          location_name: locationName,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000, // 30 segundos timeout
        }
      );

      Alert.alert('Sucesso!', 'Foto enviada com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error submitting photo:', error);
      Alert.alert(
        'Erro',
        error.response?.data?.detail || 'Não foi possível enviar a foto'
      );
    } finally {
      setUploading(false);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  const goBack = () => {
    router.back();
  };

  if (capturedPhoto) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>
              {type === 'lacre' ? 'Foto de Lacre' : 'Foto do Medidor'}
            </Text>
          </View>

          {capturedPhoto ? (
            <Image 
              source={{ uri: capturedPhoto }} 
              style={styles.previewImage}
              onLoad={() => console.log('✅ Image loaded successfully')}
              onError={(error) => console.log('❌ Image load error:', error)}
            />
          ) : (
            <View style={[styles.previewImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <Text>Erro: Imagem não capturada</Text>
            </View>
          )}

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.retakeButton]}
              onPress={retakePhoto}
              disabled={uploading}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Tirar Novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={submitPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>Enviar Foto</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.cameraOverlay}>
          <SafeAreaView style={styles.cameraHeader}>
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>
              {type === 'lacre' ? 'Foto de Lacre' : 'Foto do Medidor'}
            </Text>
            <View style={styles.placeholder} />
          </SafeAreaView>

          <View style={styles.cameraBottom}>
            <View style={styles.captureContainer}>
              <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  placeholder: {
    width: 44,
  },
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: '#666',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Web notice styles
  webNoticeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  webNoticeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  webNoticeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
