#!/usr/bin/env python3
"""
Health Check Script para MCP RAG Server
Verifica se todas as funcionalidades estão operacionais
"""
import json
import subprocess
import sys
import time
from pathlib import Path

def test_mcp_server():
    """Testa se o servidor MCP está funcionando"""
    print("🔍 Testando MCP RAG Server...")
    
    server_path = "/Users/agents/.claude/mcp-rag-server/rag_server.py"
    
    # Teste 1: Initialize
    print("  ✅ Teste 1: Initialize")
    init_msg = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}}}
    result = run_mcp_command(server_path, init_msg)
    if not result or "error" in result:
        print("  ❌ Falhou no initialize")
        return False
    
    # Teste 2: Tools List
    print("  ✅ Teste 2: Tools List")
    tools_msg = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    result = run_mcp_command(server_path, tools_msg)
    if not result or "error" in result:
        print("  ❌ Falhou no tools/list")
        return False
    
    tools = result.get("result", {}).get("tools", [])
    expected_tools = ["search", "add", "remove", "list", "stats"]
    found_tools = [t["name"] for t in tools]
    
    for tool in expected_tools:
        if tool not in found_tools:
            print(f"  ❌ Ferramenta '{tool}' não encontrada")
            return False
    
    print(f"  ✅ Todas as {len(expected_tools)} ferramentas encontradas")
    
    # Teste 3: Stats funcionando
    print("  ✅ Teste 3: Stats")
    stats_msg = {
        "jsonrpc": "2.0", 
        "id": 3, 
        "method": "tools/call",
        "params": {
            "name": "stats",
            "arguments": {}
        }
    }
    result = run_mcp_command(server_path, stats_msg)
    if not result or "error" in result:
        print("  ❌ Falhou no stats")
        return False
    
    print("  ✅ Servidor MCP funcionando perfeitamente!")
    return True

def run_mcp_command(server_path, message):
    """Executa comando MCP e retorna resultado"""
    try:
        process = subprocess.Popen(
            ["python3", server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=json.dumps(message), timeout=10)
        
        if stderr:
            print(f"  ⚠️ Stderr: {stderr}")
        
        return json.loads(stdout) if stdout else None
        
    except subprocess.TimeoutExpired:
        process.kill()
        print("  ❌ Timeout na execução")
        return None
    except Exception as e:
        print(f"  ❌ Erro: {e}")
        return None

def check_cache_health():
    """Verifica saúde do cache RAG"""
    print("📦 Verificando Cache RAG...")
    
    cache_path = Path("/Users/agents/.claude/mcp-rag-cache")
    cache_file = cache_path / "documents.json"
    
    if not cache_path.exists():
        print("  ❌ Diretório de cache não existe")
        return False
    
    if not cache_file.exists():
        print("  ❌ Arquivo de cache não existe")
        return False
    
    try:
        with open(cache_file, 'r') as f:
            data = json.load(f)
            docs = data.get('documents', [])
            print(f"  ✅ Cache OK: {len(docs)} documentos")
            
            # Verificar tamanho do cache
            cache_size = cache_file.stat().st_size
            print(f"  ✅ Tamanho do cache: {cache_size:,} bytes")
            
            return True
    except Exception as e:
        print(f"  ❌ Erro ao ler cache: {e}")
        return False

def check_permissions():
    """Verifica permissões dos arquivos"""
    print("🔐 Verificando Permissões...")
    
    files_to_check = [
        "/Users/agents/.claude/mcp-rag-server/rag_server.py",
        "/Users/agents/.claude/mcp-rag-cache/documents.json"
    ]
    
    for file_path in files_to_check:
        path = Path(file_path)
        if path.exists():
            mode = oct(path.stat().st_mode)[-3:]
            print(f"  ✅ {path.name}: {mode}")
        else:
            print(f"  ❌ {path.name}: não existe")
            return False
    
    return True

def main():
    """Executa todos os testes de health check"""
    print("🚀 Health Check MCP RAG Server")
    print("=" * 50)
    
    start_time = time.time()
    
    # Executar todos os testes
    tests = [
        ("MCP Server", test_mcp_server),
        ("Cache RAG", check_cache_health), 
        ("Permissões", check_permissions)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        if test_func():
            passed += 1
        else:
            print(f"❌ {test_name} falhou!")
    
    # Resultado final
    end_time = time.time()
    duration = end_time - start_time
    
    print("\n" + "=" * 50)
    print(f"📊 Resultado: {passed}/{total} testes passaram")
    print(f"⏱️ Tempo: {duration:.2f}s")
    
    if passed == total:
        print("🎉 Todos os testes passaram! Sistema funcionando perfeitamente!")
        return 0
    else:
        print("⚠️ Alguns testes falharam. Verifique os erros acima.")
        return 1

if __name__ == "__main__":
    sys.exit(main())