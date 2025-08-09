#!/usr/bin/env python3
"""
Configuração centralizada do MCP RAG Server
Carrega configurações de variáveis de ambiente com valores padrão
"""

import os
from pathlib import Path
from typing import Optional

class Config:
    """Configurações do servidor RAG"""
    
    def __init__(self):
        # Paths
        self.CACHE_PATH = Path(os.getenv('RAG_CACHE_DIR', 
                                         str(Path.home() / ".claude" / "mcp-rag-cache")))
        
        # Model settings
        self.EMBEDDING_MODEL = os.getenv('RAG_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        self.USE_EMBEDDINGS = os.getenv('RAG_USE_EMBEDDINGS', 'true').lower() == 'true'
        self.USE_TFIDF = os.getenv('RAG_USE_TFIDF', 'true').lower() == 'true'
        
        # Performance settings
        self.MAX_DOCUMENTS = int(os.getenv('RAG_MAX_DOCUMENTS', '10000'))
        self.EMBEDDING_BATCH_SIZE = int(os.getenv('RAG_EMBEDDING_BATCH_SIZE', '32'))
        self.SEARCH_LIMIT_DEFAULT = int(os.getenv('RAG_SEARCH_LIMIT_DEFAULT', '5'))
        self.SIMILARITY_THRESHOLD = float(os.getenv('RAG_SIMILARITY_THRESHOLD', '0.1'))
        
        # TF-IDF settings
        self.TFIDF_MAX_FEATURES = int(os.getenv('RAG_TFIDF_MAX_FEATURES', '1000'))
        self.TFIDF_STOP_WORDS = os.getenv('RAG_TFIDF_STOP_WORDS', 'english')
        
        # Logging settings
        self.LOG_LEVEL = os.getenv('RAG_LOG_LEVEL', 'INFO').upper()
        self.LOG_TO_STDERR = os.getenv('RAG_DEBUG', 'false').lower() == 'true'
        self.LOG_FORMAT = os.getenv('RAG_LOG_FORMAT', 
                                    '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s')
        
        # Server settings
        self.SERVER_NAME = os.getenv('RAG_SERVER_NAME', 'rag-server')
        self.SERVER_VERSION = os.getenv('RAG_SERVER_VERSION', '3.1.0')
        self.PROTOCOL_VERSION = os.getenv('RAG_PROTOCOL_VERSION', '2024-11-05')
        
        # Feature flags
        self.ENABLE_DEDUPLICATION = os.getenv('RAG_ENABLE_DEDUPLICATION', 'true').lower() == 'true'
        self.ENABLE_VERSIONING = os.getenv('RAG_ENABLE_VERSIONING', 'true').lower() == 'true'
        self.AUTO_MIGRATE_IDS = os.getenv('RAG_AUTO_MIGRATE_IDS', 'true').lower() == 'true'
        
        # Cache settings
        self.CACHE_EMBEDDINGS = os.getenv('RAG_CACHE_EMBEDDINGS', 'true').lower() == 'true'
        self.AUTO_SAVE = os.getenv('RAG_AUTO_SAVE', 'true').lower() == 'true'
        self.SAVE_STATS = os.getenv('RAG_SAVE_STATS', 'true').lower() == 'true'
        
        # Development settings
        self.DEV_MODE = os.getenv('RAG_DEV_MODE', 'false').lower() == 'true'
        self.VERBOSE = os.getenv('RAG_VERBOSE', 'false').lower() == 'true'
        
    def get_cache_file(self, filename: str) -> Path:
        """Retorna caminho completo para arquivo no cache"""
        return self.CACHE_PATH / filename
    
    def ensure_cache_dir(self) -> None:
        """Garante que o diretório de cache existe"""
        self.CACHE_PATH.mkdir(parents=True, exist_ok=True)
    
    def to_dict(self) -> dict:
        """Converte configuração para dicionário"""
        return {
            'cache_path': str(self.CACHE_PATH),
            'embedding_model': self.EMBEDDING_MODEL,
            'use_embeddings': self.USE_EMBEDDINGS,
            'use_tfidf': self.USE_TFIDF,
            'max_documents': self.MAX_DOCUMENTS,
            'embedding_batch_size': self.EMBEDDING_BATCH_SIZE,
            'search_limit_default': self.SEARCH_LIMIT_DEFAULT,
            'similarity_threshold': self.SIMILARITY_THRESHOLD,
            'tfidf_max_features': self.TFIDF_MAX_FEATURES,
            'tfidf_stop_words': self.TFIDF_STOP_WORDS,
            'log_level': self.LOG_LEVEL,
            'log_to_stderr': self.LOG_TO_STDERR,
            'server_name': self.SERVER_NAME,
            'server_version': self.SERVER_VERSION,
            'protocol_version': self.PROTOCOL_VERSION,
            'enable_deduplication': self.ENABLE_DEDUPLICATION,
            'enable_versioning': self.ENABLE_VERSIONING,
            'auto_migrate_ids': self.AUTO_MIGRATE_IDS,
            'cache_embeddings': self.CACHE_EMBEDDINGS,
            'auto_save': self.AUTO_SAVE,
            'save_stats': self.SAVE_STATS,
            'dev_mode': self.DEV_MODE,
            'verbose': self.VERBOSE
        }
    
    def __repr__(self) -> str:
        """Representação string da configuração"""
        return f"Config({self.to_dict()})"


# Instância global de configuração
config = Config()


def load_dotenv(env_file: Optional[str] = None) -> None:
    """
    Carrega variáveis de ambiente de arquivo .env
    
    Args:
        env_file: Caminho para arquivo .env (padrão: .env no diretório atual)
    """
    if env_file is None:
        env_file = '.env'
    
    env_path = Path(env_file)
    if not env_path.exists():
        return
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # Remover aspas se existirem
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    os.environ[key] = value


# Carregar .env se existir
load_dotenv()

# Recarregar config após carregar .env
config = Config()