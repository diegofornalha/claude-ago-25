#!/usr/bin/env python3
"""
MCP Resources - Definição de recursos disponíveis
"""

def get_resources():
    """Retorna lista de recursos disponíveis no servidor MCP"""
    return [
        {
            "uri": "cache://documents",
            "name": "RAG Document Cache",
            "description": "Cache principal de documentos RAG",
            "mimeType": "application/json"
        },
        {
            "uri": "cache://stats",
            "name": "RAG Statistics",
            "description": "Estatísticas do sistema RAG",
            "mimeType": "application/json"
        },
        {
            "uri": "cache://backups",
            "name": "RAG Backups",
            "description": "Backups do cache RAG",
            "mimeType": "application/json"
        },
        {
            "uri": "logs://server",
            "name": "Server Logs",
            "description": "Logs do servidor MCP RAG",
            "mimeType": "text/plain"
        }
    ]

def get_prompts():
    """Retorna prompts pré-definidos para o sistema RAG"""
    return [
        {
            "name": "search_documents",
            "description": "Busca documentos relevantes para uma pergunta",
            "arguments": [
                {
                    "name": "question",
                    "description": "Pergunta ou termo de busca",
                    "required": True
                },
                {
                    "name": "max_results",
                    "description": "Número máximo de resultados",
                    "required": False
                }
            ]
        },
        {
            "name": "summarize_documents",
            "description": "Resume documentos encontrados",
            "arguments": [
                {
                    "name": "document_ids",
                    "description": "IDs dos documentos para resumir",
                    "required": True
                }
            ]
        },
        {
            "name": "add_knowledge",
            "description": "Adiciona novo conhecimento ao RAG",
            "arguments": [
                {
                    "name": "content",
                    "description": "Conteúdo a ser adicionado",
                    "required": True
                },
                {
                    "name": "source",
                    "description": "Fonte do conteúdo",
                    "required": False
                }
            ]
        }
    ]