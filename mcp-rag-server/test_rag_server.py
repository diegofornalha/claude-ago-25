#!/usr/bin/env python3
"""
Suite de testes completa para o MCP RAG Server v3
Executa com: pytest test_rag_server.py -v
"""

import pytest
import json
import sys
import os
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import uuid
import time

# Adicionar diretório ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Importar módulos do servidor
from config import Config
import rag_server


class TestConfig:
    """Testes para configuração"""
    
    def test_default_config(self):
        """Testa configuração padrão"""
        config = Config()
        assert config.SERVER_NAME == 'rag-server-v2'
        assert config.SERVER_VERSION == '3.0.0'
        assert config.USE_EMBEDDINGS == True
        assert config.MAX_DOCUMENTS == 10000
    
    def test_env_override(self):
        """Testa sobrescrita via environment variables"""
        with patch.dict(os.environ, {'RAG_SERVER_NAME': 'test-server'}):
            config = Config()
            assert config.SERVER_NAME == 'test-server'
    
    def test_cache_path(self):
        """Testa caminho do cache"""
        config = Config()
        cache_file = config.get_cache_file('test.json')
        assert 'mcp-rag-cache' in str(cache_file)
        assert cache_file.name == 'test.json'


class TestRAGServer:
    """Testes para o servidor RAG"""
    
    @pytest.fixture
    def temp_cache_dir(self):
        """Cria diretório temporário para cache"""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def mock_server(self, temp_cache_dir):
        """Cria instância mock do servidor"""
        with patch('rag_server.CACHE_PATH', temp_cache_dir):
            with patch('rag_server.CACHE_FILE', temp_cache_dir / 'documents.json'):
                with patch('rag_server.VECTORS_FILE', temp_cache_dir / 'vectors.npy'):
                    server = rag_server.RAGServer()
                    yield server
    
    def test_server_initialization(self, mock_server):
        """Testa inicialização do servidor"""
        assert mock_server is not None
        assert isinstance(mock_server.documents, list)
        assert hasattr(mock_server, 'add_document')
        assert hasattr(mock_server, 'search')
    
    def test_add_document(self, mock_server):
        """Testa adição de documento"""
        doc = {
            'title': 'Test Document',
            'content': 'This is a test document content',
            'tags': ['test', 'unittest'],
            'category': 'testing'
        }
        
        result = mock_server.add_document(doc)
        assert 'id' in result
        assert result['title'] == 'Test Document'
        assert len(mock_server.documents) == 1
    
    def test_uuid_generation(self, mock_server):
        """Testa geração de UUID4"""
        doc = {'title': 'UUID Test', 'content': 'Test content'}
        result = mock_server.add_document(doc)
        
        # Verificar se é um UUID válido
        try:
            uuid.UUID(result['id'])
            assert True
        except ValueError:
            assert False, f"ID não é UUID válido: {result['id']}"
    
    def test_deduplication(self, mock_server):
        """Testa deduplicação de documentos"""
        doc1 = {'title': 'Duplicate', 'content': 'Same content'}
        doc2 = {'title': 'Duplicate 2', 'content': 'Same content'}
        
        mock_server.add_document(doc1)
        result = mock_server.add_document(doc2)
        
        # Com deduplicação, deve haver apenas 1 documento
        if hasattr(mock_server, 'config') and mock_server.config.ENABLE_DEDUPLICATION:
            assert len(mock_server.documents) == 1
            assert result.get('version', 1) > 1
    
    def test_search_basic(self, mock_server):
        """Testa busca básica"""
        # Adicionar documentos de teste
        docs = [
            {'title': 'Python Guide', 'content': 'Python programming language'},
            {'title': 'JavaScript Tutorial', 'content': 'JavaScript for beginners'},
            {'title': 'Python Advanced', 'content': 'Advanced Python concepts'}
        ]
        
        for doc in docs:
            mock_server.add_document(doc)
        
        # Buscar por "Python"
        results = mock_server.search('Python', limit=5)
        assert len(results) >= 2
        
        # Verificar que resultados contêm "Python"
        for result in results[:2]:
            assert 'Python' in result.get('title', '') or 'Python' in result.get('content', '')
    
    def test_search_by_tags(self, mock_server):
        """Testa busca por tags"""
        # Adicionar documentos com tags
        docs = [
            {'title': 'Doc1', 'content': 'Content1', 'tags': ['python', 'tutorial']},
            {'title': 'Doc2', 'content': 'Content2', 'tags': ['javascript', 'web']},
            {'title': 'Doc3', 'content': 'Content3', 'tags': ['python', 'web']}
        ]
        
        for doc in docs:
            mock_server.add_document(doc)
        
        # Buscar por tag "python"
        if hasattr(mock_server, 'search_by_tags'):
            results = mock_server.search_by_tags(['python'])
            assert len(results) == 2
    
    def test_remove_document(self, mock_server):
        """Testa remoção de documento"""
        doc = {'title': 'To Remove', 'content': 'This will be removed'}
        result = mock_server.add_document(doc)
        doc_id = result['id']
        
        # Remover documento
        removed = mock_server.remove_document(doc_id)
        assert removed == True
        assert len(mock_server.documents) == 0
    
    def test_update_document(self, mock_server):
        """Testa atualização de documento"""
        doc = {'title': 'Original', 'content': 'Original content'}
        result = mock_server.add_document(doc)
        doc_id = result['id']
        
        # Atualizar documento
        if hasattr(mock_server, 'update_document'):
            updated = mock_server.update_document(doc_id, {
                'title': 'Updated Title',
                'content': 'Updated content'
            })
            assert updated == True
            
            # Verificar atualização
            doc = mock_server.documents[0]
            assert doc['title'] == 'Updated Title'
    
    def test_stats(self, mock_server):
        """Testa estatísticas"""
        # Adicionar alguns documentos
        for i in range(5):
            mock_server.add_document({
                'title': f'Doc {i}',
                'content': f'Content {i}',
                'tags': ['test'] if i % 2 == 0 else ['other']
            })
        
        stats = mock_server.get_stats()
        assert stats['total_documents'] == 5
        assert 'unique_tags' in stats
        assert stats['unique_tags'] >= 2


