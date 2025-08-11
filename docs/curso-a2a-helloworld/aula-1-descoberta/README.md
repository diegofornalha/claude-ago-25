# 📋 Aula 1: Descobrindo o Agente

## 🎯 O Que Vamos Aprender Hoje

Imagine que você está em uma festa e quer conhecer alguém novo. O que você faz primeiro? 
Você se aproxima e pergunta: **"Oi, quem é você?"**

Hoje vamos aprender a fazer exatamente isso com um agente de IA!

### Objetivos da Aula
- ✅ Entender o que é um Agent Card
- ✅ Aprender a "perguntar" quem é o agente
- ✅ Ler e interpretar as informações
- ✅ Fazer nossa primeira interação A2A

---

## 🤔 Começando: O Problema

### Situação
Você tem um agente de IA disponível, mas...
- Não sabe o nome dele
- Não sabe o que ele faz
- Não sabe como usá-lo

### Solução
**Agent Card** - O cartão de visita digital do agente!

---

## 💡 Conceito: Agent Card

### O Que É?

Um **Agent Card** é como um:
- 📇 **Cartão de visita** - Tem nome e contato
- 📋 **Currículo resumido** - Lista habilidades
- 🏪 **Placa de loja** - Diz o que oferece
- 👤 **Perfil de rede social** - Informações públicas

### Analogia do Dia-a-Dia

Imagine que você entra em uma loja nova:

```
VOCÊ: "Oi, o que vocês vendem aqui?"

LOJA: "Olá! Somos a Padaria Pão Quente
       Fazemos: pães, bolos, café
       Horário: 6h às 20h
       Especialidade: pão francês"
```

No mundo A2A:

```
VOCÊ: "Oi, quem é você?" (GET /.well-known/agent-card)

AGENTE: "Olá! Sou o AgenteSaudacao
         Faço: saudações, boas-vindas
         Idiomas: português, inglês, espanhol
         Especialidade: cumprimentos amigáveis"
```

---

## 📖 Entendendo o Agent Card

### Estrutura Básica

Vamos ver nosso Agent Card parte por parte:

```json
{
  "name": "AgenteSaudacao",
  "version": "1.0.0",
  "description": "Agente simples que cumprimenta pessoas",
  "skills": ["greet", "welcome"]
}
```

### Explicação Linha por Linha

#### 1. Nome do Agente
```json
"name": "AgenteSaudacao"
```
- **O que é**: Como o agente se chama
- **Analogia**: Nome da pessoa ou loja
- **Exemplo real**: "João", "Padaria Central", "AgenteSaudacao"

#### 2. Versão
```json
"version": "1.0.0"
```
- **O que é**: Qual versão do agente (como apps no celular)
- **Analogia**: WhatsApp versão 2.24, Windows 11
- **Por que importa**: Saber se está atualizado

#### 3. Descrição
```json
"description": "Agente simples que cumprimenta pessoas"
```
- **O que é**: Explicação do que o agente faz
- **Analogia**: Slogan da empresa
- **Exemplo**: "Fazemos você se sentir bem-vindo"

#### 4. Habilidades (Skills)
```json
"skills": ["greet", "welcome"]
```
- **O que é**: Lista do que o agente sabe fazer
- **Analogia**: Menu de restaurante, serviços de salão
- **Nosso agente sabe**:
  - `greet`: Cumprimentar
  - `welcome`: Dar boas-vindas

---

## 🎮 Prática: Descobrindo Nosso Agente

### Passo 1: Entender o Pedido

Quando queremos conhecer um agente, fazemos:

```
PEDIDO: "Me mostre seu cartão de visita"
TÉCNICO: GET /.well-known/agent-card
PORTUGUÊS: "Buscar no endereço padrão do cartão"
```

### Passo 2: Ver a Resposta

O agente responde com:

```json
{
  "name": "AgenteSaudacao",
  "version": "1.0.0",
  "description": "Agente simples que cumprimenta pessoas",
  "skills": ["greet", "welcome"],
  "endpoints": {
    "agent_card": "/.well-known/agent-card",
    "tasks": "/api/v1/tasks"
  },
  "capabilities": {
    "languages": ["pt-BR", "en", "es"],
    "max_concurrent_tasks": 5
  }
}
```

### Passo 3: Interpretar

Vamos "traduzir" para português:

> "Oi! Eu sou o **AgenteSaudacao**, versão **1.0.0**.
> Eu **cumprimento pessoas**.
> Sei fazer **saudações** e dar **boas-vindas**.
> Falo **português**, **inglês** e **espanhol**.
> Posso atender **5 pessoas ao mesmo tempo**."

---

## 🔍 Explorando Mais Detalhes

### Endpoints (Endereços)

```json
"endpoints": {
  "agent_card": "/.well-known/agent-card",
  "tasks": "/api/v1/tasks"
}
```

**Analogia**: Como endereços de uma empresa
- `agent_card`: "Recepção - Informações"
- `tasks`: "Atendimento - Fazer pedidos"

