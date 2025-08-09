#!/usr/bin/env python3
"""
Script de Indexação em Lote para URLs A2A
Processa todos os URLs pendentes e adiciona ao MCP RAG
"""

import json
import time
import sys
from datetime import datetime

# Lista completa de URLs para indexar
A2A_URLS = [
    # SDKs e Ferramentas de Desenvolvimento
    ("https://a2aprotocol.ai/blog/adk-a2a-guide", "ADK A2A Guide", "a2a:sdk"),
    ("https://a2aprotocol.ai/blog/a2a-dotnet-sdk", "A2A .NET SDK", "a2a:sdk"),
    ("https://a2aprotocol.ai/blog/a2a-javascript-sdk", "A2A JavaScript SDK", "a2a:sdk"),
    ("https://a2aprotocol.ai/blog/a2a-java-sample", "A2A Java Sample", "a2a:sdk"),
    ("https://a2aprotocol.ai/blog/a2a-sdk-python", "A2A Python SDK", "a2a:sdk"),
    ("https://a2aprotocol.ai/blog/a2a-typescript-guide", "A2A TypeScript Guide", "a2a:sdk"),
    
    # Exemplos e Demos
    ("https://a2aprotocol.ai/blog/a2a-adk-expense-reimbursement", "Expense Reimbursement Demo", "a2a:examples"),
    ("https://a2aprotocol.ai/blog/a2a-js-movie-agent", "JavaScript Movie Agent", "a2a:examples"),
    ("https://a2aprotocol.ai/blog/a2a-python-github-agent", "Python GitHub Agent", "a2a:examples"),
    ("https://a2aprotocol.ai/blog/a2a-travel-planner-openrouter", "Travel Planner with OpenRouter", "a2a:examples"),
    ("https://a2aprotocol.ai/blog/a2a-samples-hello-world", "Hello World Samples", "a2a:examples"),
    ("https://a2aprotocol.ai/blog/a2a-sdk-currency-agent-tutorial", "Currency Agent Tutorial", "a2a:examples"),
    
    # Tutoriais
    ("https://a2aprotocol.ai/blog/python-a2a-tutorial", "Python A2A Tutorial", "a2a:tutorials"),
    ("https://a2aprotocol.ai/blog/python-a2a-tutorial-20250513", "Python A2A Tutorial 2025", "a2a:tutorials"),
    ("https://a2aprotocol.ai/blog/python-a2a-tutorial-with-source-code", "Python Tutorial with Code", "a2a:tutorials"),
    ("https://a2aprotocol.ai/blog/google-a2a-python-sdk-tutorial", "Google A2A Python SDK Tutorial", "a2a:tutorials"),
    ("https://a2aprotocol.ai/blog/a2a-langraph-tutorial-20250513", "LangGraph Tutorial 2025", "a2a:tutorials"),
    
    # Integrações
    ("https://a2aprotocol.ai/blog/a2a-mcp-integration", "A2A MCP Integration", "a2a:integration"),
    ("https://a2aprotocol.ai/blog/a2a-mcp-ag2-sample", "MCP AG2 Sample", "a2a:integration"),
    ("https://a2aprotocol.ai/blog/a2a-mcp-ag-ui", "MCP AG UI", "a2a:integration"),
    ("https://a2aprotocol.ai/blog/a2a-crewai-analysis-chart-agent", "CrewAI Analysis Chart Agent", "a2a:integration"),
    ("https://a2aprotocol.ai/blog/a2a-samples-llama-index-file-chat-openrouter", "LlamaIndex File Chat", "a2a:integration"),
    
    # Análises e Comparações
    ("https://a2aprotocol.ai/blog/a2a-vs-mcp", "A2A vs MCP Comparison", "a2a:analysis"),
    ("https://a2aprotocol.ai/blog/ai-protocols-analysis-report-a2a-mcp-and-acp", "AI Protocols Analysis", "a2a:analysis"),
    ("https://a2aprotocol.ai/blog/impact-analysis-google-donating-a2a-protocol-linux-foundation", "Linux Foundation Impact", "a2a:analysis"),
    ("https://a2aprotocol.ai/blog/agent2agent-protocol-win", "Agent2Agent Protocol Win", "a2a:analysis"),
    ("https://a2aprotocol.ai/blog/a2a-mcp-ai-protocol-winner", "A2A MCP Protocol Winner", "a2a:analysis"),
    
    # Ferramentas e Validadores
    ("https://a2aprotocol.ai/blog/a2a-inspector", "A2A Inspector", "a2a:tools"),
    ("https://a2aprotocol.ai/blog/how-to-use-a2a-protocol-validator", "Protocol Validator Guide", "a2a:tools"),
    ("https://a2aprotocol.ai/blog/openai-codex-cli", "OpenAI Codex CLI", "a2a:tools"),
    
    # Documentação e Recursos
    ("https://a2aprotocol.ai/blog/understanding-a2a-protocol", "Understanding A2A Protocol", "a2a:docs"),
    ("https://a2aprotocol.ai/blog/a2a-implementations", "A2A Implementations", "a2a:docs"),
    ("https://a2aprotocol.ai/blog/awesome-a2a", "Awesome A2A Resources", "a2a:docs"),
    ("https://a2aprotocol.ai/blog/a2a-sample-methods-and-json-responses", "Sample Methods and JSON", "a2a:docs"),
    ("https://a2aprotocol.ai/blog/python-a2a", "Python A2A", "a2a:docs"),
    
    # Casos Especiais
    ("https://a2aprotocol.ai/blog/a2a-acp", "A2A ACP", "a2a:special"),
    ("https://a2aprotocol.ai/blog/geo-seo-a2a", "Geo SEO A2A", "a2a:special"),
    ("https://a2aprotocol.ai/blog/alphaevolve-vs-codex-agent", "AlphaEvolve vs Codex", "a2a:special"),
    ("https://a2aprotocol.ai/blog/alphaenvolve-with-a2a", "AlphaEvolve with A2A", "a2a:special"),
]

