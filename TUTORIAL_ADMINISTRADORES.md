# 👑 Tutorial Lacre Monitor - Para Administradores

## Guia Completo: Painel Administrativo

---

## 🔐 Acesso ao Painel Admin

### **Como Fazer Login**

1. **Abra o app** no Expo Go ou navegador
2. **Digite as credenciais de admin:**
   - **Usuário:** `admin`
   - **Senha:** `admin123`
3. **Toque em "Entrar"**
4. **Pronto!** Você está no painel administrativo

### **Mudar Senha do Admin (Recomendado)**

1. **Acesse** Gerenciar Usuários (👥)
2. **Encontre** o usuário "admin"
3. **Toque no ícone de chave** (🔑)
4. **Digite** a nova senha
5. **Confirme** e salve

---

## 📊 Tela Principal - Painel Admin

Após fazer login como admin, você verá **2 abas principais:**

### **Aba "Fotos" 📸**
- Visualizar todas as fotos enviadas
- Filtrar por data, funcionário e tipo
- Zoom nas fotos para ver detalhes

### **Aba "Conformidade" 📋**
- Relatório de fotos faltantes
- Ver quais funcionários não enviaram fotos
- Analisar períodos (7, 30 ou 90 dias)

---

## 📸 Gerenciar Fotos

### **Visualizar Fotos**

1. **Na aba "Fotos"**, você verá todas as fotos organizadas por:
   - **Data** (mais recentes primeiro)
   - **Funcionário** (nome do posto)
   - **Tipo** (Lacre, Medidor Manhã, Medidor Tarde)

2. **Para filtrar:**
   - Toque no ícone de **filtro** (🔍)
   - Escolha:
     - **Todos** os funcionários ou um específico
     - **Todos** os tipos ou um específico
     - **Período** de datas

3. **Para ver detalhes da foto:**
   - **Toque na foto** para ampliar
   - **Use pinch-to-zoom** para ver melhor
   - **Deslize** para ver outras fotos
   - **Veja informações:**
     - Funcionário
     - Data e hora
     - Tipo de foto
     - Local (para lacres)

### **Exportar Relatório de Fotos**

**Nota:** Recurso ainda não implementado. Em breve!

---

## 📋 Relatório de Conformidade

### **Como Usar**

1. **Vá na aba "Conformidade"**
2. **Selecione o período:**
   - **7 dias** - Última semana
   - **30 dias** - Último mês
   - **90 dias** - Últimos 3 meses

3. **Veja o relatório:**
   - **Lista de funcionários**
   - **Percentual de conformidade** (verde = bom, vermelho = ruim)
   - **Número de fotos faltantes**

4. **Expandir detalhes:**
   - **Toque no card** do funcionário
   - **Veja detalhes** de cada dia:
     - Dia da semana
     - Quais fotos faltaram
     - Status (✅ Enviado / ❌ Faltando)

### **Interpretar Cores**

- **Verde (80-100%)** ✅ Conformidade boa
- **Amarelo (50-79%)** ⚠️ Conformidade média
- **Vermelho (0-49%)** ❌ Conformidade baixa

---

## 👥 Gerenciar Usuários

### **Acessar Gerenciamento de Usuários**

1. **No painel admin**, toque no ícone **👥** (azul) no topo
2. **Você verá** lista de todos os funcionários

### **Criar Novo Funcionário**

1. **Toque no botão "+"** (verde, canto inferior direito)
2. **Preencha os dados:**
   - **Nome completo** (ex: "Posto Santa Cruz")
   - **Nome de usuário** (ex: "santa_cruz")
   - **Senha inicial** (ex: "123456")
   - **Tipo:** Funcionário (não admin)
   - **Fotos obrigatórias:**
     - **Lacres + Medidores** (padrão)
     - **Apenas Lacres**
     - **Apenas Medidores**

3. **Toque em "Salvar"**
4. **Pronto!** Funcionário criado

### **Editar Funcionário**

1. **Na lista**, toque no **ícone de lápis** (✏️)
2. **Modifique** os dados desejados:
   - Nome
   - Nome de usuário
   - Tipo de usuário (funcionário/admin)
   - Fotos obrigatórias
3. **Toque em "Salvar"**

**⚠️ Importante:** Para mudar senha, use o botão de chave (🔑)

### **Resetar Senha**

1. **Na lista**, toque no **ícone de chave** (🔑)
2. **Digite** a nova senha
3. **Confirme**
4. **Pronto!** Senha alterada

**⚠️ Avise o funcionário** sobre a nova senha!

### **Deletar Funcionário**

1. **Na lista**, toque no **ícone de lixeira** (🗑️)
2. **Confirme** a exclusão
3. **Pronto!** Usuário deletado

**⚠️ ATENÇÃO:** 
- Todas as fotos do funcionário serão deletadas
- Ação irreversível!

### **Configurar Fotos Obrigatórias**

**Ao criar ou editar funcionário**, você pode escolher:

**Opção 1: Lacres + Medidores** (Padrão)
- Funcionário precisa tirar TODOS os tipos de foto
- Lacres (seg/qua/sex)
- Medidores manhã e tarde (todos os dias)

