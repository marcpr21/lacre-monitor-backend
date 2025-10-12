# Lacre Monitor - Sistema de Monitoramento de Fotos

Sistema completo de monitoramento de lacres e medidores com app mobile (Expo) e backend (FastAPI + MongoDB).

## 🚀 Funcionalidades

### ✅ Implementadas
- **Autenticação**: Login de funcionários e admin
- **Fotos com Horários**: Lacres (Seg/Qua/Sex 06:00-12:00) e Medidores (06:00-09:00 e 17:00-18:00)
- **Autorizações Temporárias**: Admin pode autorizar fotos fora do horário
- **Email Alerts**: 3 emails independentes com alertas configuráveis
- **Configuração por Usuário**: Escolher quais tipos de foto cada funcionário deve tirar
- **Relatório de Conformidade**: Análise de fotos faltantes
- **Gerenciamento de Usuários**: CRUD completo de funcionários

### 🏗️ Arquitetura
- **Frontend**: Expo (React Native) - Mobile App
- **Backend**: FastAPI (Python) - API REST
- **Banco de Dados**: MongoDB Atlas (Cloud)
- **Email**: SendGrid
- **Deploy Backend**: Railway (24h online)

---

## 📱 Como Gerar o APK Android

### Passo 1: Instale o EAS CLI
```bash
npm install -g eas-cli
```

### Passo 2: Faça login na Expo
```bash
eas login
```

### Passo 3: Entre na pasta do projeto
```bash
cd frontend
```

### Passo 4: Gere o APK
```bash
eas build --platform android --profile preview
```

### Passo 5: Aguarde e baixe
Aguarde 5-15 minutos e baixe o APK quando terminar

---

## 🔐 Variáveis de Ambiente

### Backend (.env)
```env
MONGO_URL=sua_connection_string_mongodb_atlas
DB_NAME=lacre_monitor
SENDGRID_API_KEY=sua_sendgrid_api_key
EMAIL_FROM=seu_email_verificado@exemplo.com
EMAIL_FROM_NAME=Sistema Lacre Monitor
JWT_SECRET=sua_chave_secreta_aleatoria
```

### Frontend (.env)
```env
EXPO_PUBLIC_BACKEND_URL=https://seu-backend.railway.app
```

---

## 👥 Usuários Padrão

- **Admin**: admin / admin123
- **Funcionários**: fagundao, laranjal, etc. / 123456
- **Teste**: teste / teste

---

## 📞 Suporte

Verifique o README completo para mais informações.
