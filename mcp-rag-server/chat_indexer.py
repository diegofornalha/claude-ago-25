#!/usr/bin/env python3
"""
Chat Indexer para MCP RAG Server
=================================
Indexa conversas do Claude armazenadas em arquivos JSONL
para torná-las pesquisáveis via MCP RAG.

Autor: Claude AI Assistant
Data: 2025-08-09
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import hashlib
import re

# Adicionar o diretório do servidor MCP ao path
sys.path.insert(0, str(Path(__file__).parent))

from rag_server import RAGServer
from config import Config

class ChatIndexer:
    """Indexador de conversas do Claude para o RAG Server"""
    
    def __init__(self):
        self.config = Config()
        self.server = RAGServer(mode='enhanced')
        self.projects_dir = Path.home() / ".claude" / "projects" / "-Users-agents--claude"
        self.indexed_cache = Path.home() / ".claude" / "mcp-rag-cache" / "indexed_chats.json"
        self.indexed_chats = self.load_indexed_cache()
        
    def load_indexed_cache(self) -> Dict[str, str]:
        """Carrega cache de conversas já indexadas"""
        if self.indexed_cache.exists():
            try:
                with open(self.indexed_cache, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_indexed_cache(self):
        """Salva cache de conversas indexadas"""
        self.indexed_cache.parent.mkdir(parents=True, exist_ok=True)
        with open(self.indexed_cache, 'w') as f:
            json.dump(self.indexed_chats, f, indent=2)
    
    def extract_chat_info(self, jsonl_path: Path) -> Optional[Dict]:
        """Extrai informações relevantes de um arquivo JSONL de conversa"""
        
        try:
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            if not lines:
                return None
            
            # Parsing das linhas JSONL
            messages = []
            for line in lines:
                try:
                    msg = json.loads(line.strip())
                    messages.append(msg)
                except:
                    continue
            
            if not messages:
                return None
            
            # Extrair informações
            session_id = messages[0].get('sessionId', '')
            first_msg = None
            last_msg = None
            tools_used = set()
            files_modified = set()
            topics = []
            
            for msg in messages:
                # Primeira mensagem do usuário
                if not first_msg and msg.get('type') == 'user':
                    user_content = msg.get('message', {}).get('content')
                    if isinstance(user_content, str):
                        first_msg = user_content[:200]
                    elif isinstance(user_content, list) and user_content:
                        first_msg = str(user_content[0].get('content', ''))[:200]
                
                # Última mensagem com timestamp
                if msg.get('timestamp'):
                    last_msg = msg
                
                # Ferramentas usadas
                if msg.get('type') == 'assistant':
                    content = msg.get('message', {}).get('content', [])
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and item.get('type') == 'tool_use':
                                tools_used.add(item.get('name', 'unknown'))
                
                # Arquivos mencionados
                if 'toolUseResult' in msg:
                    result = str(msg['toolUseResult'])
                    # Extrair caminhos de arquivo
                    paths = re.findall(r'/Users/[^\s\"\']+', result)
                    files_modified.update(paths[:10])  # Limitar a 10 arquivos
            
            # Determinar título e resumo
            title = first_msg[:100] if first_msg else f"Conversa {session_id[:8]}"
            
            # Criar resumo consolidado
            summary_parts = []
            if first_msg:
                summary_parts.append(f"Início: {first_msg}")
            if tools_used:
                summary_parts.append(f"Ferramentas: {', '.join(list(tools_used)[:5])}")
            if files_modified:
                summary_parts.append(f"Arquivos: {len(files_modified)} modificados")
            
            content = '\n'.join(summary_parts)
            
            # Timestamps
            timestamp_start = messages[0].get('timestamp', '')
            timestamp_end = last_msg.get('timestamp', '') if last_msg else timestamp_start
            
            # Tags baseadas no conteúdo
            tags = ['chat', session_id[:8]]
            tags.extend(list(tools_used)[:5])
            
            # Detectar temas comuns
            content_lower = content.lower()
            if 'rag' in content_lower or 'mcp' in content_lower:
                tags.append('rag')
            if 'todo' in content_lower:
                tags.append('todos')
            if 'git' in content_lower:
                tags.append('git')
            if 'docker' in content_lower:
                tags.append('docker')
            if 'test' in content_lower:
                tags.append('testing')
            
            return {
                'title': f"Chat: {title}",
                'content': content,
                'type': 'chat',
                'source': f'chat-{session_id}',
                'category': 'chat-history',
                'tags': tags,
                'metadata': {
                    'session_id': session_id,
                    'timestamp_start': timestamp_start,
                    'timestamp_end': timestamp_end,
                    'tools_used': list(tools_used),
                    'files_modified': list(files_modified)[:10],
                    'message_count': len(messages),
                    'file_path': str(jsonl_path)
                }
            }
            
        except Exception as e:
            print(f"Erro ao processar {jsonl_path}: {e}")
            return None
    
    def should_index(self, jsonl_path: Path) -> bool:
        """Verifica se o arquivo deve ser indexado"""
        # Calcular hash do arquivo
        file_stat = jsonl_path.stat()
        file_hash = f"{file_stat.st_size}_{file_stat.st_mtime}"
        
        session_id = jsonl_path.stem
        cached_hash = self.indexed_chats.get(session_id)
        
        # Indexar se novo ou modificado
        return cached_hash != file_hash
    
    def index_chat(self, jsonl_path: Path) -> bool:
        """Indexa uma conversa no RAG Server"""
        
        if not self.should_index(jsonl_path):
            print(f"Pular {jsonl_path.name} (já indexado)")
            return False
        
        print(f"Indexando {jsonl_path.name}...")
        
        # Extrair informações
        chat_info = self.extract_chat_info(jsonl_path)
        if not chat_info:
            print(f"  Sem conteúdo relevante")
            return False
        
        # Remover documento antigo se existir
        session_id = jsonl_path.stem
        old_docs = [d for d in self.server.documents 
                   if d.get('source') == f'chat-{session_id}']
        for doc in old_docs:
            self.server.remove_document(doc['id'])
        
        # Adicionar novo documento
        try:
            result = self.server.add_document(chat_info)
            print(f"  ✓ Indexado: {chat_info['title'][:50]}")
            
            # Atualizar cache
            file_stat = jsonl_path.stat()
            self.indexed_chats[session_id] = f"{file_stat.st_size}_{file_stat.st_mtime}"
            
            return True
        except Exception as e:
            print(f"  ✗ Erro: {e}")
            return False
    
    def index_all_chats(self):
        """Indexa todas as conversas disponíveis"""
        
        print(f"Indexando conversas de {self.projects_dir}")
        
        # Carregar documentos existentes
        self.server.load_documents()
        print(f"Documentos no cache: {len(self.server.documents)}")
        
        # Listar arquivos JSONL
        jsonl_files = list(self.projects_dir.glob("*.jsonl"))
        print(f"Conversas encontradas: {len(jsonl_files)}")
        
        # Indexar cada conversa
        indexed_count = 0
        for jsonl_path in jsonl_files:
            if self.index_chat(jsonl_path):
                indexed_count += 1
        
        # Salvar alterações
        if indexed_count > 0:
            self.server.save_documents()
            self.save_indexed_cache()
            print(f"\n✅ {indexed_count} conversas indexadas/atualizadas")
        else:
            print(f"\n✅ Todas as conversas já estavam atualizadas")
        
        # Estatísticas
        chat_docs = [d for d in self.server.documents 
                    if d.get('type') == 'chat']
        print(f"Total de conversas no cache: {len(chat_docs)}")
        print(f"Total de documentos: {len(self.server.documents)}")
    
    def search_chats(self, query: str, limit: int = 5):
        """Busca nas conversas indexadas"""
        
        self.server.load_documents()
        results = self.server.search(query, limit=limit)
        
        print(f"\nBusca por '{query}': {len(results)} resultados")
        for r in results:
            if r.get('type') == 'chat':
                metadata = r.get('metadata', {})
                print(f"\n📝 {r.get('title', 'Sem título')}")
                print(f"   Session: {metadata.get('session_id', 'unknown')[:8]}")
                print(f"   Tools: {', '.join(metadata.get('tools_used', [])[:3])}")
                print(f"   Score: {r.get('score', 0):.2f}")


def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Indexador de conversas do Claude')
    parser.add_argument('--search', type=str, help='Buscar nas conversas')
    parser.add_argument('--limit', type=int, default=5, help='Limite de resultados')
    parser.add_argument('--reindex', action='store_true', help='Reindexar todas as conversas')
    
    args = parser.parse_args()
    
    indexer = ChatIndexer()
    
    if args.search:
        indexer.search_chats(args.search, args.limit)
    elif args.reindex:
        # Limpar cache para forçar reindexação
        indexer.indexed_chats = {}
        indexer.index_all_chats()
    else:
        # Indexação padrão (apenas novos/modificados)
        indexer.index_all_chats()


if __name__ == "__main__":
    main()