**Opção 2: Apenas Lacres**
- Funcionário só tira fotos de lacres
- Não precisa tirar medidores
- Relatório de conformidade não conta medidores

**Opção 3: Apenas Medidores**
- Funcionário só tira fotos de medidores
- Não precisa tirar lacres
- Relatório de conformidade não conta lacres

**Quando usar:**
- Use quando um posto específico só tem lacres OU só tem medidores
- Ajuda a ter relatório mais preciso

---

## 🔑 Autorizações Temporárias

### **O Que São Autorizações?**

Permite que um funcionário tire fotos **fora do horário normal**.

**Exemplo:** Funcionário precisa tirar foto de lacre às 15h (fora do horário 06:00-12:00)

### **Como Dar Autorização**

1. **No painel admin**, toque no ícone **🔑** (laranja) no topo
2. **Você verá** lista de todos os funcionários
3. **Encontre o funcionário** desejado
4. **Escolha o tipo de foto:**
   - **Lacres**
   - **Medidor Manhã**
   - **Medidor Tarde**
5. **Toque no botão** correspondente
6. **Defina a duração:**
   - Digite quantas horas (padrão: 24 horas)
   - Exemplo: "24" = autorizado por 1 dia
7. **Toque em "Autorizar"**
8. **Pronto!** Funcionário pode tirar foto

### **Ver Autorizações Ativas**

- **Badge verde ✓** = Funcionário tem autorização ativa
- **Data de expiração** mostrada abaixo do botão
- **Exemplo:** "Expira em 15/06 às 14:00"

### **Revogar Autorização**

1. **Na tela de autorizações**
2. **Toque em "Revogar"** no botão com autorização ativa
3. **Confirme**
4. **Pronto!** Autorização cancelada

### **Dicas de Uso**

- ✅ Use para situações excepcionais
- ✅ Defina duração adequada (não deixe muito tempo)
- ✅ Revogue quando não for mais necessário
- ⚠️ Funcionário precisa fazer logout/login para ativar

---

## 📧 Configurar Alertas por Email

### **O Que São Alertas?**

Você recebe um email automático quando um funcionário específico envia uma foto.

**Exemplo:** Receber email toda vez que "Posto Laranjal" enviar foto de lacre.

### **Como Configurar**

1. **No painel admin**, toque no ícone **🔔** (vermelho) no topo
2. **Configure até 3 emails diferentes:**

### **Para Cada Email:**

**A) Digite o Email**
- Campo: "Endereço de Email"
- Exemplo: `gerente@empresa.com`

**B) Ative os Alertas**
- Toggle: **Alertas por Email**
- Ative para receber alertas

**C) Escolha Funcionários e Tipos de Foto**

Para cada funcionário, você pode:

**Opção 1: Todas as Fotos**
- Toque em **"Todas as Fotos"**
- Receberá alerta para QUALQUER foto deste funcionário

**Opção 2: Tipos Específicos**
- Marque apenas os tipos desejados:
  - ☐ Lacres
  - ☐ Medidor Manhã
  - ☐ Medidor Tarde

**D) Salve as Configurações**
- Toque em **"Salvar"** no topo direito

### **Exemplo de Configuração**

**Email 1: gerente@empresa.com**
- ✅ Funcionário: Posto Laranjal → Todas as Fotos
- ✅ Funcionário: Posto Fagundão → Apenas Lacres

**Email 2: supervisor@empresa.com**
- ✅ Funcionário: Posto Gloria → Apenas Medidores
- ✅ Funcionário: Posto Sul → Todas as Fotos

**Email 3:** (vazio - não usado)

### **Como Funciona o Email**

**Quando ativado:**
1. Funcionário tira e envia foto
2. Sistema verifica configuração de alertas
3. Se houver alerta configurado, envia email automaticamente
4. Email chega em segundos

**Conteúdo do Email:**
```
📸 Nova Foto Enviada - Posto Laranjal

👤 Funcionário: Posto Laranjal
📷 Tipo de Foto: Lacre
🕐 Data/Hora: 15/06/2024 às 10:30

Este é um alerta automático do Sistema Lacre Monitor.
```

### **Dicas de Uso**

- ✅ Use para monitorar postos críticos
- ✅ Configure emails diferentes para gerentes diferentes
- ✅ Teste enviando uma foto e verificando o email
- ⚠️ Máximo de 100 emails/dia (limite SendGrid grátis)

---

## 🚨 Situações Comuns

### **Funcionário Esqueceu a Senha**

**Solução:**
1. Vá em **Gerenciar Usuários** (👥)
2. Encontre o funcionário
3. Toque no **ícone de chave** (🔑)
4. **Defina nova senha** (ex: "123456")
5. **Avise o funcionário** da nova senha

---

### **Funcionário Não Consegue Tirar Foto**

**Verifique:**
1. **Horário correto?**
   - Lacre: Seg/Qua/Sex, 06:00-12:00
   - Medidor manhã: Todos os dias, 06:00-09:00
   - Medidor tarde: Todos os dias, 17:00-18:00

