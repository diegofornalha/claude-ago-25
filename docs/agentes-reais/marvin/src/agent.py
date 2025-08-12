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
        self.conversation_context = {}  # Contexto da conversa atual
        self.last_extraction = None  # Última extração realizada
        self.collecting_data = False  # Flag para indicar coleta progressiva
        self.partial_data = {}  # Dados sendo coletados progressivamente
        
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
    
    async def extract_from_natural_language(self, text: str) -> Dict[str, Any]:
        """
        Extrai dados de linguagem natural e acumula progressivamente
        """
        import re
        
        # Padrões para linguagem natural
        patterns = {
            'nome': [
                r'(?:meu nome é|me chamo|sou o?a?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s|,|$)',
                r'(?:nome|nome dele?a? é)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)(?:\s|,|$)',
                r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$'  # Nome sozinho (sem outras palavras)
            ],
            'email': [
                r'(?:meu email é|email:?)\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
                r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',  # Email direto
            ],
            'telefone': [
                r'(?:meu (?:telefone|celular|número) é|tel:?)\s*([\d\s\-\(\)]+)',
                r'(?:telefone|celular|whatsapp|contato):?\s*([\d\s\-\(\)]+)',
                r'(\(?[0-9]{2,3}\)?[\s\-]?[0-9]{4,5}[\s\-]?[0-9]{4})'  # Telefone direto
            ],
            'empresa': [
                r'(?:trabalho na|empresa é|trabalho para a?o?)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+(?:como|de|empresa|company|ltda|inc)|$)',
                r'(?:empresa|company):?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s|$)',
                r'(?:^|\s)na\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+como|\s+de|$)'  # "na Coflow como..."
            ],
            'cargo': [
                r'(?:sou|trabalho como|meu cargo é|cargo:?)\s*([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+na|\s+da|\s*$)',
                r'(?:como|cargo de)\s+(CEO|CTO|CFO|diretor|gerente|desenvolvedor|analista)',
                r'\b(CEO|CTO|CFO|diretor|gerente|desenvolvedor|analista)\b'
            ],
            'idade': [
                r'(?:tenho|idade:?)\s*(\d+)\s*(?:anos)?',
                r'(\d+)\s*anos(?:\s+de idade)?',
                r'(?:idade é de?)\s*(\d+)'
            ]
        }
        
        # Extrair dados usando padrões
        extracted_now = {}
        for field, field_patterns in patterns.items():
            # Não sobrescrever se já temos esse campo
            if field in self.partial_data:
                continue
                
            for pattern in field_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    if field == 'telefone':
                        # Limpar telefone
                        value = re.sub(r'[^\d]', '', value)
                    elif field == 'idade':
                        value = f"{value} anos"
                    extracted_now[field] = value
                    break
        
        # Atualizar dados parciais apenas com novos campos
        self.partial_data.update(extracted_now)
        
        # Verificar se começou uma nova coleta
        if any(phrase in text.lower() for phrase in ['quero me cadastrar', 'quero cadastrar', 'vou passar meus dados', 'preciso me cadastrar', 'meus dados são', 'fazer cadastro', 'preciso fazer']):
            self.collecting_data = True
            self.partial_data = extracted_now  # Resetar com dados atuais
            
            return {
                "response": "📝 Claro! Pode me passar seus dados. Vou anotando conforme você for me informando. Pode começar com seu nome.",
                "collecting": True,
                "partial_data": self.partial_data,
                "timestamp": datetime.now().isoformat()
            }
        
        # Se está coletando dados progressivamente
        if self.collecting_data or extracted_now:
            # Campos necessários
            required_fields = ['nome', 'email', 'telefone', 'empresa', 'cargo', 'idade']
            missing_fields = [f for f in required_fields if f not in self.partial_data]
            
            # Gerar resposta apropriada
            if extracted_now:
                # Confirmar o que foi extraído
                confirmations = []
                for field, value in extracted_now.items():
                    field_name = {
                        'nome': 'nome',
                        'email': 'email',
                        'telefone': 'telefone',
                        'empresa': 'empresa',
                        'cargo': 'cargo',
                        'idade': 'idade'
                    }.get(field, field)
                    confirmations.append(f"• **{field_name.title()}**: {value}")
                
                response = f"✅ Anotei:\n" + "\n".join(confirmations)
                
                # Se ainda faltam campos
                if missing_fields:
                    if len(missing_fields) == 1:
                        field_question = {
                            'nome': 'Qual é o seu nome?',
                            'email': 'Qual é o seu email?',
                            'telefone': 'Qual é o seu telefone?',
                            'empresa': 'Em qual empresa você trabalha?',
                            'cargo': 'Qual é o seu cargo?',
                            'idade': 'Qual é a sua idade?'
                        }
                        response += f"\n\n❓ Só falta me informar: {field_question.get(missing_fields[0], missing_fields[0])}"
                    else:
                        response += f"\n\n📋 Ainda preciso dos seguintes dados:"
                        for field in missing_fields[:3]:  # Mostrar no máximo 3
                            response += f"\n• {field.title()}"
                else:
                    # Todos os dados foram coletados!
                    self.collecting_data = False
                    response = f"""🎉 **Perfeito! Cadastro completo!**

Aqui estão todos os seus dados:

• **Nome**: {self.partial_data.get('nome', 'N/A')}
• **Email**: {self.partial_data.get('email', 'N/A')}
• **Telefone**: {self.partial_data.get('telefone', 'N/A')}
• **Empresa**: {self.partial_data.get('empresa', 'N/A')}
• **Cargo**: {self.partial_data.get('cargo', 'N/A')}
• **Idade**: {self.partial_data.get('idade', 'N/A')}

Dados salvos com sucesso! ✨"""
                    # Salvar como última extração
                    self.last_extraction = {
                        "extracted_data": self.partial_data.copy(),
                        "timestamp": datetime.now().isoformat()
                    }
                
                return {
                    "response": response,
                    "partial_data": self.partial_data,
                    "missing_fields": missing_fields,
                    "complete": len(missing_fields) == 0,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                # Nada foi extraído, perguntar o que falta
                if missing_fields:
                    field_question = {
                        'nome': 'Qual é o seu nome?',
                        'email': 'Pode me informar seu email?',
                        'telefone': 'Qual é o seu telefone?',
                        'empresa': 'Em qual empresa você trabalha?',
                        'cargo': 'Qual é o seu cargo?',
                        'idade': 'Qual é a sua idade?'
                    }
                    return {
                        "response": f"🤔 {field_question.get(missing_fields[0], f'Pode me informar seu {missing_fields[0]}?')}",
                        "partial_data": self.partial_data,
                        "missing_fields": missing_fields,
                        "timestamp": datetime.now().isoformat()
                    }
        
        return None  # Não é uma extração de dados
    
    async def extract_data(self, text: str) -> Dict[str, Any]:
        """
        Extrai dados estruturados de texto não estruturado
        """
        import re
        logger.info(f"Extraindo dados do texto")
        
        # Verificar se é complemento de extração anterior
        if self.last_extraction and len(text) < 50:
            # Texto curto, pode ser complemento
            if "idade" in text.lower() and re.search(r'\d+', text):
                # Extrair idade do texto atual
                idade_match = re.search(r'(\d+)\s*(?:anos?)?', text)
                if idade_match:
                    idade = idade_match.group(1)
                    # Atualizar última extração
                    self.last_extraction["extracted_data"]["idade"] = f"{idade} anos"
                    self.last_extraction["complemented"] = True
                    
                    # Criar resposta inteligente
                    nome = self.last_extraction["extracted_data"].get("nome", "a pessoa")
                    return {
                        "timestamp": datetime.now().isoformat(),
                        "source_text": text,
                        "response": f"✅ Entendi! Agora tenho todos os dados de {nome}:\n\n" +
                                  f"• **Nome**: {self.last_extraction['extracted_data'].get('nome', 'Diego')}\n" +
                                  f"• **Email**: {self.last_extraction['extracted_data'].get('email', '')}\n" +
                                  f"• **Telefone**: {self.last_extraction['extracted_data'].get('telefone', '')}\n" +
                                  f"• **Empresa**: {self.last_extraction['extracted_data'].get('empresa', '')}\n" +
                                  f"• **Cargo**: {self.last_extraction['extracted_data'].get('cargo', '')}\n" +
                                  f"• **Idade**: {idade} anos\n\n" +
                                  "Dados completos extraídos com sucesso! 📊",
                        "extracted_data": self.last_extraction["extracted_data"],
                        "context_aware": True
                    }
        
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
                "ages": [],
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
        
        # Extração de nomes próprios melhorada
        # Procura por "nome:" ou palavras capitalizadas
        if "nome:" in text.lower():
            nome_match = re.search(r'nome:\s*([^,\n]+)', text, re.IGNORECASE)
            if nome_match:
                extraction["entities"]["names"].append(nome_match.group(1).strip())
        else:
            # Fallback para palavras capitalizadas consecutivas
            name_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
            potential_names = re.findall(name_pattern, text)
            extraction["entities"]["names"] = potential_names
        
        # Extração de idade
        idade_patterns = [
            r'idade:\s*(\d+)\s*(?:anos?)?',
            r'(\d+)\s*anos?\s*(?:de idade)?',
            r'tem\s*(\d+)\s*anos?'
        ]
        for pattern in idade_patterns:
            idade_match = re.search(pattern, text, re.IGNORECASE)
            if idade_match:
                extraction["entities"]["ages"].append(f"{idade_match.group(1)} anos")
                break
        
        # Identificar cargos/posições comuns
        position_keywords = ['CEO', 'CTO', 'CFO', 'diretor', 'gerente', 'coordenador', 
                           'analista', 'desenvolvedor', 'engenheiro', 'designer', 
                           'presidente', 'vice-presidente', 'supervisor']
        text_lower = text.lower()
        for keyword in position_keywords:
            if keyword.lower() in text_lower:
                extraction["entities"]["positions"].append(keyword)
        
        # Identificar empresas melhorado
        if "empresa:" in text.lower():
            empresa_match = re.search(r'empresa:\s*([^,\n]+)', text, re.IGNORECASE)
            if empresa_match:
                extraction["entities"]["companies"].append(empresa_match.group(1).strip())
        else:
            # Fallback para indicadores de empresa
            company_indicators = ['empresa', 'ltda', 'inc', 'corp', 'company']
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
        if extraction["entities"]["ages"]:
            extraction["extracted_data"]["idade"] = extraction["entities"]["ages"][0]
        
        # Adicionar estatísticas
        extraction["statistics"] = {
            "total_entities_found": sum(len(v) for v in extraction["entities"].values()),
            "entity_types_found": len([k for k, v in extraction["entities"].items() if v])
        }
        
        # Salvar como última extração para contexto
        self.last_extraction = extraction
        
        # Se extraiu todos os campos principais, criar resposta formatada
        if len(extraction["extracted_data"]) >= 5:
            dados = extraction["extracted_data"]
            extraction["response"] = f"""✅ **Dados extraídos com sucesso!**

• **Nome**: {dados.get('nome', 'N/A')}
• **Email**: {dados.get('email', 'N/A')}
• **Telefone**: {dados.get('telefone', 'N/A')}
• **Empresa**: {dados.get('empresa', 'N/A')}
• **Cargo**: {dados.get('cargo', 'N/A')}
• **Idade**: {dados.get('idade', 'N/A')}

Total de {extraction['statistics']['total_entities_found']} entidades encontradas."""
        
        return extraction
    
    async def provide_assistance(self, query: str) -> Dict[str, Any]:
        """
        Fornece assistência baseada na consulta
        """
        logger.info(f"Fornecendo assistência para: {query}")
        
        # Tentar extrair dados de linguagem natural primeiro
        natural_extraction = await self.extract_from_natural_language(query)
        if natural_extraction:
            return natural_extraction
        
        # Verificar se é complemento de uma extração anterior (ex: "idade: 33 anos")
        if self.last_extraction and len(query) < 50 and ":" in query:
            # Pode ser dados adicionais
            extraction_result = await self.extract_data(query)
            if extraction_result.get("context_aware"):
                return extraction_result
        
        # Verificar se é uma solicitação de extração formal
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