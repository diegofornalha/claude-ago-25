#!/usr/bin/env python3
"""
MCP Client para integração com RAG Server
Conecta o agente A2A ao servidor RAG via MCP protocol
"""

import json
import asyncio
import aiohttp
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class MCPConfig:
    """Configuração do MCP Server"""
    host: str = "localhost"
    port: int = 3000
    timeout: int = 30

class MCPRAGClient:
    """Cliente para comunicação com RAG Server via MCP"""
    
    def __init__(self, config: Optional[MCPConfig] = None):
        self.config = config or MCPConfig()
        self.base_url = f"http://{self.config.host}:{self.config.port}"
        self.session = None
        
    async def __aenter__(self):
        """Inicializa sessão assíncrona"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.timeout)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Fecha sessão assíncrona"""
        if self.session:
            await self.session.close()
    
    async def _make_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Faz requisição JSON-RPC ao MCP Server"""
        if not self.session:
            self.session = aiohttp.ClientSession()
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/rpc",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                result = await response.json()
                
                if "error" in result:
                    logger.error(f"MCP Error: {result['error']}")
                    raise Exception(f"MCP Error: {result['error']}")
                
                return result.get("result", {})
                
        except aiohttp.ClientError as e:
            logger.error(f"Connection error to MCP Server: {e}")
            # Fallback para dados simulados se MCP não estiver disponível
            return self._get_fallback_response(method, params)
    
    def _get_fallback_response(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Retorna resposta simulada quando MCP não está disponível"""
        logger.warning("MCP Server não disponível, usando dados simulados")
        
        if method == "search":
            return {
                "results": [{
                    "title": "Resposta Simulada",
                    "content": f"Resultado simulado para query: {params.get('query', '')}",
                    "score": 0.75,
                    "source": "fallback",
                    "tags": ["simulated"],
                    "category": "fallback"
                }],
                "total": 1,
                "query": params.get("query", ""),
                "server_mode": "fallback"
            }
        elif method == "add":
            return {
                "success": True,
                "id": "simulated-doc-id",
                "message": "Documento simulado adicionado (MCP offline)"
            }
        elif method == "stats":
            return {
                "total_documents": 0,
                "total_categories": 0,
                "total_tags": 0,
                "server_mode": "fallback",
                "message": "MCP Server offline - estatísticas não disponíveis"
            }
        else:
            return {"error": "Método não suportado no modo fallback"}
    
    async def search(self, 
                    query: str, 
                    use_semantic: bool = True,
                    limit: int = 5) -> Dict[str, Any]:
        """
        Busca documentos no RAG Server
        
        Args:
            query: Termo ou pergunta para buscar
            use_semantic: Usar busca semântica (True) ou textual (False)
            limit: Número máximo de resultados
            
        Returns:
            Dict com resultados da busca
        """
        params = {
            "query": query,
            "use_semantic": use_semantic,
            "limit": limit
        }
        
        try:
            result = await self._make_request("search", params)
            
            # Formatar resposta para o padrão A2A
            formatted_results = []
            for item in result.get("results", []):
                formatted_results.append({
                    "title": item.get("title", "Sem título"),
                    "content": item.get("content", ""),
                    "score": item.get("score", 0),
                    "source": item.get("source", "rag"),
                    "tags": item.get("tags", []),
                    "category": item.get("category", "general"),
                    "id": item.get("id", ""),
                    "metadata": {
                        "created_at": item.get("created_at"),
                        "updated_at": item.get("updated_at"),
                        "version": item.get("version", 1)
                    }
                })
            
            return {
                "query": query,
                "results": formatted_results,
                "total": result.get("total", len(formatted_results)),
                "search_type": "semantic" if use_semantic else "text",
                "server_mode": result.get("server_mode", "unknown")
            }
            
        except Exception as e:
            logger.error(f"Erro na busca: {e}")
            return self._get_fallback_response("search", params)
    
    async def search_by_tags(self, tags: List[str], limit: int = 10) -> Dict[str, Any]:
        """Busca documentos por tags"""
        params = {
            "tags": tags,
            "limit": limit
        }
        
        return await self._make_request("search_by_tags", params)
    
    async def search_by_category(self, category: str, limit: int = 10) -> Dict[str, Any]:
        """Busca documentos por categoria"""
        params = {
            "category": category,
            "limit": limit
        }
        
        return await self._make_request("search_by_category", params)
    
    async def add_document(self,
                          title: str,
                          content: str,
                          tags: Optional[List[str]] = None,
                          category: Optional[str] = None,
                          source: Optional[str] = None,
                          doc_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Adiciona documento ao RAG Server
        
        Args:
            title: Título do documento
            content: Conteúdo do documento
            tags: Lista de tags
            category: Categoria do documento
            source: Fonte do documento
            doc_type: Tipo do documento
            
        Returns:
            Dict com resultado da operação
        """
        params = {
            "title": title,
            "content": content,
            "tags": tags or [],
            "category": category or "general",
            "source": source or "a2a-agent",
            "type": doc_type or "text"
        }
        
        try:
            result = await self._make_request("add", params)
            
            return {
                "success": result.get("success", False),
                "document_id": result.get("id", ""),
                "message": result.get("message", "Documento adicionado"),
                "title": title,
                "tags": tags or [],
                "category": category or "general"
            }
            
        except Exception as e:
            logger.error(f"Erro ao adicionar documento: {e}")
            return self._get_fallback_response("add", params)
    
    async def update_document(self,
                            doc_id: str,
                            title: Optional[str] = None,
                            content: Optional[str] = None,
                            tags: Optional[List[str]] = None,
                            category: Optional[str] = None) -> Dict[str, Any]:
        """Atualiza documento existente"""
        params = {
            "id": doc_id,
            "title": title,
            "content": content,
            "tags": tags,
            "category": category
        }
        
        # Remove campos None
        params = {k: v for k, v in params.items() if v is not None}
        
        return await self._make_request("update", params)
    
    async def remove_document(self, doc_id: str) -> Dict[str, Any]:
        """Remove documento do RAG Server"""
        params = {"id": doc_id}
        return await self._make_request("remove", params)
    
    async def list_documents(self,
                            category: Optional[str] = None,
                            source: Optional[str] = None,
                            tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """Lista documentos com filtros opcionais"""
        params = {}
        
        if category:
            params["category"] = category
        if source:
            params["source"] = source
        if tags:
            params["tags"] = tags
        
        return await self._make_request("list", params)
    
    async def get_statistics(self) -> Dict[str, Any]:
        """
        Obtém estatísticas do RAG Server
        
        Returns:
            Dict com estatísticas detalhadas
        """
        try:
            result = await self._make_request("stats", {})
            
            # Formatar estatísticas para o padrão A2A
            stats = {
                "total_documents": result.get("total_documents", 0),
                "total_categories": result.get("total_categories", 0),
                "total_tags": result.get("total_tags", 0),
                "storage_used_mb": result.get("storage_used_mb", 0),
                "server_version": result.get("server_version", "unknown"),
                "server_mode": result.get("server_mode", "unknown"),
                "last_update": result.get("last_update"),
                "top_categories": [],
                "top_tags": []
            }
            
            # Processar categorias
            if "categories" in result:
                for cat, count in list(result["categories"].items())[:5]:
                    stats["top_categories"].append({
                        "name": cat,
                        "count": count
                    })
            
            # Processar tags
            if "tags" in result:
                for tag, count in list(result["tags"].items())[:10]:
                    stats["top_tags"].append({
                        "name": tag,
                        "count": count
                    })
            
            return stats
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {e}")
            return self._get_fallback_response("stats", {})

# Cliente singleton para reutilização
_mcp_client = None

async def get_mcp_client() -> MCPRAGClient:
    """Obtém instância singleton do cliente MCP"""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPRAGClient()
    return _mcp_client

# Testes do cliente
if __name__ == "__main__":
    async def test_client():
        """Testa conexão com RAG Server"""
        async with MCPRAGClient() as client:
            # Testar busca
            print("Testando busca...")
            result = await client.search("A2A protocol", use_semantic=True)
            print(f"Busca: {json.dumps(result, indent=2)}")
            
            # Testar adição
            print("\nTestando adição...")
            result = await client.add_document(
                title="Teste MCP",
                content="Documento de teste via MCP",
                tags=["test", "mcp"],
                category="testing"
            )
            print(f"Adição: {json.dumps(result, indent=2)}")
            
            # Testar estatísticas
            print("\nTestando estatísticas...")
            result = await client.get_statistics()
            print(f"Stats: {json.dumps(result, indent=2)}")
    
    asyncio.run(test_client())