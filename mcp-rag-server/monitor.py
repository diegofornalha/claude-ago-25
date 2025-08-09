#!/usr/bin/env python3
"""
Monitor Principal - Sistema Completo de Monitoramento
Integra métricas, alertas, backups e dashboard
"""
import sys
import time
import json
import argparse
from pathlib import Path

# Importar módulos do sistema
try:
    from monitoring import metrics_collector, start_monitoring, stop_monitoring
    from backup_system import backup_system, start_backup_service, create_manual_backup
    from health_check import main as health_check
except ImportError as e:
    print(f"❌ Erro ao importar módulos: {e}")
    print("Certifique-se de que todos os arquivos estão no diretório correto")
    sys.exit(1)

def show_dashboard():
    """Mostra dashboard em tempo real no terminal"""
    try:
        while True:
            # Limpar tela
            print("\033[2J\033[H")
            
            print("🚀 MCP RAG Server - Monitor Dashboard")
            print("=" * 60)
            print(f"⏰ {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print()
            
            # Métricas atuais
            metrics = metrics_collector.get_current_metrics()
            if metrics:
                print("📊 MÉTRICAS ATUAIS:")
                print(f"  🖥️  CPU: {metrics.get('cpu_percent', 0):.1f}%")
                print(f"  💾 Memória: {metrics.get('memory_percent', 0):.1f}%")
                print(f"  💿 Disco: {metrics.get('disk_usage_percent', 0):.1f}%")
                print(f"  📦 Cache: {metrics.get('cache_size_mb', 0):.1f} MB")
                print(f"  📄 Docs: {metrics.get('document_count', 0)}")
                print()
            
            # Performance
            perf_stats = metrics_collector.performance_stats
            print("⚡ PERFORMANCE:")
            print(f"  📈 Requisições: {perf_stats['total_requests']}")
            print(f"  ✅ Sucessos: {perf_stats['successful_requests']}")
            print(f"  ❌ Falhas: {perf_stats['failed_requests']}")
            if perf_stats['successful_requests'] > 0:
                avg_time = (perf_stats['total_response_time'] / perf_stats['successful_requests']) * 1000
                print(f"  ⏱️  Tempo médio: {avg_time:.0f}ms")
            print()
            
            # Alertas
            alerts_summary = metrics_collector.get_alerts_summary()
            print("🚨 ALERTAS:")
            if alerts_summary['total'] > 0:
                print(f"  📊 Total: {alerts_summary['total']}")
                for severity, count in alerts_summary['by_severity'].items():
                    print(f"  🔸 {severity.capitalize()}: {count}")
                
                print("  📋 Recentes:")
                for alert in alerts_summary['recent'][-3:]:
                    metric = alert['metric']
                    value = alert['value']
                    threshold = alert['threshold']
                    print(f"    - {metric}: {value:.1f} > {threshold}")
            else:
                print("  ✅ Nenhum alerta ativo")
            print()
            
            # Backups
            try:
                backup_stats = backup_system.get_backup_stats()
                print("💾 BACKUPS:")
                print(f"  📊 Total: {backup_stats['total_backups']} ({backup_stats['total_size_mb']:.1f}MB)")
                print(f"  🏥 Saúde: {backup_stats['backup_health']}")
                
                for backup_type, stats in backup_stats['by_type'].items():
                    if stats['count'] > 0:
                        print(f"  📁 {backup_type.capitalize()}: {stats['count']} ({stats['size_mb']:.1f}MB)")
            except Exception as e:
                print(f"  ❌ Erro ao obter stats de backup: {e}")
            
            print()
            print("Pressione Ctrl+C para sair")
            print("=" * 60)
            
            # Aguardar próxima atualização
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n👋 Saindo do dashboard...")

def show_status():
    """Mostra status resumido do sistema"""
    print("🔍 Status do Sistema MCP RAG")
    print("=" * 40)
    
    # Health check básico
    print("🏥 Executando health check...")
    try:
        from health_check import test_mcp_server, check_cache_health, check_permissions
        
        tests = [
            ("Servidor MCP", test_mcp_server),
            ("Cache RAG", check_cache_health),
            ("Permissões", check_permissions)
        ]
        
        passed = 0
        for test_name, test_func in tests:
            result = test_func()
            status = "✅" if result else "❌"
            print(f"  {status} {test_name}")
            if result:
                passed += 1
        
        print(f"\n📊 Resultado: {passed}/{len(tests)} testes passaram")
        
    except Exception as e:
        print(f"❌ Erro no health check: {e}")
    
    # Métricas rápidas
    print("\n📊 Métricas:")
    try:
        metrics = metrics_collector.get_current_metrics()
        print(f"  CPU: {metrics.get('cpu_percent', 0):.1f}%")
        print(f"  Memória: {metrics.get('memory_percent', 0):.1f}%")
        print(f"  Cache: {metrics.get('cache_size_mb', 0):.1f}MB")
        print(f"  Documentos: {metrics.get('document_count', 0)}")
    except Exception as e:
        print(f"  ❌ Erro ao obter métricas: {e}")
    
    # Alertas
    print("\n🚨 Alertas:")
    try:
        alerts = metrics_collector.get_alerts_summary()
        if alerts['total'] > 0:
            print(f"  ⚠️ {alerts['total']} alertas ativos")
        else:
            print("  ✅ Nenhum alerta")
    except Exception as e:
        print(f"  ❌ Erro ao obter alertas: {e}")

def start_services():
    """Inicia todos os serviços de monitoramento"""
    print("🚀 Iniciando serviços de monitoramento...")
    
    try:
        # Iniciar coleta de métricas
        start_monitoring()
        print("✅ Coleta de métricas iniciada")
        
        # Iniciar serviço de backup
        start_backup_service()
        print("✅ Serviço de backup iniciado")
        
        print("\n🎉 Todos os serviços iniciados com sucesso!")
        print("📊 Dashboard web disponível em: file:///Users/agents/.claude/mcp-rag-server/dashboard.html")
        print("🔍 Use 'python3 monitor.py dashboard' para ver dashboard no terminal")
        
        # Manter serviços rodando
        try:
            while True:
                time.sleep(60)
                # Verificação periódica básica
                print(f"⏰ {time.strftime('%H:%M:%S')} - Serviços rodando...")
        except KeyboardInterrupt:
            print("\n🛑 Parando serviços...")
            stop_monitoring()
            backup_system.stop_backup_service()
            print("✅ Serviços parados")
            
    except Exception as e:
        print(f"❌ Erro ao iniciar serviços: {e}")

def create_backup():
    """Cria backup manual"""
    print("💾 Criando backup manual...")
    
    try:
        backup_file = create_manual_backup()
        if backup_file:
            size_mb = backup_file.stat().st_size / 1024 / 1024
            print(f"✅ Backup criado: {backup_file}")
            print(f"📊 Tamanho: {size_mb:.1f}MB")
        else:
            print("❌ Erro ao criar backup")
    except Exception as e:
        print(f"❌ Erro: {e}")

def show_help():
    """Mostra ajuda dos comandos"""
    print("🚀 MCP RAG Server - Monitor")
    print("=" * 40)
    print("Comandos disponíveis:")
    print()
    print("  dashboard    - Dashboard em tempo real no terminal")
    print("  status       - Status resumido do sistema")
    print("  start        - Inicia todos os serviços de monitoramento")
    print("  backup       - Cria backup manual")
    print("  health       - Executa health check completo")
    print("  help         - Mostra esta ajuda")
    print()
    print("Exemplos:")
    print("  python3 monitor.py dashboard")
    print("  python3 monitor.py status")
    print("  python3 monitor.py start")

def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description='MCP RAG Server Monitor')
    parser.add_argument('command', nargs='?', default='help',
                       choices=['dashboard', 'status', 'start', 'backup', 'health', 'help'],
                       help='Comando a executar')
    
    args = parser.parse_args()
    
    if args.command == 'dashboard':
        show_dashboard()
    elif args.command == 'status':
        show_status()
    elif args.command == 'start':
        start_services()
    elif args.command == 'backup':
        create_backup()
    elif args.command == 'health':
        health_check()
    else:
        show_help()

if __name__ == "__main__":
    main()