def create_indexing_script():
    """Cria script para chamar o Claude com comandos de indexação"""
    
    output = []
    output.append("# Script de Indexação A2A - Execute no Claude Code")
    output.append("# Copie e cole os comandos abaixo para indexar cada URL\n")
    
    for url, title, category in A2A_URLS:
        # Extrair tags baseado no título e URL
        tags = ['a2a', 'blog']
        
        if 'sdk' in url.lower() or 'sdk' in title.lower():
            tags.append('sdk')
        if 'python' in url.lower() or 'python' in title.lower():
            tags.append('python')
        if 'javascript' in url.lower() or 'js' in title.lower():
            tags.append('javascript')
        if 'tutorial' in url.lower() or 'tutorial' in title.lower():
            tags.append('tutorial')
        if 'mcp' in url.lower() or 'mcp' in title.lower():
            tags.append('mcp')
        if 'integration' in category:
            tags.append('integration')
        if 'example' in url.lower() or 'sample' in url.lower():
            tags.append('example')
            
        tags_str = '", "'.join(tags)
        
        output.append(f"""
# Indexar: {title}
mcp__rag-server__add(
    title="{title}",
    content="[Buscar conteúdo via WebFetch]",
    type="blog",
    source="a2aprotocol.ai/blog",
    category="{category}",
    tags=["{tags_str}"],
    url="{url}"
)
""")
    
    return "\n".join(output)

def generate_categorized_list():
    """Gera lista organizada por categoria"""
    
    categories = {}
    for url, title, category in A2A_URLS:
        if category not in categories:
            categories[category] = []
        categories[category].append((url, title))
    
    output = []
    output.append("# URLs A2A Organizados por Categoria\n")
    
    category_names = {
        'a2a:sdk': '🛠️ SDKs e Ferramentas de Desenvolvimento',
        'a2a:examples': '💡 Exemplos e Demos',
        'a2a:tutorials': '📚 Tutoriais',
        'a2a:integration': '🔗 Integrações',
        'a2a:analysis': '📊 Análises e Comparações',
        'a2a:tools': '🔧 Ferramentas e Validadores',
        'a2a:docs': '📖 Documentação e Recursos',
        'a2a:special': '⭐ Casos Especiais'
    }
    
    for cat, name in category_names.items():
        if cat in categories:
            output.append(f"\n## {name}")
            output.append(f"Total: {len(categories[cat])} documentos\n")
            
            for url, title in categories[cat]:
                output.append(f"- [{title}]({url})")
    
    # Estatísticas
    total = len(A2A_URLS)
    output.append(f"\n---\n**Total Geral: {total} documentos**")
    
    return "\n".join(output)

def main():
    print("🚀 Gerador de Scripts de Indexação A2A")
    print("=" * 60)
    
    # Gerar script de indexação
    script = create_indexing_script()
    script_file = "/Users/agents/.claude/index-a2a-commands.txt"
    
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(script)
    
    print(f"✅ Script de comandos salvo em: {script_file}")
    
    # Gerar lista categorizada
    categorized = generate_categorized_list()
    list_file = "/Users/agents/.claude/a2a-urls-categorized.md"
    
    with open(list_file, 'w', encoding='utf-8') as f:
        f.write(categorized)
    
    print(f"✅ Lista categorizada salva em: {list_file}")
    
    # Criar arquivo JSON com metadados
    metadata = []
    for url, title, category in A2A_URLS:
        metadata.append({
            'url': url,
            'title': title,
            'category': category,
            'status': 'pending',
            'timestamp': datetime.now().isoformat()
        })
    
    metadata_file = "/Users/agents/.claude/a2a-urls-metadata.json"
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Metadados salvos em: {metadata_file}")
    
    print(f"\n📊 Resumo:")
    print(f"   - {len(A2A_URLS)} URLs para indexar")
    print(f"   - {len(set(cat for _, _, cat in A2A_URLS))} categorias")
    
    print("\n💡 Próximos passos:")
    print("   1. Execute os comandos em index-a2a-commands.txt")
    print("   2. Rode sync-rag-frontend.py para sincronizar")
    print("   3. Verifique o frontend em http://localhost:5173")

if __name__ == "__main__":
    main()