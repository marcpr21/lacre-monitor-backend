# 🖥️ Guia: Configurar Expo 24h no Seu PC

## Configuração Completa para Deixar o App Disponível Permanentemente

---

## 📋 Pré-requisitos

Você vai precisar:
- ✅ PC/Notebook com Windows (ou Mac/Linux)
- ✅ Internet estável
- ✅ Node.js instalado (você já tem)
- ✅ Repositório clonado do GitHub
- ✅ PC pode ficar ligado 24h (ou durante horário de trabalho)

---

## 🚀 PASSO 1: Preparar o Projeto

### **1.1: Abrir Prompt de Comando (CMD)**

1. Pressione **Windows + R**
2. Digite: `cmd`
3. Pressione Enter

### **1.2: Navegar até a Pasta do Projeto**

```bash
cd C:\Users\marcp\OneDrive\Documents\Nova pasta (2)\lacre-monitor-backend\frontend
```

**Ajuste o caminho** conforme onde você salvou o projeto!

### **1.3: Instalar Dependências**

```bash
npm install
```

Aguarde terminar (pode demorar 2-3 minutos)

---

## ⚙️ PASSO 2: Testar se Funciona

### **2.1: Iniciar o Expo Manualmente**

```bash
npx expo start --tunnel
```

### **2.2: Verificar se Está Funcionando**

1. Aguarde aparecer o QR code
2. Abra Expo Go no celular
3. Escaneie o QR code
4. Se o app abrir, está funcionando! ✅

### **2.3: Parar o Expo**

- Pressione **Ctrl + C** no CMD para parar

---

## 🔄 PASSO 3: Criar Script de Inicialização Automática

### **3.1: Criar Arquivo Batch**

1. Abra o **Bloco de Notas** (Notepad)
2. Cole este conteúdo:

```batch
@echo off
title Lacre Monitor - Expo Server
cd /d C:\Users\marcp\OneDrive\Documents\Nova pasta (2)\lacre-monitor-backend\frontend
echo.
echo ========================================
echo    LACRE MONITOR - EXPO SERVER
echo ========================================
echo.
echo Iniciando servidor Expo...
echo.
npx expo start --tunnel
pause
```

3. **Ajuste o caminho** na linha do `cd /d` para o caminho correto do seu projeto
4. Vá em **Arquivo** → **Salvar Como**
5. **Nome:** `IniciarLacreMonitor.bat`
6. **Tipo:** "Todos os arquivos"
7. **Local:** Desktop (área de trabalho)
8. Clique em **Salvar**

### **3.2: Testar o Script**

1. Vá no Desktop
2. **Dê duplo-clique** em `IniciarLacreMonitor.bat`
3. Uma janela preta vai abrir
4. Aguarde o Expo iniciar
5. Se funcionar, feche a janela

---

## 🚦 PASSO 4: Configurar para Iniciar com o Windows

### **Opção A: Adicionar à Pasta de Inicialização (Recomendado)**

**4.1: Abrir Pasta de Inicialização**

1. Pressione **Windows + R**
2. Digite: `shell:startup`
3. Pressione Enter
4. Uma pasta vai abrir

**4.2: Criar Atalho do Script**

1. Vá no Desktop
2. **Clique com botão direito** em `IniciarLacreMonitor.bat`
3. Clique em **Enviar para** → **Desktop (criar atalho)**
4. **Arraste o atalho** para a pasta de Inicialização que abriu
5. Pronto!

**Agora o Expo vai iniciar automaticamente quando o Windows ligar!**

---

### **Opção B: Criar Tarefa Agendada (Mais Avançado)**

**4.1: Abrir Agendador de Tarefas**

1. Pressione **Windows + R**
2. Digite: `taskschd.msc`
3. Pressione Enter

**4.2: Criar Nova Tarefa**

1. No menu direito, clique em **Criar Tarefa Básica**
2. **Nome:** "Lacre Monitor Expo"
3. **Descrição:** "Inicia servidor Expo automaticamente"
4. Clique em **Avançar**

**4.3: Configurar Gatilho**

1. Selecione: **Quando o computador iniciar**
2. Clique em **Avançar**

**4.4: Configurar Ação**

1. Selecione: **Iniciar um programa**
2. Clique em **Avançar**
3. **Programa/script:** Navegue e selecione `IniciarLacreMonitor.bat`
4. Clique em **Avançar**

**4.5: Finalizar**

1. Marque: **Abrir a caixa de diálogo Propriedades...**
2. Clique em **Concluir**

**4.6: Configurações Avançadas**

Na janela de Propriedades:

1. Aba **Geral:**
   - Marque: **Executar com privilégios mais altos**

2. Aba **Condições:**
   - Desmarque: **Iniciar a tarefa apenas se o computador estiver conectado...**

3. Aba **Configurações:**
   - Marque: **Se a tarefa falhar, reiniciar a cada:** 5 minutos
   - Marque: **Parar a tarefa se ela for executada por mais de:** Desmarque esta opção

4. Clique em **OK**

---

## 🌐 PASSO 5: Obter URL Permanente

### **5.1: Iniciar o Expo**

- Dê duplo-clique em `IniciarLacreMonitor.bat`
- Aguarde iniciar

### **5.2: Anotar a URL**

Quando o Expo iniciar, você verá algo como:

```
› Metro waiting on exp://192.168.1.100:8081
› Tunnel ready at: https://xxxxx.tunnel.expo.dev
```

**A URL importante é a do TUNNEL:**
```
https://xxxxx.tunnel.expo.dev
```

### **5.3: Distribuir para Funcionários**

**Essa é a URL que os funcionários vão usar!**

**Opção 1: Gerar QR Code**

