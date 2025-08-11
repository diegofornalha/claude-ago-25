# 💬 Aula 3: Enviando Mensagens

## 🎯 O Que Vamos Aprender Hoje

Recapitulando nossa jornada:
1. ✅ Conhecemos o agente (Agent Card)
2. ✅ Criamos uma tarefa (task_id: task-123-abc)
3. ❓ Mas o agente precisa saber: "Qual seu nome?"

Hoje vamos aprender a **enviar mensagens** - conversar com o agente!

### Objetivos da Aula
- ✅ Entender estrutura de mensagens
- ✅ Aprender sobre "role" (papel)
- ✅ Enviar nossa primeira mensagem
- ✅ Entender "parts" de uma mensagem

---

## 🔄 Conectando com Aulas Anteriores

### Nossa História Até Agora

```
Aula 1: "Oi agente, quem é você?"
        "Sou AgenteSaudacao!"
        
Aula 2: "Crie uma tarefa de saudação"
        "Tarefa criada! ID: task-123-abc"
        
Aula 3: "Meu nome é Maria"  ← HOJE!
        [Agente processa...]
```

### A Necessidade

O agente quer fazer uma saudação personalizada, mas precisa saber seu nome!

---

## 💡 Conceito: Mensagem

### O Que É Uma Mensagem?

Uma **Mensagem** no A2A é como:
- 💬 **WhatsApp** - Texto que você envia
- 📧 **Email** - Com remetente e conteúdo
- 🗨️ **Conversa** - Parte de um diálogo
- 📝 **Formulário** - Informações estruturadas

### Analogia Principal: WhatsApp

```
WhatsApp:
- Quem enviou: Você (foto de perfil)
- O que enviou: "Meu nome é Maria"
- Quando: 10:30
- Para quem: Contato específico

A2A Protocol:
- Role: "user" (você)
- Content: "Meu nome é Maria"
- Timestamp: "2025-01-11T10:30:00Z"
- Task_id: "task-123-abc"
```

---

## 📖 Anatomia de Uma Mensagem

### Estrutura Completa

```json
{
  "jsonrpc": "2.0",
  "method": "send_message",
  "params": {
    "task_id": "task-123-abc",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "content": "Meu nome é Maria"
        }
      ],
      "timestamp": "2025-01-11T10:30:00Z"
    }
  },
  "id": "req-002"
}
```

### Explicação Detalhada

#### 1. Método
```json
"method": "send_message"
```
- **O que é**: Ação de enviar mensagem
- **Analogia**: Apertar "Enviar" no WhatsApp

#### 2. Para Qual Tarefa?
```json
"task_id": "task-123-abc"
```
- **O que é**: ID da tarefa (da Aula 2!)
- **Analogia**: Número da conversa/chat
- **Importante**: Liga mensagem à tarefa certa

#### 3. Quem Está Falando?
```json
"role": "user"
```
- **O que é**: Identifica o remetente
- **Opções**:
  - `"user"`: Você (humano)
  - `"agent"`: O agente de IA
  - `"system"`: Sistema (raro)
- **Analogia**: Nome em cima da mensagem no WhatsApp

#### 4. O Conteúdo
```json
"parts": [
  {
    "type": "text",
    "content": "Meu nome é Maria"
  }
]
```
- **O que é**: O que você está dizendo
- **Por que "parts"?**: Mensagem pode ter várias partes
- **Analogia**: Como enviar texto + foto + áudio

#### 5. Quando Foi Enviado
```json
"timestamp": "2025-01-11T10:30:00Z"
```
- **O que é**: Data e hora do envio
- **Formato**: Padrão internacional
- **Analogia**: Horário embaixo da mensagem

---

## 🎭 Conceito Importante: Role (Papel)

### Os Três Papéis

#### 1. User (Usuário) - VOCÊ
```json
"role": "user"
```
- Quem: Pessoa usando o sistema
- Quando usa: Sempre que VOCÊ envia
- Cor mental: 🔵 Azul

#### 2. Agent (Agente) - IA
```json
"role": "agent"
```
- Quem: O agente de IA
- Quando usa: Quando agente responde
- Cor mental: 🟢 Verde

#### 3. System (Sistema) - RARO
```json
"role": "system"
```
- Quem: O próprio sistema
- Quando usa: Avisos, erros
- Cor mental: 🟡 Amarelo

### Visualização

```
USER: "Meu nome é Maria" 🔵
AGENT: "Olá Maria!" 🟢
SYSTEM: "Tarefa concluída" 🟡
```

---

## 🧩 Por Que "Parts"?

### Mensagem Pode Ter Várias Partes

Como no WhatsApp, você pode enviar:
- Texto
- Imagem
- Arquivo
- Tudo junto!

### Exemplo Simples (Só Texto)
```json
"parts": [
  {
    "type": "text",
    "content": "Meu nome é Maria"
  }
]
```

### Exemplo Futuro (Texto + Imagem)
```json
"parts": [
  {
    "type": "text",
    "content": "Esta é minha foto"
  },
  {
    "type": "image",
    "url": "foto.jpg"
  }
]
```

Por enquanto, usaremos apenas texto!

---

## 🎮 Prática: Enviando Nossa Mensagem

### Cenário

1. Temos task_id: `"task-123-abc"`
2. Agente espera nosso nome
3. Vamos enviar: "Meu nome é [Seu Nome]"

### Passo a Passo

#### Passo 1: Identificar a Tarefa
```json
"task_id": "task-123-abc"
```
"Para qual conversa estou enviando"

