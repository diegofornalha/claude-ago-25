#!/usr/bin/env python3
"""
Marvin Agent - Agente A2A para extração e análise de dados
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class MarvinAgent:
    """
    Agente Marvin compatível com protocolo A2A
    
    Este agente fornece capacidades de:
    - Análise de dados estruturados
    - Execução de tarefas
    - Assistência geral com processamento de linguagem natural
    """
    
    def __init__(self, name: str = "marvin-agent"):
        self.name = name
        self.version = "1.0.0"
        self.memory = {}
        self.capabilities = {
            "streaming": True,
            "max_concurrent_tasks": 10,
            "supports_sse": True,
            "protocol_version": "1.0"
        }
        logger.info(f"Marvin Agent '{self.name}' inicializado")
    
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa requisição A2A
        
        Args:
            request: Requisição no formato A2A
        
        Returns:
            Resposta estruturada
        """
        request_type = request.get("type", "assist")
        data = request.get("data", {})
        
        logger.info(f"Processando requisição: {request_type}")
        
        if request_type == "analyze":
            return await self._analyze_data(data)
        elif request_type == "execute":
            return await self._execute_task(data)
        elif request_type == "assist":
            return await self._assist(data)
        elif request_type == "learn":
            return await self._learn(data)
        elif request_type == "recall":
            return await self._recall(data)
        else:
            return {
                "error": f"Tipo de requisição não suportado: {request_type}",
                "supported_types": ["analyze", "execute", "assist", "learn", "recall"]
            }
    
    async def _analyze_data(self, data: Any) -> Dict[str, Any]:
        """Analisa dados fornecidos"""
        if isinstance(data, str):
            return {
                "type": "text_analysis",
                "length": len(data),
                "word_count": len(data.split()),
                "summary": data[:100] + "..." if len(data) > 100 else data
            }
        elif isinstance(data, dict):
            return {
                "type": "data_analysis",
                "keys": list(data.keys()),
                "size": len(data),
                "structure": self._analyze_structure(data)
            }
        else:
            return {
                "type": "unknown",
                "data_type": str(type(data)),
                "value": str(data)
            }
    
    async def _execute_task(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Executa uma tarefa"""
        task = data.get("task", "")
        context = data.get("context", {})
        
        return {
            "task": task,
            "status": "completed",
            "result": f"Tarefa '{task}' executada com sucesso",
            "context": context,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _assist(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fornece assistência geral"""
        query = data.get("query", "")
        
        # Simulação de assistência
        responses = {
            "hello": "Olá! Como posso ajudar?",
            "help": "Posso analisar dados, executar tarefas e fornecer assistência.",
            "status": "Sistema operacional, pronto para colaboração A2A."
        }
        
        for key, response in responses.items():
            if key in query.lower():
                return {"response": response, "query": query}
        
        return {
            "response": f"Processando consulta: {query}",
            "capabilities": ["analyze", "execute", "assist", "learn", "recall"],
            "query": query
        }
    
    async def _learn(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Aprende/memoriza informação"""
        key = data.get("key", "")
        value = data.get("value", "")
        
        if key:
            self.memory[key] = value
            return {
                "status": "learned",
                "key": key,
                "message": f"Informação '{key}' memorizada com sucesso"
            }
        return {"error": "Chave não fornecida para aprendizado"}
    
    async def _recall(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recupera informação da memória"""
        key = data.get("key", "")
        
        if key in self.memory:
            return {
                "status": "recalled",
                "key": key,
                "value": self.memory[key]
            }
        return {
            "status": "not_found",
            "key": key,
            "message": f"Informação '{key}' não encontrada na memória"
        }
    
    def _analyze_structure(self, data: Dict) -> Dict[str, Any]:
        """Analisa estrutura de dados"""
        structure = {}
        for key, value in data.items():
            if isinstance(value, dict):
                structure[key] = "object"
            elif isinstance(value, list):
                structure[key] = f"array[{len(value)}]"
            elif isinstance(value, str):
                structure[key] = "string"
            elif isinstance(value, (int, float)):
                structure[key] = "number"
            elif isinstance(value, bool):
                structure[key] = "boolean"
            else:
                structure[key] = "unknown"
        return structure
    
    def get_agent_card(self) -> Dict[str, Any]:
        """Retorna Agent Card no formato A2A"""
        return {
            "name": self.name,
            "version": self.version,
            "description": "Agente Marvin A2A para extração e análise de dados",
            "skills": [
                {
                    "name": "analyze",
                    "description": "Analisa dados e fornece insights estruturados",
                    "parameters": {
                        "data": "string|object",
                        "type": "string"
                    }
                },
                {
                    "name": "execute",
                    "description": "Executa tarefas baseadas em instruções",
                    "parameters": {
                        "task": "string",
                        "context": "object"
                    }
                },
                {
                    "name": "assist",
                    "description": "Assistência geral com processamento de linguagem natural",
                    "parameters": {
                        "query": "string"
                    }
                }
            ],
            "capabilities": self.capabilities
        }