2. **Precisa autorização?**
   - Se fora do horário, dê autorização temporária
   - Funcionário precisa fazer logout/login após autorização

3. **Tipo de foto está configurado?**
   - Vá em **Gerenciar Usuários**
   - Veja "Fotos Obrigatórias"
   - Se funcionário está em "Apenas Lacres", não verá medidores

---

### **Relatório Mostra Fotos Faltando Incorretamente**

**Verifique:**
1. **Configuração do funcionário:**
   - Se está em "Apenas Lacres", não deve contar medidores
   - Se está em "Apenas Medidores", não deve contar lacres

2. **Período selecionado:**
   - 7 dias = última semana
   - 30 dias = último mês
   - Fotos antigas não aparecem

3. **Tipo de conta:**
   - Usuário "teste" não aparece em relatórios

---

### **Email de Alerta Não Está Chegando**

**Verifique:**
1. **Email está correto?**
   - Sem erros de digitação
   - Formato válido (tem @)

2. **Alertas estão ativados?**
   - Toggle deve estar verde

3. **Funcionário e tipo de foto configurados?**
   - Verifique se marcou o funcionário correto
   - Verifique se marcou o tipo de foto correto

4. **Caixa de SPAM:**
   - Verifique pasta de spam/lixo eletrônico
   - Adicione remetente aos contatos

5. **Limite de 100 emails/dia:**
   - Se passar de 100 emails/dia, pode não enviar

---

### **Preciso Adicionar Novo Posto**

**Solução:**
1. Vá em **Gerenciar Usuários** (👥)
2. Toque no **botão "+"** (verde)
3. **Preencha:**
   - Nome: "Posto [Nome]"
   - Usuário: nome_simples (ex: "novo_posto")
   - Senha: senha inicial (ex: "123456")
   - Tipo: Funcionário
   - Fotos: Lacres + Medidores (ou conforme necessário)
4. **Salve**
5. **Passe as credenciais** para o responsável do posto

---

## 📊 Monitoramento Diário

### **Rotina Recomendada**

**Toda Manhã:**
1. ✅ Verificar relatório de conformidade (últimos 7 dias)
2. ✅ Ver quais funcionários não enviaram fotos ontem
3. ✅ Entrar em contato com funcionários faltantes

**Toda Tarde:**
1. ✅ Verificar se fotos da manhã foram enviadas
2. ✅ Dar autorizações se necessário

**Toda Semana:**
1. ✅ Revisar relatório de 30 dias
2. ✅ Identificar padrões de não conformidade
3. ✅ Tomar ações corretivas

---

## 🔒 Segurança

### **Boas Práticas**

1. ✅ **Mude a senha padrão** do admin
2. ✅ **Use senha forte** (letras, números, símbolos)
3. ✅ **Não compartilhe** credenciais de admin
4. ✅ **Faça logout** após usar
5. ✅ **Revise usuários** periodicamente
6. ✅ **Delete usuários** inativos
7. ✅ **Monitore** fotos suspeitas

### **Criar Outro Admin (Se Necessário)**

1. Vá em **Gerenciar Usuários**
2. **Crie novo usuário**
3. **Tipo:** Selecione "Admin"
4. **Salve**
5. **Teste** fazendo login com novo usuário

---

## 📱 Acesso pelo Computador

**Você pode usar o painel admin pelo navegador:**

1. **Abra o navegador** (Chrome, Edge, Firefox)
2. **Digite:** `https://meter-check.preview.emergentagent.com`
3. **Faça login** com credenciais de admin
4. **Use normalmente**

**Vantagens:**
- ✅ Tela maior para visualizar fotos
- ✅ Mais fácil para digitar
- ✅ Melhor para relatórios

---

## 🆘 Contato Técnico

**Em caso de problemas técnicos graves:**

1. **Anote o erro** exato que aparece
2. **Tire print** da tela (se possível)
3. **Anote:**
   - O que você estava fazendo
   - Horário do erro
   - Usuário que estava usando

---

## 📝 Resumo Rápido

### **Funções Principais do Admin:**

1. 📸 **Ver todas as fotos** enviadas
2. 📋 **Gerar relatórios** de conformidade
3. 👥 **Gerenciar funcionários** (criar, editar, deletar)
4. 🔑 **Dar autorizações** temporárias
5. 📧 **Configurar alertas** por email
6. 🔐 **Resetar senhas** de funcionários

---

## ✅ Checklist Diário do Administrador

**Manhã:**
- [ ] Verificar relatório de conformidade
- [ ] Ver fotos de ontem
- [ ] Contatar funcionários faltantes

**Tarde:**
- [ ] Verificar fotos da manhã
- [ ] Dar autorizações se necessário

**Semanal:**
- [ ] Revisar relatório de 30 dias
- [ ] Verificar se há usuários inativos
- [ ] Testar sistema de alertas

---

**Sistema desenvolvido para facilitar o controle e monitoramento** ✨

**Qualquer dúvida técnica, consulte este guia novamente!** 🚀
