# 📝 Aula 2: Criando Tarefas

## 🎯 O Que Vamos Aprender Hoje

Na aula passada, conhecemos o agente (Agent Card). Agora imagine:

Você entra em uma padaria. Já sabe o que eles vendem. Qual o próximo passo?
**Fazer um pedido!**

Hoje vamos aprender a **criar tarefas** - que é como fazer pedidos para um agente!

### Objetivos da Aula
- ✅ Entender o que é uma Tarefa (Task)
- ✅ Aprender a criar uma tarefa
- ✅ Conhecer o famoso task_id
- ✅ Entender estados de tarefas

---

## 🤔 Revisão Rápida

### O Que Aprendemos Antes
1. **Agent Card** nos disse que o agente sabe fazer `greet` (saudar)
2. Agora queremos que ele **faça uma saudação**
3. Para isso, criamos uma **tarefa**!

### Conexão
```
Aula 1: "Oi, o que você sabe fazer?"
        ↓
        "Sei fazer saudações!"
        ↓
Aula 2: "Ok, então faça uma saudação para mim!"
```

---

## 💡 Conceito: Tarefa (Task)

### O Que É Uma Tarefa?

Uma **Tarefa** é como:
- 📋 **Pedido em restaurante** - "Quero um café"
- 📦 **Encomenda online** - Tem número de rastreamento
- 🎫 **Ticket de atendimento** - Senha para acompanhar
- 📝 **Ordem de serviço** - Pedido formal de trabalho

### Analogia Principal: Pedido no iFood

```
Você no iFood:
1. Escolhe o restaurante (Agente)
2. FAZ O PEDIDO (Cria Tarefa)
3. Recebe número do pedido (task_id)
4. Acompanha status: preparando, saiu para entrega, entregue

A2A Protocol:
1. Escolhe o agente
2. CRIA TAREFA
3. Recebe task_id
4. Acompanha status: created, running, completed
```

---

## 📖 Anatomia de Uma Tarefa

### Estrutura de Criação

Vamos ver como pedimos uma tarefa:

```json
{
  "jsonrpc": "2.0",
  "method": "create_task",
  "params": {
    "skill": "greet",
    "parameters": {
      "language": "pt-BR",
      "style": "friendly"
    }
  },
  "id": "req-001"
}
```

### Explicação Parte por Parte

#### 1. Protocolo
```json
"jsonrpc": "2.0"
```
- **O que é**: Versão da "linguagem" que estamos usando
- **Analogia**: Como dizer "estou falando em português"
- **Sempre igual**: Sempre será "2.0" por enquanto

#### 2. Método (Ação)
```json
"method": "create_task"
```
- **O que é**: O que queremos fazer
- **Analogia**: "QUERO FAZER UM PEDIDO"
- **Neste caso**: Criar uma nova tarefa

#### 3. Skill Escolhida
```json
"skill": "greet"
```
- **O que é**: Qual habilidade do agente usar
- **Analogia**: Escolher item do menu
- **Lembra?**: Vimos no Agent Card que ele tem skill "greet"

#### 4. Parâmetros (Detalhes)
```json
"parameters": {
  "language": "pt-BR",
  "style": "friendly"
}
```
- **O que é**: Detalhes de como fazer
- **Analogia**: "Café com pouco açúcar, bem quente"
- **Nosso caso**:
  - Idioma: Português do Brasil
  - Estilo: Amigável

#### 5. ID da Requisição
```json
"id": "req-001"
```
- **O que é**: Identificador do nosso pedido
- **Analogia**: Número da sua comanda
- **Importante**: Para conectar pergunta e resposta

---

## 🎫 O Famoso task_id

### O Que É?

Quando criamos uma tarefa, recebemos:

```json
{
  "task_id": "task-123-abc",
  "status": "created",
  "message": "Tarefa criada com sucesso!"
}
```

### Por Que task_id É Importante?

**task_id** é como:
- 📦 **Código de rastreamento** dos Correios
- 🎫 **Número do protocolo** de atendimento
- 🍕 **Número do pedido** no iFood
- 🏪 **Senha** do banco

### Para Que Serve?

Com o task_id você pode:
1. **Enviar mensagens** para essa tarefa específica
2. **Verificar o status** (está pronto?)
3. **Receber a resposta** quando terminar
4. **Cancelar** se necessário

---

## 📊 Estados de Uma Tarefa

### Ciclo de Vida

Uma tarefa passa por estados, como um pedido:

```
created → running → completed
   ↓         ↓          ↓
(criado) (fazendo)  (pronto)
```

### Estados Explicados

#### 1. Created (Criado)
- **O que é**: Tarefa foi criada mas não começou
- **Analogia**: Pedido recebido pelo restaurante
- **Duração**: Poucos segundos

#### 2. Running (Executando)
- **O que é**: Agente está trabalhando na tarefa
- **Analogia**: Cozinheiro preparando seu prato
- **Duração**: Depende da complexidade

#### 3. Completed (Completo)
- **O que é**: Tarefa finalizada com sucesso!
- **Analogia**: Pedido pronto para entrega
- **O que fazer**: Pegar o resultado

#### 4. Failed (Falhou) - Opcional
- **O que é**: Algo deu errado
- **Analogia**: Acabou o ingrediente
- **O que fazer**: Tentar de novo ou mudar pedido

---

## 🎮 Prática: Criando Nossa Primeira Tarefa

### Passo a Passo

#### Passo 1: Preparar o Pedido
```json
{
  "method": "create_task",
  "params": {
    "skill": "greet"
  }
}
```
"Quero criar uma tarefa de saudação"

#### Passo 2: Enviar
```
POST /api/v1/tasks
```
"Enviar para o endereço de tarefas"

