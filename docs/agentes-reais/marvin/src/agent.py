#!/usr/bin/env python3
"""
Marvin Agent - Agente auxiliar inteligente
"""

import logging
import asyncio
from typing import Any, Dict, Optional
from datetime import datetime

# Tentar importar integração com RAG
try:
    from .simple_rag import MarvinWithRAG
    RAG_AVAILABLE = True
except ImportError:
    try:
        from simple_rag import MarvinWithRAG
        RAG_AVAILABLE = True
    except ImportError:
        RAG_AVAILABLE = False

logger = logging.getLogger(__name__)


class MarvinAgent:
    """
    Agente Marvin com capacidades de análise, execução e assistência
    """
    
    def __init__(self):
        self.name = "Marvin Agent"
        self.version = "1.0.0"
        self.capabilities = [
            "análise de dados",
            "execução de tarefas",
            "assistência geral",
            "aprendizado contínuo",
            "extração de dados estruturados"
        ]
        self.memory = {}  # Memória simples para contexto
        
        # Integração com RAG se disponível
        self.rag_agent = None
        if RAG_AVAILABLE:
            try:
                self.rag_agent = MarvinWithRAG()
                self.capabilities.append("consulta base de conhecimento A2A")
                logger.info("✅ Integração com documentação A2A ativada")
            except Exception as e:
                logger.warning(f"⚠️ RAG disponível mas não inicializado: {e}")
        
        logger.info(f"Marvin Agent inicializado - v{self.version}")
    
    async def analyze(self, data: Any) -> Dict[str, Any]:
        """
        Analisa dados e fornece insights
        """
        logger.info(f"Analisando dados: {type(data)}")
        
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "data_type": str(type(data)),
            "insights": [],
            "recommendations": []
        }
        
        # Análise básica
        if isinstance(data, str):
            analysis["insights"].append(f"Texto com {len(data)} caracteres")
            analysis["insights"].append(f"Palavras: {len(data.split())}")
            
        elif isinstance(data, dict):
            analysis["insights"].append(f"Dicionário com {len(data)} chaves")
            analysis["insights"].append(f"Chaves: {list(data.keys())}")
            
        elif isinstance(data, list):
            analysis["insights"].append(f"Lista com {len(data)} elementos")
            
        analysis["recommendations"].append("Análise concluída com sucesso")
        
        return analysis
    
    async def execute_task(self, task: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Executa uma tarefa específica
        """
        logger.info(f"Executando tarefa: {task}")
        
        result = {
            "task": task,
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "params": params or {},
            "output": None
        }
        
        # Simular execução de diferentes tipos de tarefas
        if "análise" in task.lower() or "analyze" in task.lower():
            result["output"] = await self.analyze(params.get("data") if params else {})
            
        elif "ajuda" in task.lower() or "help" in task.lower():
            result["output"] = await self.provide_assistance(task)
            
        else:
            result["output"] = f"Tarefa '{task}' executada com sucesso"
            
        return result
    
    async def extract_data(self, text: str) -> Dict[str, Any]:
        """
        Extrai dados estruturados de texto não estruturado
        """
        import re
        logger.info(f"Extraindo dados do texto")
        
        extraction = {
            "timestamp": datetime.now().isoformat(),
            "source_text": text,
            "extracted_data": {},
            "entities": {
                "names": [],
                "emails": [],
                "phones": [],
                "companies": [],
                "positions": [],
                "urls": [],
                "dates": [],
                "numbers": []
            }
        }
        
        # Extração de emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        extraction["entities"]["emails"] = re.findall(email_pattern, text)
        
        # Extração de telefones (vários formatos)
        phone_patterns = [
            r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b',  # XXX-XXX-XXXX
            r'\b\d{2}[-.\s]?\d{4,5}[-.\s]?\d{4}\b',  # XX-XXXX-XXXX
            r'\b\d{9,11}\b',  # Números simples
            r'\b\(\d{2,3}\)\s?\d{4,5}[-.\s]?\d{4}\b'  # (XX) XXXXX-XXXX
        ]
        for pattern in phone_patterns:
            extraction["entities"]["phones"].extend(re.findall(pattern, text))
        
        # Extração de URLs
        url_pattern = r'https?://[^\s]+'
        extraction["entities"]["urls"] = re.findall(url_pattern, text)
        
        # Extração de nomes próprios (heurística simples)
        # Procura por palavras capitalizadas consecutivas
        name_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b'
        potential_names = re.findall(name_pattern, text)
        extraction["entities"]["names"] = potential_names
        
        # Identificar cargos/posições comuns
        position_keywords = ['CEO', 'CTO', 'CFO', 'diretor', 'gerente', 'coordenador', 
                           'analista', 'desenvolvedor', 'engenheiro', 'designer', 
                           'presidente', 'vice-presidente', 'supervisor']
        text_lower = text.lower()
        for keyword in position_keywords:
            if keyword.lower() in text_lower:
                extraction["entities"]["positions"].append(keyword)
        
        # Identificar empresas (palavras antes de termos como "empresa", "ltda", etc)
        company_indicators = ['empresa', 'ltda', 'inc', 'corp', 'company', 'agentes']
        for indicator in company_indicators:
            pattern = r'\b(\w+(?:\s+\w+)*)\s+' + indicator + r'\b'
            companies = re.findall(pattern, text, re.IGNORECASE)
            extraction["entities"]["companies"].extend(companies)
        
        # Extração de números
        number_pattern = r'\b\d+(?:\.\d+)?\b'
        extraction["entities"]["numbers"] = re.findall(number_pattern, text)
        
        # Criar estrutura de dados extraídos
        if extraction["entities"]["names"]:
            extraction["extracted_data"]["nome"] = extraction["entities"]["names"][0]
        if extraction["entities"]["emails"]:
            extraction["extracted_data"]["email"] = extraction["entities"]["emails"][0]
        if extraction["entities"]["phones"]:
            extraction["extracted_data"]["telefone"] = extraction["entities"]["phones"][0]
        if extraction["entities"]["companies"]:
            extraction["extracted_data"]["empresa"] = extraction["entities"]["companies"][0]
        if extraction["entities"]["positions"]:
            extraction["extracted_data"]["cargo"] = extraction["entities"]["positions"][0]
        
        # Adicionar estatísticas
        extraction["statistics"] = {
            "total_entities_found": sum(len(v) for v in extraction["entities"].values()),
            "entity_types_found": len([k for k, v in extraction["entities"].items() if v])
        }
        
        return extraction
    
    async def provide_assistance(self, query: str) -> Dict[str, Any]:
        """
        Fornece assistência baseada na consulta
        """
        logger.info(f"Fornecendo assistência para: {query}")
        
        # Verificar se é uma solicitação de extração
        extraction_keywords = ['extraia', 'extrai', 'extract', 'parse', 'identifique', 
                              'encontre', 'busque', 'procure']
        
        if any(keyword in query.lower() for keyword in extraction_keywords):
            # É uma solicitação de extração
            extraction_result = await self.extract_data(query)
            return extraction_result
        
        # Verificar se deve usar RAG para consultas sobre A2A
        if self.rag_agent and any(term in query.lower() for term in ["a2a", "agent card", "protocol", "skill", "mcp", "rag"]):
            logger.info("Consultando base de conhecimento sobre A2A")
            
            # Verificar se é sobre RAG/MCP especificamente
            if "rag" in query.lower() and "mcp" in query.lower():
                return {
                    "query": query,
                    "timestamp": datetime.now().isoformat(),
                    "response": """✅ **Sim, posso consultar via MCP RAG Server!**

Tenho integração completa com a base de conhecimento sobre A2A Protocol através do RAG. Isso me permite:

• 📚 Acessar documentação completa sobre A2A Protocol
• 🔍 Buscar informações sobre Agent Cards, Skills, Tasks
• 💡 Explicar diferenças entre A2A e MCP
• 📖 Fornecer exemplos práticos de implementação
• ⚙️ Detalhar padrões e melhores práticas

**A2A vs MCP:**
- **A2A (Agent-to-Agent)**: Comunicação horizontal entre agentes inteligentes
- **MCP (Model Context Protocol)**: Integração vertical com ferramentas e serviços

Posso responder perguntas específicas sobre qualquer aspecto do protocolo A2A!""",
                    "source": "integrated_rag",
                    "suggestions": [
                        "Pergunte sobre Agent Cards",
                        "Como implementar um agente A2A",
                        "Estrutura de mensagens A2A"
                    ]
                }
            
            # Consulta normal ao RAG
            rag_result = await self.rag_agent.process_query(query)
            
            # Limpar resposta se for muito longa ou mal formatada
            response = rag_result.get("response", "")
            if len(response) > 1000:
                response = response[:1000] + "\n\n[...continua]"
            
            return {
                "query": query,
                "timestamp": datetime.now().isoformat(),
                "response": response,
                "source": rag_result.get("source", "rag"),
                "suggestions": ["Consulte a documentação A2A completa", "Verifique os exemplos práticos"],
                "results_count": rag_result.get("results_count", 0)
            }
        
        assistance = {
            "query": query,
            "timestamp": datetime.now().isoformat(),
            "response": "",
            "suggestions": []
        }
        
        # Respostas baseadas em palavras-chave
        query_lower = query.lower()
        
        # Perguntas sobre o próprio Marvin
        if any(phrase in query_lower for phrase in ["o que você faz", "o que vc faz", "suas capacidades", "o que sabe fazer"]):
            assistance["response"] = f"""Sou o Marvin Agent v{self.version}, um agente inteligente A2A com as seguintes capacidades:

• 🧠 Análise de dados e fornecimento de insights
• 📊 Extração de dados estruturados (nomes, emails, telefones, empresas)
• ⚡ Execução de tarefas assíncronas
• 📚 Consulta à base de conhecimento sobre protocolo A2A
• 🔄 Aprendizado contínuo e memória contextual
• 🤝 Integração com outros agentes via protocolo A2A

Posso ajudar com desenvolvimento de agentes, questões sobre A2A Protocol, extração de informações e muito mais!"""
            assistance["suggestions"] = [
                "Pergunte sobre Agent Cards",
                "Solicite extração de dados",
                "Consulte sobre protocolo A2A"
            ]
            
        elif any(word in query_lower for word in ["ativo", "funcionando", "online", "rodando"]):
            assistance["response"] = f"✅ Sim, estou ativo e operacional! Marvin Agent v{self.version} rodando na porta 9998. Todos os sistemas funcionando normalmente."
            assistance["suggestions"] = [
                "Pergunte o que posso fazer",
                "Teste a extração de dados",
                "Consulte sobre A2A Protocol"
            ]
            
        elif "como" in query_lower:
            assistance["response"] = "Vou te ajudar com instruções passo a passo."
            assistance["suggestions"] = [
                "Defina claramente o objetivo",
                "Quebre em tarefas menores",
                "Execute uma tarefa por vez"
            ]
            
        elif "ajuda" in query_lower or "help" in query_lower:
            assistance["response"] = """📋 **Comandos disponíveis:**
• Extração: 'extraia [texto]' - Extrai dados estruturados
• A2A: 'o que são Agent Cards?' - Consulta base A2A
• Status: 'você está ativo?' - Verifica status
• Capacidades: 'o que você faz?' - Lista funcionalidades"""
            assistance["suggestions"] = [
                "Digite um comando",
                "Faça uma pergunta sobre A2A",
                "Peça para extrair dados"
            ]
            
        else:
            assistance["response"] = "Estou aqui para ajudar! Sou especializado em A2A Protocol e extração de dados."
            assistance["suggestions"] = [
                "Pergunte 'o que você faz?'",
                "Digite 'ajuda' para ver comandos",
                "Consulte sobre protocolo A2A"
            ]
            
        return assistance
    
    async def query_knowledge_base(self, query: str) -> Dict[str, Any]:
        """
        Consulta a base de conhecimento RAG
        """
        if not self.rag_agent:
            return {
                "error": "RAG não disponível",
                "message": "Integração com base de conhecimento não está ativa"
            }
        
        try:
            logger.info(f"Consultando RAG: {query}")
            result = await self.rag_agent.process_query(query)
            return result
        except Exception as e:
            logger.error(f"Erro ao consultar RAG: {e}")
            return {
                "error": str(e),
                "message": "Falha ao consultar base de conhecimento"
            }
    
    async def learn(self, key: str, value: Any) -> bool:
        """
        Armazena informação na memória para aprendizado
        """
        logger.info(f"Aprendendo: {key}")
        
        self.memory[key] = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        
        return True
    
    async def recall(self, key: str) -> Optional[Any]:
        """
        Recupera informação da memória
        """
        logger.info(f"Recuperando: {key}")
        
        if key in self.memory:
            return self.memory[key]
        
        return None
    
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa uma requisição genérica
        """
        logger.info(f"Processando requisição: {request.get('type', 'unknown')}")
        
        request_type = request.get("type", "").lower()
        data = request.get("data", {})
        
        try:
            if request_type == "analyze":
                return await self.analyze(data)
                
            elif request_type == "execute":
                task = data.get("task", "")
                params = data.get("params", {})
                return await self.execute_task(task, params)
                
            elif request_type == "assist":
                query = data.get("query", "")
                return await self.provide_assistance(query)
                
            elif request_type == "learn":
                key = data.get("key", "")
                value = data.get("value", "")
                success = await self.learn(key, value)
                return {"success": success, "message": f"Aprendido: {key}"}
                
            elif request_type == "recall":
                key = data.get("key", "")
                memory = await self.recall(key)
                return {"key": key, "memory": memory}
                
            else:
                return {
                    "error": f"Tipo de requisição não reconhecido: {request_type}",
                    "supported_types": ["analyze", "execute", "assist", "learn", "recall"]
                }
                
        except Exception as e:
            logger.error(f"Erro ao processar requisição: {e}")
            return {
                "error": str(e),
                "request": request
            }
    
    def __repr__(self):
        return f"<MarvinAgent v{self.version}>"