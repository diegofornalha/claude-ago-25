# 🧠 Marvin Agent CLI - Interface de Comando

## ✅ Implementação Completa

O Marvin Agent agora possui uma interface CLI completa usando o framework `click`, com todos os comandos solicitados e funcionalidades extras.

## 🚀 Instalação e Uso

### Método 1: Script Executável
```bash
# Diretamente usando o script marvin
./marvin [comando] [opções]

# Exemplos:
./marvin serve              # Inicia o servidor
./marvin serve --daemon     # Inicia com auto-restart
./marvin status            # Verifica status
./marvin stop              # Para o servidor
```

### Método 2: Módulo Python
```bash
# Como módulo Python
python -m marvin [comando] [opções]

# Ou usando python3
python3 -m marvin serve
```

### Método 3: Scripts Simplificados
```bash
# Iniciar com daemon
./start_marvin.sh

# Parar
./stop_marvin.sh
```

## 📚 Comandos Disponíveis

### 1. **serve** - Inicia o servidor
```bash
./marvin serve [opções]

Opções:
  --port INTEGER     Porta para o servidor (padrão: 9998)
  --host TEXT        Host para o servidor (padrão: localhost)
  --daemon           Executar como daemon com auto-restart
  --help            Mostra ajuda

Exemplos:
  ./marvin serve                    # Servidor normal
  ./marvin serve --daemon           # Com auto-restart
  ./marvin serve --port 8080        # Porta customizada
```

### 2. **status** - Mostra o status
```bash
./marvin status

Saída:
  📊 Status do Sistema Marvin
  ✅ Daemon: Rodando (PID: 12345)
  ✅ Marvin: Rodando (PID: 12346)
     Porta: 9998
     URL: http://localhost:9998
```

### 3. **stop** - Para o servidor
```bash
./marvin stop

Ações:
  - Para o servidor Marvin
  - Para o daemon se estiver rodando
  - Limpa arquivos PID
```

### 4. **extract** - Extrai dados de texto
```bash
./marvin extract "texto" [opções]

Opções:
  --format [json|text|table]  Formato de saída (padrão: json)

Exemplos:
  ./marvin extract "João Silva, CEO da Tech Corp. Email: joao@tech.com"
  ./marvin extract "Diego: 11-98765-4321" --format text
  ./marvin extract "Contact: maria@example.com" --format table
```

### 5. **test** - Testa conectividade
```bash
./marvin test [opções]

Opções:
  --endpoint TEXT  Endpoint para testar (padrão: /.well-known/agent-card.json)

Exemplos:
  ./marvin test
  ./marvin test --endpoint /
```

### 6. **logs** - Mostra os logs
```bash
./marvin logs

Mostra:
  - Últimas 20 linhas do log do servidor
  - Últimas 10 linhas do log do daemon
```

### 7. **info** - Informações sobre o Marvin
```bash
./marvin info

Mostra:
  - Versão
  - Protocolo
  - Funcionalidades
  - Endpoints
  - Diretórios
  - Comandos úteis
```

## 🎯 Exemplos de Uso Real

### Extração de Dados Completa
```bash
# JSON (padrão)
./marvin extract "Diego Alcantara, CEO da coflow. Email: diego@coflow.com, Tel: 213456789"

# Saída formatada como texto
./marvin extract "João Silva, CTO. Contato: joao@empresa.com, (11) 98765-4321" --format text

# Saída em tabela
./marvin extract "Maria Santos - maria@example.com - Gerente de Projetos" --format table
```

### Servidor com Monitoramento
```bash
# Iniciar daemon que mantém servidor sempre ativo
./marvin serve --daemon

# Verificar se está rodando
./marvin status

# Ver logs em tempo real
./marvin logs

# Parar tudo
./marvin stop
```

### Teste de Integração
```bash
# Testar se servidor está respondendo
./marvin test

# Testar endpoint específico
./marvin test --endpoint /.well-known/agent-card.json
```

## 🔧 Funcionalidades Implementadas

### ✅ Recursos do CLI
- **Interface intuitiva** com click framework
- **Cores no terminal** para melhor visualização
- **Comandos completos** conforme solicitado
- **Help automático** para todos os comandos
- **Validação de parâmetros**
- **Tratamento de erros**

### ✅ Funcionalidades de Extração
- **Nomes** - Detecta nomes de pessoas
- **Emails** - Extrai endereços de email
- **Telefones** - Identifica números de telefone
- **Empresas** - Reconhece nomes de empresas
- **Cargos** - Detecta posições/cargos

### ✅ Formatos de Saída
- **JSON** - Estruturado para APIs
- **Texto** - Legível para humanos
- **Tabela** - Visualização organizada

### ✅ Sistema Daemon
- **Auto-restart** automático em falhas
- **Monitoramento** a cada 30 segundos
- **Logs detalhados** de todas operações
- **Shutdown graceful** com sinais

## 📁 Estrutura de Arquivos

```
marvin/
├── marvin                  # Script executável principal
├── __main__.py            # Entry point do módulo
├── src/
│   ├── __main__.py        # CLI com click
│   ├── agent.py           # Lógica do agente
│   ├── server.py          # Servidor A2A
│   ├── marvin_daemon.py  # Sistema daemon
│   └── agent_executor.py  # Executor de tarefas
├── scripts/
│   ├── start_marvin.sh   # Script de início
│   ├── stop_marvin.sh    # Script de parada
│   └── marvin_control.sh # Controle completo
├── logs/
│   ├── marvin.log        # Log do servidor
│   └── marvin_daemon.log # Log do daemon
└── CLI-MARVIN.md         # Esta documentação
```

## 🎨 Características Especiais

### Cores no Terminal
- 🟢 **Verde** - Sucesso
- 🔴 **Vermelho** - Erro
- 🟡 **Amarelo** - Aviso
- 🔵 **Azul** - Informação

### Auto-instalação de Dependências
Se o `click` não estiver instalado, o CLI instala automaticamente na primeira execução.

### Integração com Daemon
O comando `serve --daemon` integra automaticamente com o sistema de monitoramento para manter o servidor sempre ativo.

## 🚨 Troubleshooting

### Click não encontrado
```bash
# O CLI instala automaticamente, mas se necessário:
pip install click
```

### Permissão negada
```bash
# Tornar executável
chmod +x marvin
chmod +x start_marvin.sh
chmod +x stop_marvin.sh
```

### Porta em uso
```bash
# Usar porta diferente
./marvin serve --port 8080
```

---

**✅ CLI implementado com sucesso!** Todos os comandos solicitados estão funcionando:
- `serve` - Iniciar servidor ✅
- `status` - Ver status ✅
- `stop` - Parar servidor ✅
- `extract` - Extrair dados ✅
- `test` - Testar conexão ✅
- `logs` - Ver logs ✅
- `info` - Informações ✅

O Marvin Agent agora tem uma interface CLI completa e profissional com todas as funcionalidades do marvin-extrator integradas!