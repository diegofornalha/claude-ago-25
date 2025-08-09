#!/usr/bin/env python3
"""
MCP RAG Server Manager - Gerenciamento completo do servidor
"""
import sys
import subprocess
import json
import time
from pathlib import Path

def test_server():
    """Testa se o servidor está funcionando"""
    print("🧪 Testando servidor MCP RAG...")
    
    server_path = Path(__file__).parent / "rag_server_enhanced.py"
    
    # Teste básico de inicialização
    test_msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"capabilities": {}}
    }
    
    try:
        process = subprocess.Popen(
            ["python3", str(server_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(
            input=json.dumps(test_msg),
            timeout=10
        )
        
        if stderr:
            print(f"⚠️ Warnings: {stderr}")
        
        result = json.loads(stdout)
        if "result" in result:
            print("✅ Servidor funcionando!")
            return True
        else:
            print("❌ Erro na resposta do servidor")
            return False
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def backup_cache():
    """Cria backup manual do cache"""
    print("💾 Criando backup do cache...")
    
    cache_file = Path.home() / ".claude" / "mcp-rag-cache" / "documents.json"
    backup_dir = Path.home() / ".claude" / "mcp-rag-cache" / "backups"
    
    if not cache_file.exists():
        print("❌ Cache não encontrado")
        return False
    
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_file = backup_dir / f"manual_backup_{int(time.time())}.json"
    
    try:
        import shutil
        shutil.copy2(cache_file, backup_file)
        print(f"✅ Backup criado: {backup_file}")
        return True
    except Exception as e:
        print(f"❌ Erro no backup: {e}")
        return False

def show_stats():
    """Mostra estatísticas do sistema"""
    print("📊 Estatísticas do sistema RAG:")
    
    cache_file = Path.home() / ".claude" / "mcp-rag-cache" / "documents.json"
    backup_dir = Path.home() / ".claude" / "mcp-rag-cache" / "backups"
    
    if cache_file.exists():
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
                docs = data.get('documents', [])
                metadata = data.get('metadata', {})
                
                print(f"  📄 Documentos: {len(docs)}")
                print(f"  💾 Tamanho do cache: {cache_file.stat().st_size:,} bytes")
                print(f"  📅 Última atualização: {metadata.get('last_updated', 'N/A')}")
                print(f"  🔖 Versão: {metadata.get('version', 'N/A')}")
                
                # Estatísticas por tipo
                types = {}
                for doc in docs:
                    doc_type = doc.get('type', 'unknown')
                    types[doc_type] = types.get(doc_type, 0) + 1
                
                print("  📊 Por tipo:")
                for doc_type, count in types.items():
                    print(f"    - {doc_type}: {count}")
                    
        except Exception as e:
            print(f"❌ Erro ao ler cache: {e}")
    else:
        print("❌ Cache não encontrado")
    
    # Backups
    if backup_dir.exists():
        backups = list(backup_dir.glob("*.json"))
        print(f"  💾 Backups disponíveis: {len(backups)}")
    else:
        print("  💾 Nenhum backup encontrado")

def validate_config():
    """Valida configuração MCP"""
    print("🔧 Validando configuração MCP...")
    
    config_file = Path.home() / ".cursor" / "mcp.json"
    
    if not config_file.exists():
        print("❌ Arquivo de configuração MCP não encontrado")
        print(f"   Esperado em: {config_file}")
        return False
    
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        servers = config.get('mcpServers', {})
        rag_server = servers.get('rag-webfetch')
        
        if not rag_server:
            print("❌ Servidor 'rag-webfetch' não encontrado na configuração")
            return False
        
        # Verificar campos obrigatórios
        required_fields = ['command', 'args']
        for field in required_fields:
            if field not in rag_server:
                print(f"❌ Campo obrigatório '{field}' não encontrado")
                return False
        
        # Verificar se arquivo do servidor existe
        server_path = None
        if rag_server.get('args'):
            server_path = rag_server['args'][0]
            if not Path(server_path).exists():
                print(f"❌ Arquivo do servidor não encontrado: {server_path}")
                return False
        
        print("✅ Configuração MCP válida!")
        print(f"   Servidor: {server_path}")
        print(f"   Comando: {rag_server.get('command')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao validar configuração: {e}")
        return False

def main():
    """Menu principal"""
    if len(sys.argv) < 2:
        print("🚀 MCP RAG Server Manager")
        print("=" * 40)
        print("Comandos disponíveis:")
        print("  test      - Testa o servidor")
        print("  backup    - Cria backup do cache")
        print("  stats     - Mostra estatísticas")
        print("  validate  - Valida configuração MCP")
        print("  all       - Executa todos os comandos")
        print()
        print("Uso: python3 manage.py <comando>")
        return
    
    command = sys.argv[1].lower()
    
    if command == "test":
        test_server()
    elif command == "backup":
        backup_cache()
    elif command == "stats":
        show_stats()
    elif command == "validate":
        validate_config()
    elif command == "all":
        print("🚀 Executando verificação completa...")
        print()
        validate_config()
        print()
        test_server()
        print()
        show_stats()
        print()
        backup_cache()
        print()
        print("✅ Verificação completa finalizada!")
    else:
        print(f"❌ Comando desconhecido: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()