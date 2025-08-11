# 🚀 Hello World A2A - Primeiro Exercício Prático

## 📌 O que vamos aprender?

Este é seu primeiro contato prático com o Protocolo A2A! Vamos criar um exemplo simples que demonstra os conceitos fundamentais:
- Como um agente se apresenta (Agent Card)
- Como criar uma tarefa
- Como trocar mensagens
- Como obter resultados

## 📁 Estrutura dos Arquivos

```
helloworld/
├── README.md                    # Este arquivo (instruções)
├── agent_card.json             # Cartão de apresentação do agente
├── create_task.json            # Requisição para criar tarefa
├── send_message.json           # Mensagem enviada ao agente
├── task_response.json          # Resposta do agente
├── simulador.html              # Interface web para testar
└── explicacao_detalhada.md     # Explicação linha por linha
```

## 🎯 Conceito: "Agente Saudação"

Vamos criar um agente simples que:
1. Se apresenta com seu Agent Card
2. Recebe uma tarefa de saudação
3. Responde com "Olá" personalizado
4. Completa a tarefa

## 📝 Passo a Passo

### Passo 1: Entender o Agent Card
O agente primeiro se apresenta dizendo suas capacidades.

### Passo 2: Criar uma Tarefa
Pedimos ao agente para executar uma saudação.

### Passo 3: Enviar Mensagem
Enviamos nosso nome para personalizar a saudação.

### Passo 4: Receber Resposta
O agente responde com saudação personalizada.

## 🎮 Como Usar

### Opção 1: Visualizar os JSONs
Abra cada arquivo `.json` para entender a estrutura das mensagens.

### Opção 2: Usar o Simulador
1. Abra `simulador.html` no navegador
2. Clique nos botões na ordem
3. Veja as mensagens sendo trocadas
4. Observe o resultado final

## 💡 Analogia para Entender

Imagine que você está em um hotel:

1. **Agent Card** = Recepcionista se apresenta: "Olá, sou João, posso fazer check-in, dar informações..."
2. **Create Task** = Você pede: "Preciso de uma saudação de boas-vindas"
3. **Send Message** = Você informa: "Meu nome é Maria"
4. **Response** = Recepcionista responde: "Olá Maria! Bem-vinda ao Hotel A2A!"

## 🔍 Observações Importantes

### Sem Código Complicado!
- Todos os arquivos são em JSON (formato de texto simples)
- O simulador HTML é apenas para visualização
- Foco está em entender o PROTOCOLO, não programação

### Conceitos A2A Demonstrados
- ✅ **Agent Card**: Agente se identifica
- ✅ **Task Creation**: Criar trabalho com ID único
- ✅ **Message Exchange**: Trocar informações
- ✅ **Task Completion**: Finalizar com sucesso

## 🎓 Para Discussão em Aula

1. O que aconteceria se o agente não tivesse a habilidade "greet"?
2. Como outro agente poderia descobrir este agente?
3. Que outras informações poderiam estar no Agent Card?
4. Como seria se dois agentes conversassem entre si?

## 🏆 Desafio Extra

Depois de entender este exemplo, tente:
1. Modificar a saudação no `send_message.json`
2. Adicionar uma nova habilidade no `agent_card.json`
3. Imaginar um agente de tradução no lugar de saudação

## ⚠️ Lembre-se

Este é um exemplo SIMPLIFICADO para aprendizado. O A2A real tem mais detalhes, mas os conceitos fundamentais são exatamente estes!

---

*📚 Exercício do Módulo 1 - Fundamentos*
*🎯 Objetivo: Primeiro contato prático com A2A*
*⏱️ Tempo estimado: 30 minutos*