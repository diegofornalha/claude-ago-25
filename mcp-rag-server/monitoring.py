#!/usr/bin/env python3
"""
Sistema de Monitoramento Avançado - MCP RAG Server
Monitoramento completo com métricas, alertas e dashboard em tempo real
"""
import json
import time
import psutil
import threading
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
import logging
from logging.handlers import RotatingFileHandler

# Configuração de paths
BASE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
METRICS_FILE = BASE_PATH / "metrics.json"
ALERTS_FILE = BASE_PATH / "alerts.json"
DASHBOARD_FILE = BASE_PATH / "dashboard.json"

class MetricsCollector:
    """Coleta métricas do sistema em tempo real"""
    
    def __init__(self):
        self.metrics = defaultdict(deque)
        self.alerts = []
        self.start_time = time.time()
        self.running = False
        self.thread = None
        
        # Configurar logging com rotação
        self.setup_logging()
        
        # Limites para alertas
        self.thresholds = {
            'cpu_percent': 80.0,
            'memory_percent': 85.0,
            'disk_usage_percent': 90.0,
            'response_time_ms': 1000.0,
            'error_rate_percent': 5.0,
            'cache_size_mb': 100.0
        }
        
        # Contadores de performance
        self.performance_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_response_time': 0.0,
            'search_count': 0,
            'add_count': 0,
            'remove_count': 0,
            'list_count': 0,
            'stats_count': 0
        }
    
    def setup_logging(self):
        """Configura sistema de logs com rotação automática"""
        log_file = BASE_PATH / "monitoring.log"
        
        # Criar handler com rotação (max 5MB, keep 10 files)
        handler = RotatingFileHandler(
            log_file,
            maxBytes=5*1024*1024,  # 5MB
            backupCount=10
        )
        
        # Formato detalhado
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
        )
        handler.setFormatter(formatter)
        
        # Configurar logger
        self.logger = logging.getLogger("metrics-collector")
        self.logger.setLevel(logging.INFO)
        self.logger.addHandler(handler)
        
        self.logger.info("Metrics Collector initialized")
    
    def start_monitoring(self):
        """Inicia monitoramento em background"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.thread.start()
        self.logger.info("Monitoring started")
    
    def stop_monitoring(self):
        """Para monitoramento"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Monitoring stopped")
    
    def _monitoring_loop(self):
        """Loop principal de monitoramento"""
        while self.running:
            try:
                # Coletar métricas do sistema
                self._collect_system_metrics()
                
                # Coletar métricas do RAG
                self._collect_rag_metrics()
                
                # Verificar alertas
                self._check_alerts()
                
                # Salvar métricas
                self._save_metrics()
                
                # Atualizar dashboard
                self._update_dashboard()
                
                # Aguardar próximo ciclo
                time.sleep(30)  # Coleta a cada 30 segundos
                
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                time.sleep(60)  # Aguardar mais tempo em caso de erro
    
    def _collect_system_metrics(self):
        """Coleta métricas do sistema operacional"""
        timestamp = time.time()
        
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        self.metrics['cpu_percent'].append((timestamp, cpu_percent))
        
        # Memória
        memory = psutil.virtual_memory()
        self.metrics['memory_percent'].append((timestamp, memory.percent))
        self.metrics['memory_used_mb'].append((timestamp, memory.used / 1024 / 1024))
        
        # Disco
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        self.metrics['disk_usage_percent'].append((timestamp, disk_percent))
        
        # Manter apenas últimas 2880 medições (24h com coleta a cada 30s)
        for key in self.metrics:
            if len(self.metrics[key]) > 2880:
                self.metrics[key].popleft()
    
    def _collect_rag_metrics(self):
        """Coleta métricas específicas do RAG"""
        timestamp = time.time()
        
        try:
            # Tamanho do cache
            cache_file = BASE_PATH / "documents.json"
            if cache_file.exists():
                cache_size_mb = cache_file.stat().st_size / 1024 / 1024
                self.metrics['cache_size_mb'].append((timestamp, cache_size_mb))
                
                # Número de documentos
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                    doc_count = len(data.get('documents', []))
                    self.metrics['document_count'].append((timestamp, doc_count))
            
            # Uptime
            uptime_hours = (time.time() - self.start_time) / 3600
            self.metrics['uptime_hours'].append((timestamp, uptime_hours))
            
            # Taxa de erro
            if self.performance_stats['total_requests'] > 0:
                error_rate = (self.performance_stats['failed_requests'] / 
                            self.performance_stats['total_requests']) * 100
                self.metrics['error_rate_percent'].append((timestamp, error_rate))
            
            # Tempo médio de resposta
            if self.performance_stats['successful_requests'] > 0:
                avg_response_time = (self.performance_stats['total_response_time'] / 
                                   self.performance_stats['successful_requests']) * 1000
                self.metrics['avg_response_time_ms'].append((timestamp, avg_response_time))
            
        except Exception as e:
            self.logger.error(f"Error collecting RAG metrics: {e}")
    
    def _check_alerts(self):
        """Verifica condições de alerta"""
        current_time = time.time()
        
        # Verificar cada métrica contra seus thresholds
        for metric_name, threshold in self.thresholds.items():
            if metric_name in self.metrics and self.metrics[metric_name]:
                latest_value = self.metrics[metric_name][-1][1]
                
                if latest_value > threshold:
                    alert = {
                        'timestamp': current_time,
                        'type': 'threshold_exceeded',
                        'metric': metric_name,
                        'value': latest_value,
                        'threshold': threshold,
                        'severity': self._get_alert_severity(metric_name, latest_value, threshold)
                    }
                    
                    # Evitar spam de alertas (mesmo alerta em menos de 5 minutos)
                    if not self._is_duplicate_alert(alert):
                        self.alerts.append(alert)
                        self.logger.warning(f"ALERT: {metric_name} = {latest_value:.2f} > {threshold}")
        
        # Manter apenas alertas das últimas 24h
        cutoff_time = current_time - (24 * 3600)
        self.alerts = [alert for alert in self.alerts if alert['timestamp'] > cutoff_time]
    
    def _get_alert_severity(self, metric_name, value, threshold):
        """Determina severidade do alerta"""
        ratio = value / threshold
        
        if ratio > 2.0:
            return 'critical'
        elif ratio > 1.5:
            return 'high'
        elif ratio > 1.2:
            return 'medium'
        else:
            return 'low'
    
    def _is_duplicate_alert(self, new_alert):
        """Verifica se é um alerta duplicado recente"""
        cutoff_time = new_alert['timestamp'] - 300  # 5 minutos
        
        for alert in reversed(self.alerts):
            if alert['timestamp'] < cutoff_time:
                break
            
            if (alert['metric'] == new_alert['metric'] and 
                alert['type'] == new_alert['type']):
                return True
        
        return False
    
    def _save_metrics(self):
        """Salva métricas em arquivo JSON"""
        try:
            # Converter deque para lista para serialização
            metrics_data = {}
            for key, values in self.metrics.items():
                metrics_data[key] = list(values)
            
            data = {
                'timestamp': time.time(),
                'metrics': metrics_data,
                'performance_stats': self.performance_stats,
                'uptime_seconds': time.time() - self.start_time
            }
            
            with open(METRICS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Salvar alertas
            with open(ALERTS_FILE, 'w') as f:
                json.dump({'alerts': self.alerts}, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error saving metrics: {e}")
    
    def _update_dashboard(self):
        """Atualiza dashboard em tempo real"""
        try:
            current_time = time.time()
            
            # Estatísticas atuais
            current_stats = {}
            for metric_name in ['cpu_percent', 'memory_percent', 'disk_usage_percent', 'cache_size_mb']:
                if metric_name in self.metrics and self.metrics[metric_name]:
                    current_stats[metric_name] = self.metrics[metric_name][-1][1]
            
            # Alertas ativos (últimas 2 horas)
            recent_alerts = [
                alert for alert in self.alerts 
                if alert['timestamp'] > current_time - 7200
            ]
            
            # Status geral do sistema
            status = self._calculate_system_status(current_stats, recent_alerts)
            
            dashboard = {
                'timestamp': current_time,
                'status': status,
                'current_metrics': current_stats,
                'performance_stats': self.performance_stats,
                'recent_alerts': recent_alerts,
                'uptime': {
                    'seconds': current_time - self.start_time,
                    'formatted': self._format_uptime(current_time - self.start_time)
                },
                'health_score': self._calculate_health_score(current_stats, recent_alerts)
            }
            
            with open(DASHBOARD_FILE, 'w') as f:
                json.dump(dashboard, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error updating dashboard: {e}")
    
    def _calculate_system_status(self, stats, alerts):
        """Calcula status geral do sistema"""
        critical_alerts = [a for a in alerts if a.get('severity') == 'critical']
        high_alerts = [a for a in alerts if a.get('severity') == 'high']
        
        if critical_alerts:
            return 'critical'
        elif high_alerts:
            return 'warning'
        elif any(stats.get(metric, 0) > threshold for metric, threshold in self.thresholds.items()):
            return 'warning'
        else:
            return 'healthy'
    
    def _calculate_health_score(self, stats, alerts):
        """Calcula score de saúde (0-100)"""
        base_score = 100
        
        # Penalizar por métricas altas
        for metric, threshold in self.thresholds.items():
            value = stats.get(metric, 0)
            if value > threshold:
                penalty = min(20, (value - threshold) / threshold * 10)
                base_score -= penalty
        
        # Penalizar por alertas
        critical_alerts = len([a for a in alerts if a.get('severity') == 'critical'])
        high_alerts = len([a for a in alerts if a.get('severity') == 'high'])
        
        base_score -= critical_alerts * 15
        base_score -= high_alerts * 10
        
        return max(0, int(base_score))
    
    def _format_uptime(self, seconds):
        """Formata uptime em formato legível"""
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    
    def record_request(self, method, success, response_time):
        """Registra uma requisição para métricas"""
        self.performance_stats['total_requests'] += 1
        
        if success:
            self.performance_stats['successful_requests'] += 1
            self.performance_stats['total_response_time'] += response_time
        else:
            self.performance_stats['failed_requests'] += 1
        
        # Contar por tipo de operação
        if method in ['search', 'add', 'remove', 'list', 'stats']:
            self.performance_stats[f'{method}_count'] += 1
    
    def get_current_metrics(self):
        """Retorna métricas atuais"""
        current = {}
        for metric_name, values in self.metrics.items():
            if values:
                current[metric_name] = values[-1][1]
        return current
    
    def get_alerts_summary(self):
        """Retorna resumo de alertas"""
        current_time = time.time()
        recent_alerts = [
            alert for alert in self.alerts 
            if alert['timestamp'] > current_time - 3600  # Última hora
        ]
        
        by_severity = defaultdict(int)
        for alert in recent_alerts:
            by_severity[alert.get('severity', 'unknown')] += 1
        
        return {
            'total': len(recent_alerts),
            'by_severity': dict(by_severity),
            'recent': recent_alerts[-5:] if recent_alerts else []
        }

# Instância global do coletor de métricas
metrics_collector = MetricsCollector()

def start_monitoring():
    """Inicia sistema de monitoramento"""
    metrics_collector.start_monitoring()

def stop_monitoring():
    """Para sistema de monitoramento"""
    metrics_collector.stop_monitoring()

def get_metrics():
    """Retorna métricas atuais"""
    return metrics_collector.get_current_metrics()

def get_alerts():
    """Retorna alertas atuais"""
    return metrics_collector.get_alerts_summary()

def record_request(method, success, response_time):
    """Registra requisição para métricas"""
    metrics_collector.record_request(method, success, response_time)

if __name__ == "__main__":
    # Teste standalone
    print("🔍 Iniciando sistema de monitoramento...")
    start_monitoring()
    
    try:
        while True:
            metrics = get_metrics()
            alerts = get_alerts()
            
            print(f"\n📊 Métricas atuais:")
            for key, value in metrics.items():
                print(f"  {key}: {value:.2f}")
            
            print(f"\n🚨 Alertas: {alerts['total']}")
            
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n🛑 Parando monitoramento...")
        stop_monitoring()