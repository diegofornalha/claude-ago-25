#!/usr/bin/env python3
"""
CLI principal do Marvin Agent
Interface de linha de comando para controlar e interagir com o Marvin
"""

import sys
import os
import json
import asyncio
import signal
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import click
except ImportError:
    print("❌ click não está instalado. Instalando...")
    subprocess.run([sys.executable, "-m", "pip", "install", "click"], check=True)
    import click

from src.agent import MarvinAgent
from src.marvin_daemon import MarvinDaemon

# Cores para output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

@click.group()
@click.version_option(version='1.0.0', prog_name='Marvin Agent')
def cli():
    """
    🧠 Marvin Agent - Inteligência A2A
    
    Sistema de agente inteligente com protocolo A2A,
    extração de dados e monitoramento contínuo.
    """
    pass

@cli.command()
@click.option('--port', default=9998, help='Porta para o servidor (padrão: 9998)')
@click.option('--host', default='localhost', help='Host para o servidor (padrão: localhost)')
@click.option('--daemon', is_flag=True, help='Executar como daemon com auto-restart')
def serve(port: int, host: str, daemon: bool):
    """🚀 Inicia o servidor Marvin Agent"""
    
    if daemon:
        click.echo(f"{GREEN}🔄 Iniciando Marvin em modo daemon...{RESET}")
        daemon_instance = MarvinDaemon()
        
        # Configurar porta e host
        os.environ['PORT'] = str(port)
        os.environ['HOST'] = host
        
        try:
            daemon_instance.monitor()
        except KeyboardInterrupt:
            click.echo(f"\n{YELLOW}⚠️  Interrompido pelo usuário{RESET}")
            daemon_instance.shutdown()
    else:
        click.echo(f"{GREEN}🚀 Iniciando Marvin Agent...{RESET}")
        click.echo(f"   Host: {host}")
        click.echo(f"   Porta: {port}")
        click.echo(f"   URL: http://{host}:{port}")
        
        # Executar servidor diretamente
        server_path = Path(__file__).parent / "server.py"
        env = os.environ.copy()
        env['PORT'] = str(port)
        env['HOST'] = host
        
        try:
            subprocess.run([sys.executable, str(server_path)], env=env)
        except KeyboardInterrupt:
            click.echo(f"\n{YELLOW}⚠️  Servidor interrompido{RESET}")

@cli.command()
def status():
    """📊 Mostra o status do Marvin Agent"""
    daemon = MarvinDaemon()
    daemon.status()

@cli.command()
def stop():
    """🛑 Para o Marvin Agent e o daemon"""
    daemon = MarvinDaemon()
    
    click.echo(f"{YELLOW}🛑 Parando Marvin Agent...{RESET}")
    
    # Parar o servidor
    daemon.stop_marvin()
    
    # Parar o daemon se estiver rodando
    if daemon.daemon_pid_file.exists():
        try:
            with open(daemon.daemon_pid_file, 'r') as f:
                daemon_pid = int(f.read().strip())
            os.kill(daemon_pid, signal.SIGTERM)
            daemon.daemon_pid_file.unlink()
            click.echo(f"{GREEN}✅ Daemon parado{RESET}")
        except:
            click.echo(f"{YELLOW}⚠️  Daemon não estava rodando{RESET}")
    
    click.echo(f"{GREEN}✅ Marvin Agent parado{RESET}")