#### Passo 2: Criar a Mensagem
```json
"message": {
  "role": "user",
  "parts": [{
    "type": "text",
    "content": "Meu nome é Maria"
  }]
}
```
"Eu (user) estou dizendo meu nome"

#### Passo 3: Enviar
```
POST /api/v1/tasks/task-123-abc/messages
```
"Enviar para o endereço de mensagens daquela tarefa"

---

## 💻 Exercício Prático

### Vamos Fazer Juntos!

1. **Abra o simulador**
2. **Complete Aulas 1 e 2** (Agent Card + Criar Tarefa)
3. **Clique em "Enviar Mensagem"**
4. **Digite seu nome** quando pedido
5. **Observe**:
   - O JSON sendo montado
   - Seu nome no content
   - O role como "user"

### Experimente Variações

Mude o conteúdo para:
- "Meu nome é João"
- "Me chamo Ana"
- "Sou o Pedro"

Observe: O agente entenderá todas!

---

## 🎯 Atividades Práticas

### Atividade 1: Mensagem Formal

```json
{
  "role": "user",
  "parts": [{
    "type": "text",
    "content": "Meu nome é Dr. Silva"
  }]
}
```

### Atividade 2: Mensagem Completa

```json
{
  "role": "user",
  "parts": [{
    "type": "text",
    "content": "Olá! Meu nome é Maria Santos e estou muito feliz em testar o A2A!"
  }]
}
```

### Atividade 3: Imagine o Agente Respondendo

Se o agente respondesse, seria:
```json
{
  "role": "agent",  // Mudou!
  "parts": [{
    "type": "text",
    "content": "Olá Maria! Bem-vinda!"
  }]
}
```

---

## 📊 Comparando com Apps Conhecidos

### WhatsApp vs A2A

| WhatsApp | A2A Protocol |
|----------|--------------|
| Contato: João | task_id: task-123 |
| "Você:" | role: "user" |
| Texto da mensagem | content: "..." |
| 10:30 ✓✓ | timestamp: "..." |
| Mensagem enviada | POST /messages |

### Email vs A2A

| Email | A2A Protocol |
|-------|--------------|
| De: você@email | role: "user" |
| Para: agente@ia | task_id: "..." |
| Assunto: Saudação | (está na tarefa) |
| Corpo: "Meu nome..." | content: "..." |

---

## 🤔 Perguntas Frequentes

### P: Posso enviar várias mensagens seguidas?
**R**: Sim! Como numa conversa normal.

### P: O agente sempre responde?
**R**: Geralmente sim, mas depende da tarefa.

### P: E se eu errar o task_id?
**R**: Erro! Como enviar mensagem para número errado.

### P: Posso editar mensagem depois de enviar?
**R**: Não, como no WhatsApp sem o "editar".

### P: O timestamp é obrigatório?
**R**: Geralmente o sistema adiciona automaticamente.

---

## 🏆 Teste Seu Conhecimento

### Quiz

1. **Qual "role" você usa ao enviar mensagem?**
   - a) agent
   - b) ✅ user
   - c) system

2. **Para que serve o task_id na mensagem?**
   - a) Decoração
   - b) ✅ Identificar para qual tarefa é a mensagem
   - c) Senha

3. **O que vai em "content"?**
   - a) Endereço
   - b) ✅ O texto da mensagem
   - c) Nome do agente

4. **Por que usamos "parts"?**
   - a) ✅ Mensagem pode ter múltiplas partes
   - b) É bonito
   - c) Obrigatório

---

## 🎯 Tarefa de Casa

### Para Praticar

1. **Escreva 5 mensagens diferentes**
   ```json
   "Meu nome é..."
   "Me chamo..."
   "Sou o/a..."
   "Pode me chamar de..."
   "..."
   ```

2. **Identifique os roles**
   - Quando você fala: ___
   - Quando agente fala: ___
   - Quando sistema avisa: ___

3. **Desenhe o fluxo**
   ```
   User → Mensagem → Agente
   ```

---

## ➡️ Próxima Aula

### O Grand Finale!

Enviamos a mensagem ✅
Agora vamos ver... **a resposta do agente!**

**Aula 4**: [Recebendo Respostas →](../aula-4-respostas/)

Na próxima aula:
- Como o agente responde
- Resposta personalizada
- Ciclo completo Hello World
- Celebração! 🎉

---

## 📝 Resumo da Aula

### Em Uma Frase
> "Enviar mensagem é como WhatsApp: quem fala (role), o quê (content), quando (timestamp)"

### O Que Aprendemos
1. **Mensagem** tem estrutura clara
2. **Role** identifica quem fala
3. **Parts** permite conteúdo flexível
4. **Task_id** conecta à conversa certa

### Nosso Progresso
```
✅ Aula 1: Conhecer agente
✅ Aula 2: Criar tarefa
✅ Aula 3: Enviar mensagem
⏭️ Aula 4: Receber resposta
```

---

## 💬 Glossário da Aula

| Termo | Significado Simples |
|-------|-------------------|
| **Message** | Mensagem enviada |
| **Role** | Quem está falando |
| **User** | Você (pessoa) |
| **Agent** | IA |
| **Parts** | Partes da mensagem |
| **Content** | Conteúdo/texto |
| **Timestamp** | Hora do envio |

---

## 🎨 Visualização Final

```
     VOCÊ                    AGENTE
      |                        |
      |    "Meu nome é Maria"  |
      |----------------------->|
      |     [role: user]       |
      |     [task: task-123]   |
      |                        |
      |     [Processando...]   |
      |                        |
```

---

*🎓 Fim da Aula 3*
*⏱️ Duração: 1 hora*
*📚 Próxima: Recebendo Respostas*
*💡 Quase lá! Falta só a resposta!*