# 📸 Sistema de Monitoramento de Fotos

Sistema mobile para controle de fotos de lacres e medidores com validação de horários e localização GPS.

## 🎯 Funcionalidades

### Para Funcionários:
- ✅ Login individual com usuário e senha
- ✅ Captura de fotos **direto da câmera** (sem galeria)
- ✅ **Fotos de Lacre**: Segunda, Quarta e Sexta até 12:00
- ✅ **Fotos de Medidor**: Diariamente em 2 períodos
  - 🌅 **Manhã**: 06:00-09:00
  - 🌆 **Tarde**: 17:00-18:00
- ✅ Fotos temporárias (não salvam no celular)
- ✅ Notificações push automáticas nos horários
- ✅ Localização GPS automática em cada foto

### Para Administradores:
- ✅ Painel web/mobile para visualizar todas as fotos
- ✅ Filtros por funcionário, tipo de foto e data
- ✅ Informações completas: quem, quando, onde
- ✅ Gerenciamento de funcionários
- ✅ Limpeza automática após 15 dias

## 🚀 Como Usar

### Acesso ao App:

**URL do App**: https://monitorlacre.preview.emergentagent.com

**Usuários de Teste:**

**Administrador:**
- Usuário: `admin`
- Senha: `admin123`

**Funcionários:**
- Usuário: `joao` | Senha: `123456`
- Usuário: `maria` | Senha: `123456`
- Usuário: `pedro` | Senha: `123456`

### Fluxo do Funcionário:

1. **Login** - Entre com seu usuário e senha
2. **Tela Inicial** - Veja suas tarefas de hoje
   - 🔒 Lacre (Seg/Qua/Sex até 12h)
   - 🌅 Medidor Manhã (06:00-09:00)
   - 🌆 Medidor Tarde (17:00-18:00)
3. **Tirar Foto** - Clique no card disponível
4. **Captura** - Tire a foto com a câmera
5. **Confirmar** - Revise e envie
6. **Pronto!** - Foto enviada com localização

### Fluxo do Admin:

1. **Login** - Entre com credenciais de admin
2. **Painel** - Visualize todas as fotos
3. **Filtros** - Filtre por:
   - Tipo (Lacre/Medidor)
   - Funcionário
   - Período
4. **Detalhes** - Clique em qualquer foto para ver:
   - Imagem completa
   - Funcionário que tirou
   - Data e hora exata
   - Localização GPS
   - Endereço aproximado

## 📱 Horários Válidos

### Fotos de Lacre:
- **Dias**: Segunda, Quarta e Sexta
- **Horário**: Até 12:00 (meio-dia)
- **Frequência**: 1 foto por dia válido

### Fotos de Medidor:
- **Dias**: Todos os dias
- **Horários**: 
  - Manhã: 06:00 até 09:00
  - Tarde: 17:00 até 18:00
- **Frequência**: 2 fotos por dia (uma manhã, uma tarde)

## 🔔 Notificações

O app envia lembretes automáticos:

**Lacre:**
- Segunda, Quarta e Sexta às 10:00

**Medidor:**
- Todos os dias às 07:00 (lembrete manhã)
- Todos os dias às 17:00 (lembrete tarde)

## 🗄️ Armazenamento de Fotos

- ✅ Fotos enviadas para servidor
- ✅ Armazenadas em formato base64
- ✅ Com metadados (GPS, horário, funcionário)
- ✅ **Auto-limpeza**: Deletadas automaticamente após 15 dias
- ✅ Não ficam salvas no celular do funcionário

## 🛠️ Tecnologias

**Frontend:**
- React Native + Expo
- Expo Camera (captura)
- Expo Location (GPS)
- Expo Notifications (alertas)

**Backend:**
- FastAPI (Python)
- MongoDB (banco de dados)
- JWT (autenticação)
- bcrypt (segurança)

## 📋 API Endpoints

```
POST   /api/users/login          - Login
GET    /api/users/me             - Info do usuário
GET    /api/users/employees      - Lista funcionários (admin)
POST   /api/photos/submit        - Enviar foto
GET    /api/photos               - Listar fotos
GET    /api/photos/check-schedule - Verificar horário
POST   /api/photos/cleanup       - Limpar expiradas (admin)
```

## 🎨 Características do App

### Segurança:
- 🔐 Autenticação JWT
- 🔒 Senhas criptografadas (bcrypt)
- 🚫 Proteção por roles (admin/employee)
- ⏰ Validação de horários no servidor

### UX/UI:
- 📱 Design mobile-first
- 🎯 Interface intuitiva
- 🎨 Feedback visual claro
- ⚡ Rápido e responsivo
- 🌗 Cards coloridos por tipo

### Funcionalidades Mobile:
- 📸 Câmera nativa
- 📍 GPS integrado
- 🔔 Push notifications
- 💾 Armazenamento local (apenas token)
- 🔄 Pull to refresh

## 📝 Notas Importantes

1. **Permissões Necessárias:**
   - 📷 Câmera
   - 📍 Localização
   - 🔔 Notificações

2. **Validações:**
   - Horário verificado no servidor
   - Funcionário só pode tirar 1 foto por período
   - Admin vê todas, funcionário vê apenas suas fotos

3. **Offline:**
   - Fotos precisam de conexão para envio
   - Validação de horário funciona offline

## 🆘 Suporte

Em caso de problemas:

1. Verifique as permissões do app
2. Confirme que está no horário correto
3. Verifique sua conexão com internet
4. Tente fazer logout e login novamente
5. Entre em contato com o administrador

## 🔄 Atualizações Futuras (Possíveis)

- [ ] Modo offline com sincronização
- [ ] Relatórios em PDF
- [ ] Dashboard com estatísticas
- [ ] Histórico de fotos por funcionário
- [ ] Exportação de dados
- [ ] Múltiplos administradores
- [ ] Integração com sistemas externos

---

**Versão**: 1.0.0  
**Data**: 2025  
**Status**: ✅ Funcional
