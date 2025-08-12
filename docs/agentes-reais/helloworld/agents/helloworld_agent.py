#!/usr/bin/env python3
"""
HelloWorld Agent - Agente A2A para saudações e demonstrações
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class HelloWorldAgent:
    """
    Agente HelloWorld compatível com protocolo A2A
    
    Este agente fornece capacidades de:
    - Saudações em múltiplos idiomas
    - Demonstrações do protocolo A2A
    - Respostas contextuais inteligentes
    """
    
    def __init__(self, name: str = "helloworld-agent"):
        self.name = name
        self.version = "1.0.0"
        self.memory = {}
        self.capabilities = {
            "streaming": False,
            "max_concurrent_tasks": 5,
            "supports_sse": False,
            "protocol_version": "1.0"
        }
        self.supported_languages = [
            "português", "english", "español", "français", 
            "deutsch", "italiano", "日本語", "中文"
        ]
        logger.info(f"HelloWorld Agent '{self.name}' inicializado")
    
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa requisição A2A
        
        Args:
            request: Requisição no formato A2A
        
        Returns:
            Resposta estruturada
        """
        request_type = request.get("type", "hello_world")
        data = request.get("data", {})
        
        logger.info(f"Processando requisição: {request_type}")
        
        if request_type == "hello_world":
            return await self._hello_world(data)
        elif request_type == "super_hello_world":
            return await self._super_hello_world(data)
        elif request_type == "discover":
            return await self._discover()
        elif request_type == "health":
            return await self._health()
        elif request_type == "communicate":
            return await self._communicate(data)
        elif request_type == "delegate":
            return await self._delegate(data)
        else:
            return {
                "error": f"Tipo de requisição não suportado: {request_type}",
                "supported_types": ["hello_world", "super_hello_world", "discover", "health", "communicate", "delegate"]
            }
    
    async def _hello_world(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Saudação simples"""
        name = data.get("name", "World")
        language = data.get("language", "english").lower()
        
        greetings = {
            "português": f"Olá, {name}! Bem-vindo ao protocolo A2A!",
            "english": f"Hello, {name}! Welcome to A2A Protocol!",
            "español": f"¡Hola, {name}! ¡Bienvenido al protocolo A2A!",
            "français": f"Bonjour, {name}! Bienvenue au protocole A2A!",
            "deutsch": f"Hallo, {name}! Willkommen zum A2A-Protokoll!",
            "italiano": f"Ciao, {name}! Benvenuto al protocollo A2A!",
            "日本語": f"こんにちは、{name}さん！A2Aプロトコルへようこそ！",
            "中文": f"你好，{name}！欢迎使用A2A协议！"
        }
        
        greeting = greetings.get(language, greetings["english"])
        
        return {
            "greeting": greeting,
            "name": name,
            "language": language,
            "timestamp": datetime.now().isoformat(),
            "agent": self.name
        }
    
    async def _super_hello_world(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Saudação entusiasmada com dados extras"""
        name = data.get("name", "World")
        language = data.get("language", "english").lower()
        excitement_level = data.get("excitement_level", 5)
        
        # Ajustar exclamações baseado no nível
        exclamation = "!" * min(excitement_level, 10)
        
        # Saudação base
        base_result = await self._hello_world({"name": name, "language": language})
        greeting = base_result["greeting"].replace("!", exclamation)
        
        # Adicionar emojis baseado no nível
        emojis = ["🎉", "🚀", "✨", "🌟", "💫", "🎊", "🔥", "⚡", "🌈", "🎯"]
        selected_emojis = emojis[:min(excitement_level, 10)]
        
        return {
            "greeting": f"{greeting} {' '.join(selected_emojis)}",
            "name": name,
            "language": language,
            "excitement_level": excitement_level,
            "special_message": f"This is SUPER HelloWorld with excitement level {excitement_level}{exclamation}",
            "features": {
                "animated": excitement_level > 5,
                "colorful": excitement_level > 3,
                "loud": excitement_level > 7
            },
            "timestamp": datetime.now().isoformat(),
            "agent": f"{self.name}-super"
        }
    
    async def _discover(self) -> Dict[str, Any]:
        """Retorna informações de descoberta do agente"""
        return {
            "id": self.name,
            "name": "HelloWorld Agent",
            "version": self.version,
            "capabilities": [
                {
                    "id": "GREET",
                    "name": "greeting",
                    "description": "Generate greetings and introductions"
                },
                {
                    "id": "DEMO",
                    "name": "demonstration",
                    "description": "Provide demo functionality"
                }
            ],
            "supported_languages": self.supported_languages,
            "status": "active",
            "timestamp": datetime.now().isoformat()
        }
    
    async def _communicate(self, message: Any) -> Dict[str, Any]:
        """Processa comunicação com outro agente"""
        logger.info(f"[{self.name}] Mensagem recebida: {message}")
        
        return {
            "success": True,
            "response": f"Mensagem recebida por {self.name}",
            "agent_id": self.name,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _delegate(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Aceita delegação de tarefa"""
        logger.info(f"[{self.name}] Delegação de tarefa recebida: {task}")
        
        task_id = task.get("id", str(int(datetime.now().timestamp())))
        
        return {
            "task_id": task_id,
            "status": "accepted",
            "agent_id": self.name,
            "estimated_completion": datetime.now().isoformat()
        }
    
    async def _health(self) -> Dict[str, Any]:
        """Retorna status de saúde do agente"""
        import time
        
        return {
            "status": "healthy",
            "agent_id": self.name,
            "uptime": time.time(),
            "memory_usage": len(self.memory),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_agent_card(self) -> Dict[str, Any]:
        """Retorna Agent Card no formato A2A"""
        return {
            "name": self.name,
            "version": self.version,
            "description": "Agente simples que cumprimenta pessoas em múltiplos idiomas",
            "skills": [
                {
                    "name": "hello_world",
                    "description": "Returns a simple hello world greeting",
                    "parameters": {
                        "name": "string",
                        "language": "string"
                    }
                },
                {
                    "name": "super_hello_world",
                    "description": "Returns an enthusiastic hello world greeting with extra data",
                    "parameters": {
                        "name": "string",
                        "language": "string",
                        "excitement_level": "number"
                    }
                }
            ],
            "capabilities": self.capabilities
        }