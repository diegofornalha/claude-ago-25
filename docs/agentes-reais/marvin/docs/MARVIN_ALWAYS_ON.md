# Marvin Agent - Always Active System

✅ **Sistema configurado e funcionando!**

O Marvin Agent agora possui um sistema completo para mantê-lo sempre ativo com monitoramento automático, restart em caso de falha, e integração com o macOS.

## 🚀 Status Atual

- **Marvin Agent**: ✅ Rodando (PID 89325)
- **Porta 10030**: ✅ Ativa 
- **Daemon Monitor**: ✅ Rodando (PID 89321)
- **Auto-restart**: ✅ Ativo

## 📋 Comandos Disponíveis

### Controle Rápido
```bash
cd /Users/agents/Desktop/claude-20x/agents/marvin

# Verificar status
./marvin_control.sh status

# Iniciar daemon
./marvin_control.sh start

# Parar daemon
./marvin_control.sh stop

# Reiniciar daemon
./marvin_control.sh restart

# Ver logs em tempo real
./marvin_control.sh logs
```

### Controle Avançado
```bash
# Status detalhado
python3 marvin_daemon.py status

# Iniciar daemon manualmente
python3 marvin_daemon.py start

# Parar daemon
python3 marvin_daemon.py stop

# Reiniciar daemon
python3 marvin_daemon.py restart
```

### Integração com macOS (Opcional)
```bash
# Instalar como serviço do sistema (auto-start no login)
./install_service.sh install

# Remover serviço do sistema
./install_service.sh uninstall

# Controlar serviço
./install_service.sh start|stop|restart|status|logs
```

## 🔧 Componentes do Sistema

### 1. **marvin_daemon.py**
- Monitor principal que mantém o Marvin sempre ativo
- Verifica status a cada 30 segundos
- Reinicia automaticamente se o processo cair
- Logs detalhados de todas as operações

### 2. **marvin_control.sh** 
- Script de controle simples
- Comandos intuitivos (start/stop/restart/status/logs)
- Interface amigável

### 3. **install_service.sh**
- Integração com launchd do macOS
- Auto-start no login do usuário
- Controle via launchctl

### 4. **com.marvin.agent.plist**
- Arquivo de configuração do launchd
- Define comportamento do serviço
- Configurações de restart automático

## 📊 Monitoramento

O daemon monitora:
- **Processo**: Verifica se o Marvin está rodando
- **Porta 10030**: Confirma que o serviço está ativo
- **Restart automático**: Reinicia em caso de falha
- **Logs**: Registra todas as operações

### Logs Disponíveis
- `logs/marvin_daemon.log` - Log principal do daemon
- `logs/launchd_stdout.log` - Output do serviço (se usando launchd)
- `logs/launchd_stderr.log` - Erros do serviço (se usando launchd)

## 🌐 Acesso ao Marvin

- **URL**: http://localhost:10030
- **Tipo**: Servidor A2A (Agent-to-Agent)
- **Funcionalidade**: Extração de informações de contato

> **Nota**: O acesso direto pelo navegador mostra "Method Not Allowed" - isso é normal para servidores A2A. Use um cliente A2A para interagir.

## ⚡ Características

### ✅ **Funcionalidades Ativas**
- **Auto-restart**: Reinicia automaticamente se o processo cair
- **Monitoramento contínuo**: Verifica status a cada 30 segundos  
- **Logs detalhados**: Rastreamento completo de operações
- **Controle simples**: Scripts fáceis de usar
- **Integração macOS**: Suporte completo ao launchd
- **Ambiente isolado**: Usa venv da UI com dependências corretas

### 🔄 **Processo de Restart**
1. Detecta que o Marvin não está respondendo
2. Para qualquer processo existente (graceful)
3. Aguarda 2 segundos
4. Inicia novo processo
5. Verifica se iniciou corretamente
6. Continua monitoramento

### 🛡️ **Tolerância a Falhas**
- **Restart graceful**: SIGTERM seguido de SIGKILL se necessário
- **Timeout handling**: Aguarda processo terminar antes de forçar
- **Error recovery**: Continua funcionando mesmo com erros temporários
- **Process cleanup**: Remove arquivos PID órfãos

## 🚨 Resolução de Problemas

### Marvin não inicia
```bash
# Verificar logs
./marvin_control.sh logs

# Verificar dependências
ls -la /Users/agents/Desktop/claude-20x/ui/.venv/bin/python

# Testar manualmente
/Users/agents/Desktop/claude-20x/ui/.venv/bin/python server.py
```

### Daemon não responde
```bash
# Parar forcefully
pkill -f marvin_daemon.py

# Limpar arquivos PID
rm -f marvin.pid daemon.pid

# Reiniciar
./marvin_control.sh start
```

### Porta ocupada
```bash
# Ver quem está usando a porta
lsof -i :10030

# Matar processo específico
kill [PID]
```

---

**Sistema implementado com sucesso! O Marvin Agent agora está sempre ativo e sendo monitorado automaticamente.**