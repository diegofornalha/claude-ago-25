#!/usr/bin/env python3
"""
Exemplo de uso do Marvin Agent na UI.
Este script demonstra como usar o ExtractorAgent do Marvin integrado com a UI.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pydantic import BaseModel, EmailStr, Field
from agents.marvin.agent import ExtractorAgent


class ContactInfo(BaseModel):
    """Informações de contato estruturadas extraídas do texto."""
    
    name: str = Field(description="Nome e sobrenome da pessoa")
    email: EmailStr = Field(description="Endereço de e-mail")
    phone: str = Field(description="Número de telefone se presente")
    organization: str | None = Field(
        None, description="Organização ou empresa se mencionada"
    )
    role: str | None = Field(None, description="Cargo ou função se mencionada")


async def main():
    """Exemplo de uso do Marvin Agent."""
    # Criar o agente
    agent = ExtractorAgent(
        instructions="Extraia informações de contato do texto fornecido de forma educada e estruturada.",
        result_type=ContactInfo
    )
    
    # Texto de exemplo
    example_text = """
    Olá, meu nome é João Silva e trabalho como desenvolvedor na TechCorp.
    Você pode me contatar pelo e-mail joao.silva@techcorp.com ou pelo telefone (11) 99999-9999.
    """
    
    print("🔍 Processando texto:")
    print(f"'{example_text.strip()}'")
    print()
    
    # Processar com o agente
    result = await agent.invoke(example_text, "session_1")
    
    print("📊 Resultado:")
    print(f"Tarefa completa: {result['is_task_complete']}")
    print(f"Requer input do usuário: {result['require_user_input']}")
    
    if result['text_parts']:
        print("💬 Resposta do agente:")
        for part in result['text_parts']:
            print(f"  {part.text}")
    
    if result['data']:
        print("📋 Dados extraídos:")
        for key, value in result['data'].items():
            print(f"  {key}: {value}")
    
    print()
    print("✅ Exemplo concluído!")


if __name__ == "__main__":
    asyncio.run(main())