1. Acesse: https://www.qr-code-generator.com
2. Cole a URL do tunnel
3. Gere o QR code
4. Imprima ou envie para os funcionários

**Opção 2: Enviar Link Direto**

- Envie a URL por WhatsApp/Email
- Funcionários abrem no celular
- Clicam para abrir no Expo Go

---

## ⚠️ IMPORTANTE: Configurações do PC

### **Evitar que o PC Durma**

**6.1: Ir em Configurações de Energia**

1. Pressione **Windows + I**
2. Vá em **Sistema** → **Energia e Bateria**
3. **Tela:** Configure para "Nunca" desligar
4. **Suspensão:** Configure para "Nunca"

**OU (Windows 10):**

1. Painel de Controle → Hardware e Sons → Opções de Energia
2. Clique em **Alterar configurações do plano**
3. **Desligar vídeo:** Nunca
4. **Suspender o computador:** Nunca

---

### **Manter Internet Ativa**

**6.2: Desabilitar Economia de Energia do Adaptador de Rede**

1. Pressione **Windows + X**
2. Clique em **Gerenciador de Dispositivos**
3. Expanda **Adaptadores de rede**
4. Clique com botão direito no adaptador de rede
5. Clique em **Propriedades**
6. Aba **Gerenciamento de Energia**
7. **Desmarque:** "Permitir que o computador desligue este dispositivo..."
8. Clique em **OK**

---

### **Desabilitar Windows Update Automático (Opcional)**

Para evitar que o PC reinicie sozinho:

1. Pressione **Windows + R**
2. Digite: `services.msc`
3. Procure: **Windows Update**
4. Clique duplo
5. **Tipo de inicialização:** Manual
6. Clique em **OK**

⚠️ **Lembre-se de fazer updates manualmente!**

---

## 🔍 PASSO 6: Monitorar e Manter

### **Verificar se Está Rodando**

**Método 1: Verificar Janela do CMD**

- A janela preta do Expo deve estar aberta
- Deve mostrar logs de requisições

**Método 2: Acessar Localmente**

1. Abra navegador
2. Acesse: `http://localhost:8081`
3. Deve aparecer página do Expo

**Método 3: Testar no Celular**

- Escaneie QR code ou use URL
- App deve abrir normalmente

---

### **Reiniciar se Necessário**

**Se o Expo parar:**

1. Feche a janela do CMD
2. Dê duplo-clique em `IniciarLacreMonitor.bat`
3. Aguarde reiniciar

**OU**

- Reinicie o computador (vai iniciar automaticamente)

---

## 📱 Como Funcionários Vão Usar

### **Primeira Vez:**

1. Baixar **Expo Go** da loja de apps
2. **Android:** Escanear QR code
3. **iPhone:** Abrir URL no Safari

### **Próximas Vezes:**

1. Abrir **Expo Go**
2. App vai aparecer em **"Recently opened"**
3. Tocar para abrir

---

## 🆘 Solução de Problemas

### **"Expo não inicia ao ligar o Windows"**

**Solução:**
1. Verifique se o atalho está na pasta Inicialização
2. Reinicie o PC e observe
3. Se não funcionar, use a Opção B (Tarefa Agendada)

---

### **"Funcionários não conseguem acessar"**

**Solução:**
1. Verifique se o PC está ligado
2. Verifique se a janela do Expo está aberta
3. Gere novo QR code (URL pode ter mudado)
4. Verifique internet do PC

---

### **"PC reiniciou e Expo não voltou"**

**Solução:**
1. Verifique se o script está na Inicialização
2. Dê duplo-clique manual em `IniciarLacreMonitor.bat`
3. Configure Tarefa Agendada (Opção B) para mais confiabilidade

---

### **"Expo travou / não responde"**

**Solução:**
1. Feche a janela do CMD
2. Abra Gerenciador de Tarefas (Ctrl + Shift + Esc)
3. Encerre processos "node.exe"
4. Reinicie com duplo-clique no script

---

## 📊 Checklist de Configuração

- [ ] Node.js instalado
- [ ] Projeto clonado e dependências instaladas
- [ ] Testado manualmente (npx expo start)
- [ ] Script .bat criado no Desktop
- [ ] Script testado e funciona
- [ ] Adicionado à Inicialização (Opção A ou B)
- [ ] Configurações de energia ajustadas
- [ ] URL do tunnel anotada
- [ ] QR code gerado
- [ ] Testado no celular
- [ ] Funcionários treinados

---

## 💡 Dicas Importantes

1. ✅ **Use cabo de rede** ao invés de WiFi (mais estável)
2. ✅ **Deixe PC em local ventilado**
3. ✅ **Use UPS/nobreak** se possível (evita desligar com queda de energia)
4. ✅ **Monitore temperatura** do PC
5. ✅ **Faça backup** do projeto regularmente
6. ✅ **Anote a URL** do tunnel em local seguro
7. ✅ **Teste com funcionários** antes de usar em produção

---

## 📈 Manutenção Semanal Recomendada

**Toda semana:**
- [ ] Verificar se Expo está rodando
- [ ] Verificar espaço em disco
- [ ] Verificar atualizações do Windows (fazer manualmente)
- [ ] Testar acesso pelo celular
- [ ] Verificar logs por erros

---

## 🎯 Resumo Rápido

1. ✅ Criar script .bat para iniciar Expo
2. ✅ Adicionar script à Inicialização do Windows
3. ✅ Configurar PC para não dormir
4. ✅ Anotar URL do tunnel
5. ✅ Distribuir QR code para funcionários
6. ✅ Monitorar regularmente

---

**Seu sistema agora roda 24h no seu PC! 🎉**

**Próxima página: Comandos úteis e troubleshooting avançado**
