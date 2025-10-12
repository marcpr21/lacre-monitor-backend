# 📱 Guia Completo: Como Gerar o APK do Lacre Monitor

## ✅ Pré-requisitos

1. **Node.js** instalado (versão 18 ou superior)
   - Download: https://nodejs.org

2. **Git** instalado
   - Download: https://git-scm.com

3. **Conta Expo** (GRÁTIS)
   - Cadastre-se em: https://expo.dev

---

## 🚀 Passo a Passo COMPLETO

### Passo 1: Clone o Repositório

Abra o terminal/prompt e execute:

```bash
git clone https://github.com/marcpr21/lacre-monitor-backend.git
cd lacre-monitor-backend
```

---

### Passo 2: Instale o EAS CLI

```bash
npm install -g eas-cli
```

**Observação:** Se der erro de permissão no Mac/Linux, use: `sudo npm install -g eas-cli`

---

### Passo 3: Entre na Pasta do Frontend

```bash
cd frontend
```

---

### Passo 4: Instale as Dependências

```bash
npm install
```

**Aguarde** a instalação completar (pode demorar alguns minutos)

---

### Passo 5: Faça Login na Expo

```bash
eas login
```

**Digite:**
- Email da sua conta Expo
- Senha

---

### Passo 6: Configure o Projeto (Primeira Vez)

```bash
eas build:configure
```

- Quando perguntar sobre o bundle identifier, pode apertar ENTER (já está configurado)

---

### Passo 7: Gere o APK! 🎉

```bash
eas build --platform android --profile preview
```

**O que vai acontecer:**

1. Upload do código para Expo
2. Build do APK na nuvem (GRÁTIS)
3. Espera de 5-15 minutos
4. Link para download do APK

**Exemplo de saída:**
```
✔ Build complete!
Download: https://expo.dev/artifacts/eas/...
```

---

### Passo 8: Baixe e Instale

1. **Baixe o APK** do link fornecido
2. **Transfira** para o celular Android (WhatsApp, Drive, etc.)
3. **Instale** no celular
   - Se pedir "Instalar de fontes desconhecidas", **permita**
4. **Abra o app** e faça login!

---

## 🔄 Atualizar o App (Fazer Novo Build)

Quando fizer mudanças no código e quiser um novo APK:

```bash
cd frontend
eas build --platform android --profile preview
```

Vai gerar um novo APK com as atualizações.

---

## ⚙️ Configurações Importantes

### Backend URL (já está configurada)

O arquivo `frontend/.env` já está apontando para o Railway:

```env
EXPO_PUBLIC_BACKEND_URL=https://lacre-monitor-backend-production.up.railway.app
```

**Não precisa mudar nada!**

---

## 🐛 Problemas Comuns

### "eas: command not found"

**Solução:**
```bash
npm install -g eas-cli
```

---

### "You need to be logged in"

**Solução:**
```bash
eas login
```

---

### "Build failed"

**Possíveis causas:**

1. **Erro no código** - Verifique se o código está sem erros
2. **Dependências faltando** - Execute `npm install` novamente
3. **Conta Expo não verificada** - Confirme o email da conta Expo

**Ver logs detalhados:**
```bash
eas build:list
```

Clique no build que falhou para ver os logs completos.

---

### "Cannot find module..."

**Solução:**
```bash
cd frontend
rm -rf node_modules
npm install
```

---

## 💰 Custos

- **Build do APK**: **GRÁTIS** (primeiros builds)
- **Conta Expo**: **GRÁTIS**
- **Hospedagem do código**: **GRÁTIS** (GitHub)

**Observação:** Expo oferece builds gratuitos para testar. Para uso intensivo, pode ter custo, mas para desenvolvimento normal é grátis.

---

## 📊 Monitorar o Build

Enquanto o build está rodando, você pode:

1. **Ver progresso**: https://expo.dev/accounts/[seu-usuario]/projects/lacre-monitor/builds
2. **Fechar o terminal** (o build continua na nuvem)
3. **Receber notificação** quando completar (se configurar)

---

## 🎯 Resultado Final

Você terá um arquivo **`.apk`** de aproximadamente **50-80 MB** que:

- ✅ Funciona em qualquer Android 5.0+
- ✅ Conecta ao backend Railway (24h online)
- ✅ Não precisa de Expo Go
- ✅ Instala como app normal

---

## 📱 Distribuir para os Funcionários

### Opção 1: WhatsApp/Telegram
- Envie o arquivo .apk direto
- Eles instalam manualmente

### Opção 2: Google Drive
- Upload do .apk
- Compartilhe o link

### Opção 3: Link Direto
- O Expo gera um link de download
- Compartilhe esse link
- Eles baixam e instalam

---

## 🔄 Publicar na Play Store (Opcional)

Se quiser publicar oficialmente na Play Store:

**Custos:** $25 (uma vez)

**Passos:**
1. Crie uma conta Google Play Console
2. Configure o app
3. Execute:
```bash
eas build --platform android --profile production
```
4. Faça upload do arquivo gerado
5. Aguarde aprovação (1-3 dias)

---

## ✅ Checklist Final

Antes de distribuir o APK, teste:

- [ ] Login funciona
- [ ] Câmera abre
- [ ] Fotos são enviadas
- [ ] Admin consegue ver fotos
- [ ] Notificações funcionam
- [ ] Backend está online

---

## 🆘 Precisa de Ajuda?

Se tiver problemas:

1. **Veja os logs do build**: `eas build:list`
2. **Teste localmente primeiro**: `npx expo start`
3. **Verifique o backend**: https://lacre-monitor-backend-production.up.railway.app
4. **Documentação Expo**: https://docs.expo.dev

---

**Boa sorte! 🚀**

Qualquer dúvida, consulte este guia novamente.
