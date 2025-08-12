# Agente Extrator de Contatos Marvin (Exemplo A2A)

Este exemplo demonstra um agente usando o framework [Marvin](https://github.com/prefecthq/marvin) para extrair informações estruturadas de contato a partir de texto, integrado com o protocolo Agent2Agent (A2A).

## Visão Geral

O agente recebe texto, tenta extrair detalhes de contato (nome, email, telefone, etc.) em um formato estruturado usando Marvin. Ele gerencia o estado conversacional em múltiplos turnos para coletar informações necessárias (nome, email) antes de confirmar os dados extraídos. A resposta do agente inclui tanto um resumo/pergunta textual quanto os dados estruturados via A2A.

## Componentes Principais

-   **Marvin `ExtractorAgent` (`agent.py`)**: Lógica principal usando `marvin` para extração e gerenciamento de estado multi-turno via dicionário.
-   **A2A `AgentTaskManager` (`task_manager.py`)**: Integra o agente com o protocolo A2A, gerenciando estado de tarefas (incluindo streaming via SSE) e formatação de respostas.
-   **Servidor A2A (`__main__.py`)**: Hospeda o agente e o gerenciador de tarefas.

## Pré-requisitos

-   Python 3.12+
-   [uv](https://docs.astral.sh/uv/getting-started/installation/)
-   `OPENAI_API_KEY` (ou outras credenciais de provedor LLM suportadas por pydantic-ai)

## Configuração e Execução

1.  Navegue até o diretório do agente Marvin:
    ```bash
    cd /Users/agents/.claude/docs/agentes-reais/marvin
    ```

2.  Chave de API do provedor LLM:
    ```bash
    # ✅ Já configurado no arquivo .env
    # OPENAI_API_KEY é definido automaticamente
    ```

3.  Configure o ambiente Python:
    ```bash
    uv venv
    source .venv/bin/activate
    uv sync
    ```

4.  Execute o servidor do agente Marvin:
    ```bash
    # Host/porta padrão (localhost:9998)
    MARVIN_DATABASE_URL=sqlite+aiosqlite:///test.db MARVIN_LOG_LEVEL=DEBUG uv run .

    # Host/porta personalizado
    # uv run . --host 0.0.0.0 --port 8080
    ```

    Sem `MARVIN_DATABASE_URL` configurado, o histórico de conversação não será persistido por ID de sessão.

5.  Em um terminal separado, execute um cliente A2A (ex: CLI de exemplo):
    ```bash
    # Certifique-se de que o ambiente está ativo (source .venv/bin/activate)
    cd samples/python/hosts/cli
    uv run . --agent http://localhost:9998 # Use a URL/porta correta do agente
    ```

## Estrutura de Dados Extraídos

Os dados estruturados retornados no `DataPart` são definidos como:

```python
class ContactInfo(BaseModel):
    name: str = Field(description="Nome e sobrenome da pessoa")
    email: EmailStr
    phone: str = Field(description="número de telefone padronizado")
    organization: str | None = Field(None, description="organização se mencionada")
    role: str | None = Field(None, description="cargo ou função se mencionado")
```

com um validador para renderizar as coisas de forma elegante e possivelmente serializar coisas estranhas.

## Script de Controle Unificado

O Marvin inclui um script unificado de controle em `/scripts/start_marvin.sh` que suporta:

```bash
# Comandos disponíveis:
./scripts/start_marvin.sh start      # Inicia o agente
./scripts/start_marvin.sh stop       # Para o agente
./scripts/start_marvin.sh restart    # Reinicia o agente
./scripts/start_marvin.sh status     # Mostra status detalhado
./scripts/start_marvin.sh logs       # Mostra logs (adicione 'follow' para tempo real)
./scripts/start_marvin.sh install    # Instala como serviço do sistema (macOS)
./scripts/start_marvin.sh uninstall  # Remove o serviço do sistema
```

## Conformidade A2A

Este agente está 100% em conformidade com o protocolo A2A:
- ✅ Endpoint de descoberta: `/.well-known/agent.json`
- ✅ Formato de Agent Card oficial
- ✅ Gerenciamento de tarefas com estados padrão
- ✅ Suporte a SSE (Server-Sent Events)
- ✅ Comunicação JSON-RPC 2.0

## Saiba Mais

-   [Documentação do Marvin](https://www.askmarvin.ai/)
-   [Repositório GitHub do Marvin](https://github.com/prefecthq/marvin)
-   [Documentação do Protocolo A2A](https://google.github.io/A2A/#/documentation)

## Aviso Legal

Importante: O código de exemplo fornecido é para fins de demonstração e ilustra a mecânica do protocolo Agent-to-Agent (A2A). Ao construir aplicações de produção, é crítico tratar qualquer agente operando fora do seu controle direto como uma entidade potencialmente não confiável.

Todos os dados recebidos de um agente externo—incluindo mas não limitado ao seu AgentCard, mensagens, artefatos e status de tarefas—devem ser tratados como entrada não confiável. Por exemplo, um agente malicioso poderia fornecer um AgentCard contendo dados criados em seus campos (ex: descrição, nome, skills.description). Se esses dados forem usados sem sanitização para construir prompts para um Modelo de Linguagem Grande (LLM), isso poderia expor sua aplicação a ataques de injeção de prompt. A falha em validar e sanitizar adequadamente esses dados antes do uso pode introduzir vulnerabilidades de segurança em sua aplicação.

Os desenvolvedores são responsáveis por implementar medidas de segurança apropriadas, como validação de entrada e manuseio seguro de credenciais para proteger seus sistemas e usuários.