class TestMCPProtocol:
    """Testes para protocolo MCP"""
    
    def test_handle_initialize(self):
        """Testa método initialize"""
        request = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {'capabilities': {}}
        }
        
        response = rag_server.handle_request(request)
        assert 'protocolVersion' in response
        assert 'capabilities' in response
        assert 'serverInfo' in response
    
    def test_handle_tools_list(self):
        """Testa listagem de ferramentas"""
        request = {
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/list',
            'params': {}
        }
        
        response = rag_server.handle_request(request)
        assert 'tools' in response
        assert len(response['tools']) >= 5  # Mínimo de 5 ferramentas
        
        # Verificar ferramentas essenciais
        tool_names = [tool['name'] for tool in response['tools']]
        assert 'search' in tool_names
        assert 'add' in tool_names
        assert 'remove' in tool_names
        assert 'list' in tool_names
        assert 'stats' in tool_names
    
    def test_handle_tools_call_add(self):
        """Testa chamada de ferramenta add"""
        request = {
            'jsonrpc': '2.0',
            'id': 3,
            'method': 'tools/call',
            'params': {
                'name': 'add',
                'arguments': {
                    'title': 'Test MCP Doc',
                    'content': 'MCP test content',
                    'tags': ['mcp', 'test']
                }
            }
        }
        
        with patch('rag_server.server') as mock_server:
            mock_server.add_document.return_value = {
                'id': 'test-id',
                'title': 'Test MCP Doc'
            }
            
            response = rag_server.handle_request(request)
            assert 'content' in response
            assert response['content'][0]['type'] == 'text'
    
    def test_handle_invalid_method(self):
        """Testa método inválido"""
        request = {
            'jsonrpc': '2.0',
            'id': 4,
            'method': 'invalid/method',
            'params': {}
        }
        
        response = rag_server.handle_request(request)
        assert 'error' in response
        assert 'Method not found' in response['error']['message']
    
    def test_handle_tools_call_search(self):
        """Testa chamada de ferramenta search"""
        request = {
            'jsonrpc': '2.0',
            'id': 5,
            'method': 'tools/call',
            'params': {
                'name': 'search',
                'arguments': {
                    'query': 'test query',
                    'limit': 5
                }
            }
        }
        
        with patch('rag_server.server') as mock_server:
            mock_server.search.return_value = [
                {'id': '1', 'title': 'Result 1', 'score': 0.9},
                {'id': '2', 'title': 'Result 2', 'score': 0.8}
            ]
            
            response = rag_server.handle_request(request)
            assert 'content' in response
            result_text = response['content'][0]['text']
            result_data = json.loads(result_text)
            assert len(result_data['results']) == 2


class TestIntegration:
    """Testes de integração"""
    
    @pytest.fixture
    def server_process(self):
        """Simula processo do servidor"""
        # Este teste seria para integração real
        # Por enquanto, apenas verificamos importação
        import rag_server
        assert rag_server is not None
        yield None
    
    def test_end_to_end_workflow(self):
        """Testa fluxo completo de operações"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Configurar cache temporário
            with patch('rag_server.CACHE_PATH', temp_path):
                with patch('rag_server.CACHE_FILE', temp_path / 'documents.json'):
                    server = rag_server.RAGServer()
                    
                    # 1. Adicionar documentos
                    doc1_id = server.add_document({
                        'title': 'First Doc',
                        'content': 'First document content',
                        'tags': ['first', 'test']
                    })['id']
                    
                    doc2_id = server.add_document({
                        'title': 'Second Doc',
                        'content': 'Second document content',
                        'tags': ['second', 'test']
                    })['id']
                    
                    # 2. Buscar documentos
                    results = server.search('document')
                    assert len(results) >= 2
                    
                    # 3. Obter estatísticas
                    stats = server.get_stats()
                    assert stats['total_documents'] == 2
                    
                    # 4. Remover um documento
                    server.remove_document(doc1_id)
                    
                    # 5. Verificar remoção
                    stats = server.get_stats()
                    assert stats['total_documents'] == 1
    
    def test_persistence(self):
        """Testa persistência de dados"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            cache_file = temp_path / 'documents.json'
            
            # Primeira instância - adicionar dados
            with patch('rag_server.CACHE_PATH', temp_path):
                with patch('rag_server.CACHE_FILE', cache_file):
                    server1 = rag_server.RAGServer()
                    server1.add_document({
                        'title': 'Persistent Doc',
                        'content': 'This should persist'
                    })
                    server1.save_documents()
            
            # Segunda instância - verificar dados
            with patch('rag_server.CACHE_PATH', temp_path):
                with patch('rag_server.CACHE_FILE', cache_file):
                    server2 = rag_server.RAGServer()
                    assert len(server2.documents) == 1
                    assert server2.documents[0]['title'] == 'Persistent Doc'


# Configuração do pytest
if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])