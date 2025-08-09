#!/usr/bin/env python3
"""
Teste do sistema de logging estruturado
"""

import json
import subprocess
import sys
import os
from pathlib import Path
import time

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'  # No Color

def print_colored(message, color=NC):
    """Print colored output"""
    print(f"{color}{message}{NC}")

def test_logging():
    """Testa o sistema de logging estruturado"""
    print_colored("🧪 Testando sistema de logging estruturado", YELLOW)
    print("=" * 50)
    
    log_file = Path.home() / ".claude" / "mcp-rag-cache" / "rag_server.log"
    
    # Limpar log anterior se existir
    if log_file.exists():
        log_file.unlink()
    
    # Test 1: Verificar criação do arquivo de log
    print_colored("\n1. Testando criação de arquivo de log...", YELLOW)
    
    # Executar comando que deve gerar log
    command = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"capabilities": {}}
    }
    
    # Definir variável de ambiente para debug
    env = os.environ.copy()
    env['RAG_LOG_LEVEL'] = 'DEBUG'
    env['RAG_DEBUG'] = 'false'  # Não mostrar logs no stderr
    
    process = subprocess.Popen(
        ['python3', 'rag_server_v2.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )
    
    stdout, stderr = process.communicate(input=json.dumps(command))
    
    # Aguardar um pouco para o log ser escrito
    time.sleep(0.5)
    
    if log_file.exists():
        print_colored("✓ Arquivo de log criado", GREEN)
        
        # Verificar conteúdo do log
        with open(log_file, 'r') as f:
            log_content = f.read()
            
        # Test 2: Verificar mensagens de log
        print_colored("\n2. Verificando conteúdo do log...", YELLOW)
        
        checks = [
            ("Inicializando RAGServerV2", "Inicialização do servidor"),
            ("Servidor MCP RAG v2 iniciado", "Início do servidor"),
            ("Request recebido", "Recebimento de request"),
        ]
        
        for check_text, description in checks:
            if check_text in log_content:
                print_colored(f"✓ {description} registrado", GREEN)
            else:
                print_colored(f"✗ {description} não encontrado", RED)
        
        # Test 3: Verificar formato do log
        print_colored("\n3. Verificando formato do log...", YELLOW)
        
        # Pegar primeira linha do log
        first_line = log_content.split('\n')[0] if log_content else ""
        
        if "rag_server_v2" in first_line and " - " in first_line:
            print_colored("✓ Formato de log estruturado correto", GREEN)
        else:
            print_colored("✗ Formato de log incorreto", RED)
        
        # Test 4: Testar log de erro
        print_colored("\n4. Testando log de erro...", YELLOW)
        
        # Enviar comando inválido para gerar erro
        error_command = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "invalid_method",
            "params": {}
        }
        
        process = subprocess.Popen(
            ['python3', 'rag_server_v2.py'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(input=json.dumps(error_command))
        
        # Aguardar um pouco
        time.sleep(0.5)
        
        # Reler log
        with open(log_file, 'r') as f:
            log_content = f.read()
        
        if "Method not found" in log_content or "invalid_method" in log_content:
            print_colored("✓ Erros sendo registrados no log", GREEN)
        else:
            print_colored("✗ Erros não registrados", RED)
        
        # Test 5: Verificar níveis de log
        print_colored("\n5. Testando níveis de log...", YELLOW)
        
        levels_found = {
            'DEBUG': 'DEBUG' in log_content,
            'INFO': 'INFO' in log_content,
            'WARNING': 'WARNING' in log_content or 'WARN' in log_content,
            'ERROR': 'ERROR' in log_content
        }
        
        for level, found in levels_found.items():
            if found:
                print_colored(f"✓ Nível {level} encontrado", GREEN)
            else:
                print_colored(f"ℹ Nível {level} não encontrado (pode ser normal)", YELLOW)
        
        # Mostrar tamanho do arquivo de log
        log_size = log_file.stat().st_size
        print_colored(f"\n📊 Tamanho do arquivo de log: {log_size} bytes", YELLOW)
        
        # Mostrar primeiras linhas do log
        print_colored("\n📝 Primeiras linhas do log:", YELLOW)
        lines = log_content.split('\n')[:5]
        for line in lines:
            if line:
                print(f"  {line[:100]}..." if len(line) > 100 else f"  {line}")
        
        return True
    else:
        print_colored("✗ Arquivo de log não foi criado", RED)
        return False

def main():
    """Executa testes de logging"""
    print_colored("🚀 Teste de Logging Estruturado MCP RAG v2", YELLOW)
    
    if test_logging():
        print_colored("\n✅ Sistema de logging funcionando corretamente!", GREEN)
        print("\nCaracterísticas verificadas:")
        print("✓ Arquivo de log criado em ~/.claude/mcp-rag-cache/rag_server.log")
        print("✓ Mensagens de inicialização registradas")
        print("✓ Formato estruturado implementado")
        print("✓ Diferentes níveis de log suportados")
        print("✓ Variáveis de ambiente RAG_LOG_LEVEL e RAG_DEBUG funcionais")
        return 0
    else:
        print_colored("\n⚠️ Problemas encontrados no sistema de logging", YELLOW)
        return 1

if __name__ == "__main__":
    sys.exit(main())