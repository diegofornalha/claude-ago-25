#!/usr/bin/env python3
"""
HelloWorld Agent - Versão Simplificada
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

# Agent card baseado no arquivo original
AGENT_CARD = {
    "name": "Hello World Agent",
    "description": "Just a hello world agent",
    "url": "http://localhost:9999/",
    "version": "1.0.0",
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
    "capabilities": {
        "streaming": True
    },
    "skills": [
        {
            "id": "hello_world",
            "name": "Returns hello world",
            "description": "just returns hello world",
            "tags": ["hello world"],
            "examples": ["hi", "hello world"]
        },
        {
            "id": "super_hello_world",
            "name": "Returns a SUPER Hello World",
            "description": "A more enthusiastic greeting, only for authenticated users.",
            "tags": ["hello world", "super", "extended"],
            "examples": ["super hi", "give me a super hello"]
        }
    ],
    "supportsAuthenticatedExtendedCard": True
}

@app.get("/.well-known/agent.json")
async def get_agent_card():
    """Endpoint público do agent card"""
    return JSONResponse(content=AGENT_CARD)

@app.get("/agent/authenticatedExtendedCard")
async def get_extended_agent_card():
    """Endpoint do agent card estendido"""
    return JSONResponse(content=AGENT_CARD)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "agent": "helloworld"}

@app.post("/communicate")
async def communicate(request: dict):
    """Endpoint de comunicação básico"""
    return {
        "success": True,
        "response": "Hello World! Agente HelloWorld funcionando!",
        "agent_id": "helloworld_agent"
    }

@app.post("/skills/hello_world")
async def skill_hello_world(request: dict):
    """Skill hello_world"""
    return {
        "success": True,
        "response": "Hello World!",
        "skill": "hello_world"
    }

@app.post("/skills/super_hello_world")
async def skill_super_hello_world(request: dict):
    """Skill super_hello_world"""
    return {
        "success": True,
        "response": "🌟 SUPER Hello World! 🌟",
        "skill": "super_hello_world"
    }

if __name__ == "__main__":
    print("🤖 Iniciando HelloWorld Agent na porta 9999...")
    uvicorn.run(app, host="localhost", port=9999) 