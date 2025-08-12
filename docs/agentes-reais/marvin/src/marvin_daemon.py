#!/usr/bin/env python3
"""
Daemon para manter o Marvin Agent sempre ativo
Monitora o processo e reinicia automaticamente se necessário
"""

import os
import sys
import time
import signal
import logging
import subprocess
import socket
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

class MarvinDaemon:
    def __init__(self):
        self.marvin_dir = Path(__file__).parent.parent
        
        # Carregar variáveis de ambiente do arquivo .env
        env_file = self.marvin_dir / ".env"
        if env_file.exists():
            load_dotenv(env_file)
            
        self.log_dir = self.marvin_dir / "logs"
        self.log_dir.mkdir(exist_ok=True)
        
        self.pid_file = self.marvin_dir / "marvin.pid"
        self.daemon_pid_file = self.marvin_dir / "daemon.pid"
        self.log_file = self.log_dir / "marvin_daemon.log"
        
        # Configuração
        self.port = int(os.getenv("PORT", 9998))
        self.host = os.getenv("HOST", "localhost")
        
        self.setup_logging()
        self.marvin_process = None
        self.running = False
        
    def setup_logging(self):
        """Configura o sistema de logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger('MarvinDaemon')
        
    def is_port_in_use(self, port=None):
        """Verifica se a porta está em uso"""
        if port is None:
            port = self.port
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex((self.host, port))
                return result == 0
        except:
            return False
            
    def find_marvin_process(self):
        """Encontra o processo do Marvin"""
        try:
            # Usar lsof para verificar se a porta está sendo usada
            result = subprocess.run(['lsof', '-i', f':{self.port}'], 
                                  capture_output=True, text=True)
            if result.returncode == 0 and result.stdout:
                lines = result.stdout.strip().split('\n')
                if len(lines) > 1:  # Header + pelo menos uma linha de processo
                    # Extrair PID da segunda linha
                    fields = lines[1].split()
                    if len(fields) >= 2:
                        pid = fields[1]
                        return {'pid': int(pid)}
        except:
            pass
        return None
        
    def start_marvin(self):
        """Inicia o processo do Marvin"""
        try:
            self.logger.info(f"🚀 Iniciando Marvin na porta {self.port}...")
            
            # Verificar se já está rodando
            if self.is_port_in_use():
                process_info = self.find_marvin_process()
                if process_info:
                    self.logger.info(f"✅ Marvin já está rodando (PID: {process_info['pid']})")
                    return process_info['pid']
                    
            # Preparar comando
            server_script = self.marvin_dir / "src" / "server.py"
            
            # Verificar se deve usar uv ou python direto
            if (self.marvin_dir / ".venv").exists():
                python_cmd = str(self.marvin_dir / ".venv" / "bin" / "python")
            elif subprocess.run(["which", "uv"], capture_output=True).returncode == 0:
                python_cmd = "uv run python"
            else:
                python_cmd = sys.executable
                
            # Configurar ambiente
            env = os.environ.copy()
            env['PORT'] = str(self.port)
            env['HOST'] = self.host
            env['A2A_PORT'] = str(self.port)
            env['MARVIN_PORT'] = str(self.port)
            
            # Iniciar processo
            cmd = f"{python_cmd} {server_script}"
            self.marvin_process = subprocess.Popen(
                cmd.split(),
                cwd=str(self.marvin_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Aguardar inicialização
            time.sleep(3)
            
            # Verificar se iniciou
            if self.is_port_in_use():
                pid = self.marvin_process.pid
                with open(self.pid_file, 'w') as f:
                    f.write(str(pid))
                self.logger.info(f"✅ Marvin iniciado com sucesso (PID: {pid})")
                return pid
            else:
                self.logger.error("❌ Falha ao iniciar Marvin")
                if self.marvin_process:
                    self.marvin_process.terminate()
                return None
                
        except Exception as e:
            self.logger.error(f"❌ Erro ao iniciar Marvin: {e}")
            return None
            
    def stop_marvin(self):
        """Para o processo do Marvin"""
        try:
            self.logger.info("🛑 Parando Marvin...")
            
            # Tentar ler PID do arquivo
            if self.pid_file.exists():
                with open(self.pid_file, 'r') as f:
                    pid = int(f.read().strip())
                    
                # Parar processo
                try:
                    os.kill(pid, signal.SIGTERM)
                    time.sleep(2)
                    
                    # Forçar se ainda estiver rodando
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except:
                        pass
                        
                except ProcessLookupError:
                    pass
                    
                self.pid_file.unlink()
                
            # Limpar porta se ainda estiver em uso
            if self.is_port_in_use():
                process_info = self.find_marvin_process()
                if process_info:
                    try:
                        os.kill(process_info['pid'], signal.SIGKILL)
                    except:
                        pass
                        
            self.logger.info("✅ Marvin parado")
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao parar Marvin: {e}")
            
    def monitor(self):
        """Monitora o Marvin e reinicia se necessário"""
        self.logger.info("👁️  Iniciando monitoramento do Marvin...")
        self.logger.info(f"   Porta: {self.port}")
        self.logger.info(f"   Intervalo: 30 segundos")
        
        # Registrar handler para shutdown graceful
        signal.signal(signal.SIGTERM, self.shutdown)
        signal.signal(signal.SIGINT, self.shutdown)
        
        # Salvar PID do daemon
        with open(self.daemon_pid_file, 'w') as f:
            f.write(str(os.getpid()))
            
        self.running = True
        
        # Iniciar Marvin na primeira vez
        self.start_marvin()
        
        while self.running:
            try:
                # Verificar status
                if not self.is_port_in_use():
                    self.logger.warning("⚠️  Marvin não está respondendo, reiniciando...")
                    self.stop_marvin()
                    time.sleep(2)
                    self.start_marvin()
                else:
                    self.logger.debug("✅ Marvin está ativo")
                    
                # Aguardar próxima verificação
                time.sleep(30)
                
            except Exception as e:
                self.logger.error(f"❌ Erro no monitoramento: {e}")
                time.sleep(5)
                
    def shutdown(self, signum=None, frame=None):
        """Shutdown graceful do daemon"""
        self.logger.info("🛑 Encerrando daemon...")
        self.running = False
        self.stop_marvin()
        
        if self.daemon_pid_file.exists():
            self.daemon_pid_file.unlink()
            
        self.logger.info("✅ Daemon encerrado")
        sys.exit(0)
        
    def status(self):
        """Mostra o status do Marvin e do daemon"""
        print("📊 Status do Sistema Marvin")
        print("=" * 50)
        
        # Status do daemon
        daemon_running = False
        if self.daemon_pid_file.exists():
            try:
                with open(self.daemon_pid_file, 'r') as f:
                    daemon_pid = int(f.read().strip())
                # Verificar se o processo existe
                os.kill(daemon_pid, 0)
                daemon_running = True
                print(f"✅ Daemon: Rodando (PID: {daemon_pid})")
            except:
                print("❌ Daemon: Parado (arquivo PID órfão)")
        else:
            print("❌ Daemon: Parado")
            
        # Status do Marvin
        if self.is_port_in_use():
            process_info = self.find_marvin_process()
            if process_info:
                print(f"✅ Marvin: Rodando (PID: {process_info['pid']})")
                print(f"   Porta: {self.port}")
                print(f"   URL: http://{self.host}:{self.port}")
            else:
                print(f"⚠️  Marvin: Porta {self.port} em uso (processo desconhecido)")
        else:
            print(f"❌ Marvin: Parado")
            
        print("=" * 50)
        
        # Mostrar logs recentes
        if self.log_file.exists():
            print("\n📋 Últimas linhas do log:")
            print("-" * 50)
            try:
                with open(self.log_file, 'r') as f:
                    lines = f.readlines()
                    for line in lines[-5:]:
                        print(line.strip())
            except:
                print("Não foi possível ler os logs")
                
def main():
    """Função principal do daemon"""
    if len(sys.argv) < 2:
        print("Uso: marvin_daemon.py [start|stop|restart|status]")
        sys.exit(1)
        
    daemon = MarvinDaemon()
    command = sys.argv[1].lower()
    
    if command == "start":
        print("🚀 Iniciando daemon do Marvin...")
        daemon.monitor()
        
    elif command == "stop":
        print("🛑 Parando daemon do Marvin...")
        daemon.stop_marvin()
        if daemon.daemon_pid_file.exists():
            with open(daemon.daemon_pid_file, 'r') as f:
                daemon_pid = int(f.read().strip())
            try:
                os.kill(daemon_pid, signal.SIGTERM)
                print("✅ Daemon parado")
            except:
                print("⚠️  Daemon não estava rodando")
            daemon.daemon_pid_file.unlink()
            
    elif command == "restart":
        print("🔄 Reiniciando daemon do Marvin...")
        # Parar
        if daemon.daemon_pid_file.exists():
            with open(daemon.daemon_pid_file, 'r') as f:
                daemon_pid = int(f.read().strip())
            try:
                os.kill(daemon_pid, signal.SIGTERM)
                time.sleep(2)
            except:
                pass
        # Iniciar
        daemon.monitor()
        
    elif command == "status":
        daemon.status()
        
    else:
        print(f"Comando desconhecido: {command}")
        print("Uso: marvin_daemon.py [start|stop|restart|status]")
        sys.exit(1)

if __name__ == "__main__":
    main()