#### Passo 3: Receber Confirmação
```json
{
  "task_id": "task-123-abc",
  "status": "created"
}
```
"Tarefa criada! Número: task-123-abc"

---

## 💻 Exercício Prático

### Vamos Fazer Juntos!

1. **Abra o simulador**
2. **Revise o Agent Card** (Aula 1)
3. **Clique em "Criar Tarefa"**
4. **Observe**:
   - O JSON sendo enviado
   - O task_id retornado
   - O status "created"

### Experimente Variações

Tente mudar:
- `style`: de "friendly" para "formal"
- `language`: de "pt-BR" para "en"

Observe: O task_id sempre muda!

---

## 🎯 Atividade: Criando Diferentes Tarefas

### Exercício 1: Tarefa Formal

Modifique para criar uma saudação formal:

```json
{
  "method": "create_task",
  "params": {
    "skill": "greet",
    "parameters": {
      "style": "formal",
      "language": "pt-BR"
    }
  }
}
```

### Exercício 2: Tarefa em Inglês

Crie uma saudação em inglês:

```json
{
  "method": "create_task",
  "params": {
    "skill": "greet",
    "parameters": {
      "style": "friendly",
      "language": "en"
    }
  }
}
```

### Exercício 3: Invente Sua Tarefa

Se o agente soubesse fazer pizza, como seria?

```json
{
  "method": "create_task",
  "params": {
    "skill": "make_pizza",
    "parameters": {
      "size": "large",
      "flavor": "margherita"
    }
  }
}
```

---

## 📊 Comparando com o Mundo Real

### iFood vs A2A

| iFood | A2A Protocol |
|-------|--------------|
| Escolher restaurante | Escolher agente |
| Fazer pedido | Criar tarefa |
| Número do pedido | task_id |
| "Preparando" | status: "running" |
| "Saiu para entrega" | status: "completed" |
| Pedido #12345 | task-123-abc |

### Por Que Isso Importa?

- **Rastreabilidade**: Sempre sabe onde está sua tarefa
- **Organização**: Múltiplas tarefas não se misturam
- **Confiança**: Pode verificar o progresso
- **Controle**: Pode cancelar se precisar

---

## 🤔 Perguntas Frequentes

### P: Posso criar várias tarefas ao mesmo tempo?
**R**: Sim! Cada uma terá seu próprio task_id.

### P: O task_id é sempre o mesmo?
**R**: Não! Cada tarefa nova tem um ID único, como CPF.

### P: E se eu perder o task_id?
**R**: Como perder o número do pedido - complica acompanhar!

### P: Quanto tempo uma tarefa demora?
**R**: Depende da complexidade. Saudação é rápida (segundos).

### P: Posso cancelar uma tarefa?
**R**: Sim, usando o task_id (veremos em aulas avançadas).

---

## 🏆 Teste Seu Conhecimento

### Quiz

1. **Para que serve o task_id?**
   - a) Decoração
   - b) ✅ Identificar e rastrear a tarefa
   - c) Senha do WiFi

2. **Qual o primeiro estado de uma tarefa?**
   - a) ✅ created
   - b) running
   - c) completed

3. **O que o campo "skill" indica?**
   - a) Nível de dificuldade
   - b) ✅ Qual habilidade do agente usar
   - c) Tempo de execução

4. **"parameters" serve para?**
   - a) ✅ Dar detalhes de como fazer
   - b) Calcular o preço
   - c) Definir a cor

---

## 🎯 Tarefa de Casa

### Para Praticar

1. **Crie 5 tarefas diferentes**
   - Varie os parâmetros
   - Anote os task_ids
   - Observe os status

2. **Desenhe o fluxo**
   - Cliente → Criar Tarefa → Agente
   - Agente → task_id → Cliente

3. **Invente parâmetros**
   - Se fosse tarefa de tradução?
   - Se fosse tarefa de cálculo?
   - Se fosse tarefa de busca?

---

## ➡️ Próxima Aula

### O Que Vem Por Aí

Temos o agente ✅
Criamos a tarefa ✅
Agora falta... **conversar com o agente!**

**Aula 3**: [Enviando Mensagens →](../aula-3-mensagens/)

Na próxima aula:
- Como enviar informações ao agente
- Estrutura de mensagens
- Papel de user vs agent
- Nossa primeira conversa!

---

## 📝 Resumo da Aula

### Em Uma Frase
> "Criar tarefa é como fazer um pedido com número de protocolo"

### O Que Aprendemos
1. **Tarefa** = Pedido de trabalho
2. **task_id** = Número único de rastreamento
3. **Estados** = created → running → completed
4. **Parâmetros** = Detalhes do pedido

### Fluxo Completo Até Agora
```
Aula 1: Descobrir Agente (Agent Card)
   ↓
Aula 2: Criar Tarefa (task_id)
   ↓
Aula 3: [Próxima] Enviar Mensagem
```

---

## 💬 Glossário da Aula

| Termo | Significado Simples |
|-------|-------------------|
| **Task** | Tarefa, pedido de trabalho |
| **task_id** | Número único da tarefa |
| **create_task** | Criar nova tarefa |
| **skill** | Habilidade a ser usada |
| **parameters** | Detalhes de como fazer |
| **status** | Situação atual da tarefa |
| **created** | Tarefa criada |
| **running** | Tarefa sendo executada |
| **completed** | Tarefa concluída |

---

## 🎨 Visualização

```
     VOCÊ                    AGENTE
      |                        |
      |  "Crie uma tarefa"     |
      |----------------------->|
      |                        |
      |  "task_id: task-123"   |
      |<-----------------------|
      |                        |
      ✓                        ✓
```

---

*🎓 Fim da Aula 2*
*⏱️ Duração: 1 hora*
*📚 Próxima: Enviando Mensagens*
*💡 Lembre-se: task_id é seu melhor amigo!*