#!/usr/bin/env python3
"""
Sistema de Backup Automático - MCP RAG Server
Backup completo com cronograma, compressão e restauração
"""
import os
import json
import time
import shutil
import gzip
import tarfile
import threading
import schedule
from pathlib import Path
from datetime import datetime, timedelta
import logging

# Configuração
BASE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
BACKUP_BASE_PATH = BASE_PATH / "backups"
LOG_FILE = BASE_PATH / "backup.log"

class BackupSystem:
    """Sistema completo de backup automático"""
    
    def __init__(self):
        self.setup_logging()
        self.running = False
        self.thread = None
        
        # Configuração de backup
        self.config = {
            'hourly_retention': 24,     # Manter 24 backups de hora em hora
            'daily_retention': 30,      # Manter 30 backups diários
            'weekly_retention': 12,     # Manter 12 backups semanais
            'monthly_retention': 12,    # Manter 12 backups mensais
            'compression': True,        # Usar compressão gzip
            'max_backup_size_mb': 100   # Alertar se backup > 100MB
        }
        
        # Criar diretórios de backup
        self.create_backup_directories()
        
        # Configurar agendamentos
        self.setup_schedule()
        
        self.logger.info("Backup System initialized")
    
    def setup_logging(self):
        """Configura sistema de logs"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("backup-system")
    
    def create_backup_directories(self):
        """Cria estrutura de diretórios para backups"""
        directories = ['hourly', 'daily', 'weekly', 'monthly', 'manual']
        
        for directory in directories:
            backup_dir = BACKUP_BASE_PATH / directory
            backup_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.info("Backup directories created")
    
    def setup_schedule(self):
        """Configura cronograma de backups automáticos"""
        # Backup de hora em hora
        schedule.every().hour.at(":00").do(self.create_hourly_backup)
        
        # Backup diário às 02:00
        schedule.every().day.at("02:00").do(self.create_daily_backup)
        
        # Backup semanal aos domingos às 03:00
        schedule.every().sunday.at("03:00").do(self.create_weekly_backup)
        
        # Backup mensal no primeiro dia de cada mês às 04:00
        schedule.every().day.at("04:00").do(self._check_monthly_backup)
        
        # Limpeza de backups antigos diariamente às 05:00
        schedule.every().day.at("05:00").do(self.cleanup_old_backups)
        
        self.logger.info("Backup schedule configured")
    
    def start_backup_service(self):
        """Inicia serviço de backup automático"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._backup_loop, daemon=True)
        self.thread.start()
        self.logger.info("Backup service started")
    
    def stop_backup_service(self):
        """Para serviço de backup"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self.logger.info("Backup service stopped")
    
    def _backup_loop(self):
        """Loop principal do serviço de backup"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Verificar a cada minuto
            except Exception as e:
                self.logger.error(f"Error in backup loop: {e}")
                time.sleep(300)  # Aguardar 5 minutos em caso de erro
    
    def create_backup(self, backup_type="manual", include_logs=True):
        """Cria backup completo dos dados"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"rag_backup_{backup_type}_{timestamp}"
            
            if self.config['compression']:
                backup_file = BACKUP_BASE_PATH / backup_type / f"{backup_name}.tar.gz"
            else:
                backup_file = BACKUP_BASE_PATH / backup_type / f"{backup_name}.tar"
            
            self.logger.info(f"Creating {backup_type} backup: {backup_file}")
            
            # Criar arquivo tar
            mode = 'w:gz' if self.config['compression'] else 'w'
            with tarfile.open(backup_file, mode) as tar:
                # Adicionar cache principal
                cache_file = BASE_PATH / "documents.json"
                if cache_file.exists():
                    tar.add(cache_file, arcname="documents.json")
                
                # Adicionar índices
                for index_file in ["index.pkl", "vectors.npy"]:
                    file_path = BASE_PATH / index_file
                    if file_path.exists():
                        tar.add(file_path, arcname=index_file)
                
                # Adicionar logs se solicitado
                if include_logs:
                    for log_file in BASE_PATH.glob("*.log"):
                        tar.add(log_file, arcname=f"logs/{log_file.name}")
                
                # Adicionar configurações
                config_files = ["urls_to_index.json"]
                for config_file in config_files:
                    file_path = BASE_PATH / config_file
                    if file_path.exists():
                        tar.add(file_path, arcname=f"config/{config_file}")
            
            # Verificar tamanho do backup
            backup_size_mb = backup_file.stat().st_size / 1024 / 1024
            if backup_size_mb > self.config['max_backup_size_mb']:
                self.logger.warning(f"Backup size ({backup_size_mb:.1f}MB) exceeds threshold")
            
            # Criar metadados do backup
            metadata = {
                'timestamp': timestamp,
                'type': backup_type,
                'size_bytes': backup_file.stat().st_size,
                'size_mb': backup_size_mb,
                'compression': self.config['compression'],
                'files_included': self._get_backup_contents(backup_file),
                'created_at': datetime.now().isoformat()
            }
            
            metadata_file = backup_file.with_suffix('.json')
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            self.logger.info(f"Backup created successfully: {backup_size_mb:.1f}MB")
            return backup_file
            
        except Exception as e:
            self.logger.error(f"Error creating backup: {e}")
            return None
    
    def _get_backup_contents(self, backup_file):
        """Lista conteúdo do backup"""
        try:
            mode = 'r:gz' if backup_file.suffix == '.gz' else 'r'
            with tarfile.open(backup_file, mode) as tar:
                return [member.name for member in tar.getmembers()]
        except:
            return []
    
    def create_hourly_backup(self):
        """Cria backup de hora em hora"""
        self.create_backup("hourly", include_logs=False)
        self.cleanup_old_backups("hourly", self.config['hourly_retention'])
    
    def create_daily_backup(self):
        """Cria backup diário"""
        self.create_backup("daily", include_logs=True)
        self.cleanup_old_backups("daily", self.config['daily_retention'])
    
    def create_weekly_backup(self):
        """Cria backup semanal"""
        self.create_backup("weekly", include_logs=True)
        self.cleanup_old_backups("weekly", self.config['weekly_retention'])
    
    def _check_monthly_backup(self):
        """Verifica se deve criar backup mensal (dia 1 do mês)"""
        if datetime.now().day == 1:
            self.create_monthly_backup()
    
    def create_monthly_backup(self):
        """Cria backup mensal"""
        self.create_backup("monthly", include_logs=True)
        self.cleanup_old_backups("monthly", self.config['monthly_retention'])
    
    def cleanup_old_backups(self, backup_type=None, retention_count=None):
        """Remove backups antigos baseado na política de retenção"""
        if backup_type:
            backup_types = [backup_type]
        else:
            backup_types = ['hourly', 'daily', 'weekly', 'monthly']
        
        for btype in backup_types:
            backup_dir = BACKUP_BASE_PATH / btype
            if not backup_dir.exists():
                continue
            
            # Obter política de retenção
            if retention_count is None:
                retention_count = self.config.get(f'{btype}_retention', 30)
            
            # Listar backups ordenados por data (mais antigos primeiro)
            backup_files = sorted(
                backup_dir.glob("rag_backup_*.tar*"),
                key=lambda x: x.stat().st_mtime
            )
            
            # Remover excesso de backups
            if len(backup_files) > retention_count:
                files_to_remove = backup_files[:-retention_count]
                
                for backup_file in files_to_remove:
                    try:
                        # Remover arquivo de backup
                        backup_file.unlink()
                        
                        # Remover metadados associados
                        metadata_file = backup_file.with_suffix('.json')
                        if metadata_file.exists():
                            metadata_file.unlink()
                        
                        self.logger.info(f"Removed old backup: {backup_file.name}")
                        
                    except Exception as e:
                        self.logger.error(f"Error removing backup {backup_file}: {e}")
    
    def restore_backup(self, backup_file, target_dir=None):
        """Restaura backup"""
        try:
            if target_dir is None:
                target_dir = BASE_PATH
            
            target_path = Path(target_dir)
            backup_path = Path(backup_file)
            
            if not backup_path.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            self.logger.info(f"Restoring backup: {backup_path}")
            
            # Criar backup do estado atual antes de restaurar
            current_backup = self.create_backup("pre_restore")
            
            # Extrair backup
            mode = 'r:gz' if backup_path.suffix == '.gz' else 'r'
            with tarfile.open(backup_path, mode) as tar:
                tar.extractall(target_path)
            
            self.logger.info(f"Backup restored successfully to: {target_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error restoring backup: {e}")
            return False
    
    def list_backups(self, backup_type=None):
        """Lista backups disponíveis"""
        backups = []
        
        if backup_type:
            backup_types = [backup_type]
        else:
            backup_types = ['hourly', 'daily', 'weekly', 'monthly', 'manual']
        
        for btype in backup_types:
            backup_dir = BACKUP_BASE_PATH / btype
            if not backup_dir.exists():
                continue
            
            for backup_file in backup_dir.glob("rag_backup_*.tar*"):
                metadata_file = backup_file.with_suffix('.json')
                
                # Carregar metadados se existir
                metadata = {}
                if metadata_file.exists():
                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                    except:
                        pass
                
                # Informações básicas do arquivo
                stat_info = backup_file.stat()
                
                backup_info = {
                    'file': str(backup_file),
                    'type': btype,
                    'size_mb': stat_info.st_size / 1024 / 1024,
                    'created': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                    'metadata': metadata
                }
                
                backups.append(backup_info)
        
        # Ordenar por data de criação (mais recente primeiro)
        backups.sort(key=lambda x: x['created'], reverse=True)
        return backups
    
    def get_backup_stats(self):
        """Retorna estatísticas dos backups"""
        backups = self.list_backups()
        
        stats = {
            'total_backups': len(backups),
            'total_size_mb': sum(b['size_mb'] for b in backups),
            'by_type': {},
            'oldest_backup': None,
            'newest_backup': None,
            'backup_health': 'good'
        }
        
        # Estatísticas por tipo
        for backup_type in ['hourly', 'daily', 'weekly', 'monthly', 'manual']:
            type_backups = [b for b in backups if b['type'] == backup_type]
            stats['by_type'][backup_type] = {
                'count': len(type_backups),
                'size_mb': sum(b['size_mb'] for b in type_backups)
            }
        
        # Backup mais antigo e mais novo
        if backups:
            stats['oldest_backup'] = min(backups, key=lambda x: x['created'])['created']
            stats['newest_backup'] = max(backups, key=lambda x: x['created'])['created']
            
            # Verificar saúde dos backups
            newest_time = datetime.fromisoformat(stats['newest_backup'])
            if datetime.now() - newest_time > timedelta(hours=2):
                stats['backup_health'] = 'warning'
            if datetime.now() - newest_time > timedelta(hours=6):
                stats['backup_health'] = 'critical'
        
        return stats

# Instância global
backup_system = BackupSystem()

def start_backup_service():
    """Inicia serviço de backup"""
    backup_system.start_backup_service()

def stop_backup_service():
    """Para serviço de backup"""
    backup_system.stop_backup_service()

def create_manual_backup():
    """Cria backup manual"""
    return backup_system.create_backup("manual")

def list_backups(backup_type=None):
    """Lista backups disponíveis"""
    return backup_system.list_backups(backup_type)

def restore_backup(backup_file):
    """Restaura backup"""
    return backup_system.restore_backup(backup_file)

def get_backup_stats():
    """Retorna estatísticas dos backups"""
    return backup_system.get_backup_stats()

if __name__ == "__main__":
    # Teste standalone
    print("💾 Sistema de Backup MCP RAG")
    print("=" * 40)
    
    # Criar backup manual de teste
    print("Criando backup manual...")
    backup_file = create_manual_backup()
    
    if backup_file:
        print(f"✅ Backup criado: {backup_file}")
        
        # Listar backups
        print("\n📋 Backups disponíveis:")
        for backup in list_backups():
            print(f"  - {backup['type']}: {backup['size_mb']:.1f}MB ({backup['created']})")
        
        # Estatísticas
        print("\n📊 Estatísticas:")
        stats = get_backup_stats()
        print(f"  Total: {stats['total_backups']} backups, {stats['total_size_mb']:.1f}MB")
        print(f"  Saúde: {stats['backup_health']}")
    else:
        print("❌ Erro ao criar backup")