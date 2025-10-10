# 🔔 Sistema de Notificações - Informações Importantes

## 📱 Como Funciona

### Sistema Implementado:

**Notificações de Lacre** (Segunda, Quarta, Sexta):
- ⏰ **Frequência**: A cada **1 hora**
- 🕐 **Horários**: 8:00, 9:00, 10:00, 11:00, 12:00
- 📅 **Dias**: Apenas Segunda, Quarta e Sexta
- 💬 **Mensagem**: "🔒 Lembrete: Fotos de Lacre Pendentes"
- ⚠️ **Urgência**: Alta prioridade com vibração

**Notificações de Medidor**:
- ⏰ **Frequência**: A cada **15 minutos**
- 🕐 **Períodos**:
  - **Manhã**: 06:00, 06:15, 06:30, 06:45, 07:00, 07:15, 07:30, 07:45, 08:00, 08:15, 08:30, 08:45
  - **Tarde**: 17:00, 17:15, 17:30, 17:45
- 📅 **Dias**: Todos os dias
- 💬 **Mensagem**: "⚡ Lembrete: Foto do Medidor"
- ⚠️ **Urgência**: Máxima prioridade com vibração

## ⚠️ IMPORTANTE: Limitações do Expo Go

### O que NÃO funciona no Expo Go:
- ❌ Notificações Push completas
- ❌ Notificações na tela de bloqueio
- ❌ Notificações recorrentes confiáveis
- ❌ Badges de notificação
- ❌ Sons personalizados

### O que funciona PARCIALMENTE no Expo Go:
- ⚠️ Notificações locais (apenas quando o app está aberto)
- ⚠️ Lembretes básicos (instável)

## ✅ Solução: Build Nativo (APK/IPA)

Para as notificações funcionarem **COMPLETAMENTE**, você precisa:

### Opção 1: Build com EAS (Expo Application Services)

**Passos:**
1. Criar conta no Expo: https://expo.dev
2. Instalar EAS CLI: `npm install -g eas-cli`
3. Fazer login: `eas login`
4. Configurar projeto: `eas build:configure`
5. Build Android: `eas build --platform android`
6. Build iOS: `eas build --platform ios`

**Resultado:**
- **Android**: Arquivo APK para instalar direto
- **iOS**: Arquivo IPA para TestFlight ou App Store

### Opção 2: Build Local

**Para Android (APK):**
```bash
cd /app/frontend
expo prebuild
cd android
./gradlew assembleRelease
```

**Para iOS (requer Mac):**
```bash
cd /app/frontend
expo prebuild
cd ios
xcodebuild -workspace *.xcworkspace -scheme YourApp archive
```

## 🎯 Quando Fazer o Build?

**Agora (Expo Go):**
- ✅ Testar funcionalidades básicas
- ✅ Desenvolvimento e ajustes
- ✅ Validar interface e fluxos
- ⚠️ Notificações limitadas

**Depois (Build Nativo):**
- ✅ Distribuir para funcionários
- ✅ Notificações completas
- ✅ Performance otimizada
- ✅ Publicar nas lojas (Play Store / App Store)

## 📊 Comparação

| Recurso | Expo Go | Build Nativo |
|---------|---------|--------------|
| Câmera | ✅ | ✅ |
| GPS | ✅ | ✅ |
| Login | ✅ | ✅ |
| Envio de fotos | ✅ | ✅ |
| **Notificações** | ⚠️ Limitado | ✅ Completo |
| Tela de bloqueio | ❌ | ✅ |
| Sons | ❌ | ✅ |
| Vibração | ⚠️ | ✅ |
| Performance | 🔶 Médio | ✅ Alto |
| Instalação | Temporária | Permanente |

## 🔧 Configurações Necessárias (Build)

### Android (app.json):
```json
{
  "android": {
    "permissions": [
      "CAMERA",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "WAKE_LOCK"
    ],
    "useNextNotificationsApi": true
  }
}
```

### iOS (app.json):
```json
{
  "ios": {
    "infoPlist": {
      "NSCameraUsageDescription": "App precisa da câmera para tirar fotos",
      "NSLocationWhenInUseUsageDescription": "App precisa da localização para registrar onde as fotos foram tiradas"
    },
    "entitlements": {
      "aps-environment": "production"
    }
  }
}
```

## 🚀 Próximos Passos

1. **Agora**: Continue testando no Expo Go
2. **Validar**: Confirme que tudo está funcionando
3. **Decidir**: Escolha método de build (EAS ou Local)
4. **Build**: Gere o APK/IPA
5. **Distribuir**: Envie para funcionários instalarem
6. **Testar**: Valide notificações completas

## 📞 Suporte

**Para fazer o build, você vai precisar:**
- Conta no Expo (gratuita)
- Configurar certificados (iOS)
- Gerar keystore (Android)

**Quer que eu ajude com o build agora ou prefere testar mais?**

---

**Status Atual:**
- ✅ Código de notificações implementado
- ✅ Sistema inteligente (a cada 1h lacres, 15min medidor)
- ⚠️ Funcionamento parcial no Expo Go
- 🎯 Pronto para build nativo quando você quiser