@cli.command()
@click.argument('text', required=True)
@click.option('--format', type=click.Choice(['json', 'text', 'table']), default='json', help='Formato de saída')
def extract(text: str, format: str):
    """🔍 Extrai dados estruturados de um texto"""
    
    async def run_extraction():
        agent = MarvinAgent()
        result = await agent.extract_data(text)
        return result
    
    click.echo(f"{BLUE}🔍 Analisando texto...{RESET}\n")
    
    # Executar extração
    result = asyncio.run(run_extraction())
    
    if format == 'json':
        click.echo(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif format == 'text':
        click.echo(f"{GREEN}📋 Dados Extraídos:{RESET}")
        
        entities = result.get('entities', {})
        
        if entities.get('names'):
            click.echo(f"\n👤 Nomes: {', '.join(entities['names'])}")
        
        if entities.get('emails'):
            click.echo(f"📧 Emails: {', '.join(entities['emails'])}")
        
        if entities.get('phones'):
            click.echo(f"📱 Telefones: {', '.join(entities['phones'])}")
        
        if entities.get('companies'):
            click.echo(f"🏢 Empresas: {', '.join(entities['companies'])}")
        
        if entities.get('positions'):
            click.echo(f"💼 Cargos: {', '.join(entities['positions'])}")
        
        summary = result.get('summary', '')
        if summary:
            click.echo(f"\n📝 Resumo: {summary}")
    
    elif format == 'table':
        click.echo(f"{GREEN}┌─────────────┬────────────────────────────────┐{RESET}")
        click.echo(f"{GREEN}│ Tipo        │ Valores                        │{RESET}")
        click.echo(f"{GREEN}├─────────────┼────────────────────────────────┤{RESET}")
        
        entities = result.get('entities', {})
        
        for entity_type, values in entities.items():
            if values:
                type_name = {
                    'names': 'Nomes',
                    'emails': 'Emails', 
                    'phones': 'Telefones',
                    'companies': 'Empresas',
                    'positions': 'Cargos'
                }.get(entity_type, entity_type)
                
                value_str = ', '.join(values)[:30]
                if len(', '.join(values)) > 30:
                    value_str += '...'
                
                click.echo(f"│ {type_name:<11} │ {value_str:<30} │")
        
        click.echo(f"{GREEN}└─────────────┴────────────────────────────────┘{RESET}")

@cli.command()
@click.option('--endpoint', default='/.well-known/agent-card.json', help='Endpoint para testar')
def test(endpoint: str):
    """🧪 Testa a conectividade com o Marvin Agent"""
    
    import requests
    
    click.echo(f"{BLUE}🧪 Testando Marvin Agent...{RESET}\n")
    
    # Verificar se está rodando
    daemon = MarvinDaemon()
    
    if not daemon.is_port_in_use():
        click.echo(f"{RED}❌ Marvin não está rodando!{RESET}")
        click.echo(f"   Use '{GREEN}marvin serve{RESET}' para iniciar")
        return
    
    # Testar endpoint
    try:
        url = f"http://localhost:{daemon.port}{endpoint}"
        click.echo(f"📡 Testando: {url}")
        
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            click.echo(f"{GREEN}✅ Conexão bem-sucedida!{RESET}\n")
            
            if endpoint.endswith('.json'):
                data = response.json()
                click.echo(f"{GREEN}📋 Agent Card:{RESET}")
                click.echo(json.dumps(data, indent=2, ensure_ascii=False))
            else:
                click.echo(response.text)
        else:
            click.echo(f"{YELLOW}⚠️  Status: {response.status_code}{RESET}")
            click.echo(response.text)
            
    except requests.ConnectionError:
        click.echo(f"{RED}❌ Não foi possível conectar ao Marvin{RESET}")
    except requests.Timeout:
        click.echo(f"{RED}❌ Timeout na conexão{RESET}")
    except Exception as e:
        click.echo(f"{RED}❌ Erro: {e}{RESET}")

@cli.command()
def logs():
    """📋 Mostra os logs do Marvin Agent"""
    
    log_dir = Path(__file__).parent.parent / "logs"
    log_file = log_dir / "marvin.log"
    daemon_log = log_dir / "marvin_daemon.log"
    
    click.echo(f"{BLUE}📋 Logs do Marvin Agent{RESET}\n")
    
    # Mostrar logs do servidor
    if log_file.exists():
        click.echo(f"{GREEN}📄 Logs do Servidor:{RESET}")
        click.echo("-" * 50)
        
        with open(log_file, 'r') as f:
            lines = f.readlines()
            # Mostrar últimas 20 linhas
            for line in lines[-20:]:
                click.echo(line.strip())
    else:
        click.echo(f"{YELLOW}⚠️  Arquivo de log do servidor não encontrado{RESET}")
    
    click.echo()
    
    # Mostrar logs do daemon
    if daemon_log.exists():
        click.echo(f"{GREEN}📄 Logs do Daemon:{RESET}")
        click.echo("-" * 50)
        
        with open(daemon_log, 'r') as f:
            lines = f.readlines()
            # Mostrar últimas 10 linhas
            for line in lines[-10:]:
                click.echo(line.strip())
    else:
        click.echo(f"{YELLOW}⚠️  Arquivo de log do daemon não encontrado{RESET}")

@cli.command()
def info():
    """ℹ️ Informações sobre o Marvin Agent"""
    
    click.echo(f"{BLUE}╔══════════════════════════════════════════╗{RESET}")
    click.echo(f"{BLUE}║       🧠 Marvin Agent - v1.0.0          ║{RESET}")
    click.echo(f"{BLUE}╚══════════════════════════════════════════╝{RESET}")
    click.echo()
    click.echo("📚 Protocolo: A2A (Agent-to-Agent)")
    click.echo("🔧 Tecnologia: Python + FastAPI + A2A SDK")
    click.echo("🎯 Funcionalidades:")
    click.echo("   • Análise inteligente de dados")
    click.echo("   • Extração de informações de contato")
    click.echo("   • Suporte a streaming")
    click.echo("   • Auto-restart com daemon")
    click.echo()
    click.echo("🌐 Endpoints:")
    click.echo("   • /.well-known/agent-card.json - Metadados")
    click.echo("   • / - JSON-RPC 2.0 (POST)")
    click.echo()
    click.echo("📁 Diretórios:")
    click.echo(f"   • Logs: {Path(__file__).parent.parent / 'logs'}")
    click.echo(f"   • Config: {Path(__file__).parent.parent / '.env'}")
    click.echo()
    click.echo("💡 Comandos úteis:")
    click.echo("   marvin serve --daemon    # Iniciar com auto-restart")
    click.echo("   marvin status           # Ver status")
    click.echo("   marvin extract 'texto'  # Extrair dados")
    click.echo("   marvin test            # Testar conexão")
    click.echo("   marvin logs            # Ver logs")

if __name__ == '__main__':
    cli()