### Capacidades

```json
"capabilities": {
  "languages": ["pt-BR", "en", "es"],
  "max_concurrent_tasks": 5
}
```

**Analogia**: Como especificações técnicas
- `languages`: "Atendemos em 3 idiomas"
- `max_concurrent_tasks`: "5 caixas de atendimento"

---

## 💻 Exercício Prático

### Vamos Fazer Juntos!

1. **Abra o simulador** (arquivo HTML fornecido)
2. **Clique em "Descobrir Agente"**
3. **Observe o Agent Card aparecer**
4. **Leia cada campo**
5. **Anote as informações importantes**

### O Que Observar

- ✅ Nome do agente apareceu?
- ✅ Consegue ver as habilidades?
- ✅ Quantos idiomas ele fala?
- ✅ Qual a versão?

---

## 🎯 Atividade: Criando Seu Próprio Agent Card

### Exercício Criativo

Imagine que VOCÊ é um agente. Crie seu Agent Card:

```json
{
  "name": "Agente[SeuNome]",
  "version": "1.0.0",
  "description": "Agente que [o que você faz bem]",
  "skills": ["habilidade1", "habilidade2"],
  "capabilities": {
    "languages": ["pt-BR"],
    "speciality": "[sua especialidade]"
  }
}
```

### Exemplo Preenchido

```json
{
  "name": "AgenteMaria",
  "version": "1.0.0",
  "description": "Agente que ensina matemática",
  "skills": ["teach", "calculate", "explain"],
  "capabilities": {
    "languages": ["pt-BR", "en"],
    "speciality": "álgebra básica"
  }
}
```

---

## 📊 Revisão: O Que Aprendemos

### Conceitos Dominados
- ✅ **Agent Card** = Cartão de visita digital
- ✅ **Name** = Como o agente se chama
- ✅ **Skills** = O que ele sabe fazer
- ✅ **Capabilities** = Recursos técnicos

### Fluxo Aprendido
1. Cliente pergunta: "Quem é você?"
2. Agente responde com Agent Card
3. Cliente lê e entende capacidades
4. Pronto para interagir!

---

## 🤔 Perguntas Frequentes

### P: Todo agente tem Agent Card?
**R**: Sim! É a primeira coisa que um agente A2A deve ter.

### P: Posso confiar nas informações do Agent Card?
**R**: Sim, é como a "identidade oficial" do agente.

### P: E se o agente não tiver uma skill que preciso?
**R**: Você procura outro agente ou pede uma skill que ele tenha.

### P: O Agent Card pode mudar?
**R**: Sim, quando o agente é atualizado (nova versão).

---

## 🏆 Teste Seu Conhecimento

### Quiz Rápido

1. **O que é um Agent Card?**
   - a) Um cartão de crédito
   - b) ✅ Cartão de visita digital do agente
   - c) Um jogo de cartas

2. **Qual campo mostra o que o agente sabe fazer?**
   - a) name
   - b) version
   - c) ✅ skills

3. **Para que serve o campo "version"?**
   - a) ✅ Saber qual versão do agente
   - b) Contar quantos agentes existem
   - c) Mostrar a idade do agente

---

## 🎯 Tarefa de Casa

### Para Praticar

1. **Modifique o Agent Card**
   - Mude o nome do agente
   - Adicione uma nova skill
   - Mude a descrição

2. **Crie 3 Agent Cards diferentes**
   - Um agente tradutor
   - Um agente calculadora
   - Um agente de piadas

3. **Responda**
   - Qual a diferença entre skills e capabilities?
   - Por que o nome do agente é importante?
   - Como você usaria essa informação?

---

## ➡️ Próxima Aula

### O Que Vem Por Aí

Agora que sabemos **quem é o agente**, vamos aprender a **pedir algo para ele fazer**!

**Aula 2**: [Criando Tarefas →](../aula-2-tarefas/)

Na próxima aula:
- Como criar uma tarefa
- O que é um task_id
- Estados de uma tarefa
- Primeira tarefa real!

---

## 📝 Resumo da Aula

### Em Uma Frase
> "Agent Card é como perguntar 'Oi, quem é você?' para um agente de IA"

### Palavras-Chave
- Agent Card
- Skills (habilidades)
- Capabilities (capacidades)
- Descoberta

### Leve Para Casa
1. Todo agente tem identidade
2. Agent Card revela capacidades
3. É sempre o primeiro passo
4. Simples como cartão de visita

---

## 💬 Glossário da Aula

| Termo | Significado Simples |
|-------|-------------------|
| **Agent Card** | Cartão de visita do agente |
| **Skill** | Habilidade, o que sabe fazer |
| **Endpoint** | Endereço onde encontrar algo |
| **Capability** | Capacidade técnica |
| **GET** | Buscar/Pedir informação |

---

*🎓 Fim da Aula 1*
*⏱️ Duração: 1 hora*
*📚 Próxima: Criando Tarefas*
*💡 Lembre-se: Um passo de cada vez!*