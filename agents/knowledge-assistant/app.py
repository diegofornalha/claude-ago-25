#!/usr/bin/env python3
"""
A2A HTTP Server for Knowledge Assistant Agent
Implementa os endpoints padrão do protocolo A2A
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import json
import asyncio
from typing import Dict, Any
import logging
from server import agent, Task, TaskState
from pathlib import Path

# Configuração do Flask
app = Flask(__name__)
CORS(app)

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Health check
@app.route('/health', methods=['GET'])
def health():
    """Endpoint de health check"""
    return jsonify({
        "status": "healthy",
        "agent": "knowledge-assistant",
        "version": "1.0.0"
    })

# Agent Card Discovery
@app.route('/.well-known/agent.json', methods=['GET'])
@app.route('/.well-known/agent-card', methods=['GET'])
def get_agent_card():
    """Retorna o Agent Card para descoberta"""
    return jsonify(agent.get_agent_card())

# Criar nova tarefa
@app.route('/tasks', methods=['POST'])
def create_task():
    """Cria uma nova tarefa A2A"""
    try:
        data = request.json
        
        # Validar entrada
        if not data or 'skill' not in data:
            return jsonify({
                "error": "Campo 'skill' é obrigatório"
            }), 400
        
        skill = data['skill']
        parameters = data.get('parameters', {})
        
        # Criar tarefa de forma assíncrona
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        task = loop.run_until_complete(
            agent.create_task(skill, parameters)
        )
        
        # Converter para dict
        task_dict = {
            "id": task.id,
            "skill": task.skill,
            "state": task.state.value,
            "parameters": task.parameters,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "messages": [
                {
                    "id": msg.id,
                    "timestamp": msg.timestamp,
                    "role": msg.role,
                    "content": msg.content,
                    "metadata": msg.metadata
                }
                for msg in task.messages
            ],
            "result": task.result,
            "error": task.error
        }
        
        return jsonify(task_dict), 201
        
    except Exception as e:
        logger.error(f"Erro ao criar tarefa: {e}")
        return jsonify({
            "error": str(e)
        }), 500

# Obter status da tarefa
@app.route('/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    """Obtém o status de uma tarefa"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        task = loop.run_until_complete(
            agent.get_task(task_id)
        )
        
        if not task:
            return jsonify({
                "error": "Tarefa não encontrada"
            }), 404
        
        # Converter para dict
        task_dict = {
            "id": task.id,
            "skill": task.skill,
            "state": task.state.value,
            "parameters": task.parameters,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "messages": [
                {
                    "id": msg.id,
                    "timestamp": msg.timestamp,
                    "role": msg.role,
                    "content": msg.content,
                    "metadata": msg.metadata
                }
                for msg in task.messages
            ],
            "result": task.result,
            "error": task.error
        }
        
        return jsonify(task_dict)
        
    except Exception as e:
        logger.error(f"Erro ao obter tarefa: {e}")
        return jsonify({
            "error": str(e)
        }), 500

# Enviar mensagem para tarefa
@app.route('/tasks/<task_id>/messages', methods=['POST'])
def send_message(task_id):
    """Envia mensagem para uma tarefa"""
    try:
        data = request.json
        
        if not data or 'content' not in data:
            return jsonify({
                "error": "Campo 'content' é obrigatório"
            }), 400
        
        content = data['content']
        role = data.get('role', 'user')
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        message = loop.run_until_complete(
            agent.send_message(task_id, content, role)
        )
        
        if not message:
            return jsonify({
                "error": "Tarefa não encontrada"
            }), 404
        
        return jsonify({
            "id": message.id,
            "timestamp": message.timestamp,
            "role": message.role,
            "content": message.content,
            "metadata": message.metadata
        }), 201
        
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem: {e}")
        return jsonify({
            "error": str(e)
        }), 500

# Cancelar tarefa
@app.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Cancela uma tarefa"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        success = loop.run_until_complete(
            agent.cancel_task(task_id)
        )
        
        if not success:
            return jsonify({
                "error": "Não foi possível cancelar a tarefa"
            }), 400
        
        return jsonify({
            "message": "Tarefa cancelada com sucesso"
        })
        
    except Exception as e:
        logger.error(f"Erro ao cancelar tarefa: {e}")
        return jsonify({
            "error": str(e)
        }), 500

# Listar todas as tarefas
@app.route('/tasks', methods=['GET'])
def list_tasks():
    """Lista todas as tarefas"""
    try:
        tasks_list = []
        
        for task_id, task in agent.tasks.items():
            tasks_list.append({
                "id": task.id,
                "skill": task.skill,
                "state": task.state.value,
                "created_at": task.created_at,
                "updated_at": task.updated_at
            })
        
        return jsonify({
            "tasks": tasks_list,
            "total": len(tasks_list)
        })
        
    except Exception as e:
        logger.error(f"Erro ao listar tarefas: {e}")
        return jsonify({
            "error": str(e)
        }), 500

# Streaming de eventos (Server-Sent Events)
@app.route('/tasks/<task_id>/stream', methods=['GET'])
def stream_task(task_id):
    """Stream de eventos para uma tarefa"""
    def generate():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        while True:
            task = loop.run_until_complete(agent.get_task(task_id))
            
            if not task:
                yield f"data: {json.dumps({'error': 'Task not found'})}\n\n"
                break
            
            event_data = {
                "id": task.id,
                "state": task.state.value,
                "updated_at": task.updated_at
            }
            
            if task.state == TaskState.COMPLETED:
                event_data["result"] = task.result
                yield f"data: {json.dumps(event_data)}\n\n"
                break
            elif task.state == TaskState.FAILED:
                event_data["error"] = task.error
                yield f"data: {json.dumps(event_data)}\n\n"
                break
            
            yield f"data: {json.dumps(event_data)}\n\n"
            asyncio.run(asyncio.sleep(1))
    
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

# Página inicial com documentação
@app.route('/', methods=['GET'])
def index():
    """Página inicial com informações do agente"""
    return jsonify({
        "name": "Knowledge Assistant A2A Agent",
        "version": "1.0.0",
        "protocol": "A2A/1.0",
        "endpoints": {
            "agent_card": "/.well-known/agent.json",
            "health": "/health",
            "tasks": "/tasks",
            "task_detail": "/tasks/{task_id}",
            "send_message": "/tasks/{task_id}/messages",
            "cancel_task": "/tasks/{task_id}/cancel",
            "stream_task": "/tasks/{task_id}/stream"
        },
        "documentation": "https://a2aprotocol.ai"
    })

if __name__ == '__main__':
    logger.info("Iniciando Knowledge Assistant A2A Agent na porta 9998")
    app.run(
        host='0.0.0.0',
        port=9998,
        debug=True
    )