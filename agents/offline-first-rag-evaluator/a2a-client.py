#!/usr/bin/env python3
"""
A2A Protocol Client for testing the Offline-First RAG Evaluator Agent
Based on official A2A Protocol specification
"""

import json
import uuid
import asyncio
from typing import Optional, Dict, Any
import httpx
from datetime import datetime

class A2AClient:
    """Client for communicating with A2A Protocol agents"""
    
    def __init__(self, base_url: str = "http://localhost:8800", api_key: Optional[str] = None):
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
        self.client = httpx.AsyncClient(headers=self.headers, timeout=30.0)
    
    async def get_agent_card(self) -> Dict:
        """Get agent capabilities card"""
        response = await self.client.get(f"{self.base_url}/.well-known/agent-card")
        response.raise_for_status()
        return response.json()
    
    async def create_task(self, skill: str, parameters: Dict[str, Any]) -> Dict:
        """Create a new task using JSON-RPC 2.0"""
        payload = {
            "jsonrpc": "2.0",
            "method": "a2a.createTask",
            "params": {
                "skill": skill,
                "parameters": parameters
            },
            "id": str(uuid.uuid4())
        }
        
        response = await self.client.post(
            f"{self.base_url}/a2a",
            json=payload
        )
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            raise Exception(f"Error from agent: {result['error']}")
        
        return result.get("result")
    
    async def get_task_status(self, task_id: str) -> Dict:
        """Get task status"""
        response = await self.client.get(f"{self.base_url}/a2a/tasks/{task_id}/status")
        response.raise_for_status()
        return response.json()
    
    async def get_task(self, task_id: str) -> Dict:
        """Get complete task details"""
        response = await self.client.get(f"{self.base_url}/a2a/tasks/{task_id}")
        response.raise_for_status()
        return response.json()
    
    async def send_message(self, task_id: str, message: str, role: str = "user") -> Dict:
        """Send a message to a task"""
        message_data = {
            "messageId": str(uuid.uuid4()),
            "role": role,
            "parts": [
                {
                    "root": {
                        "text": message,
                        "format": "plain"
                    }
                }
            ],
            "taskId": task_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        response = await self.client.post(
            f"{self.base_url}/a2a/tasks/{task_id}/messages",
            json=message_data
        )
        response.raise_for_status()
        return response.json()
    
    async def wait_for_completion(self, task_id: str, timeout: int = 60) -> Dict:
        """Wait for task to complete"""
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            status = await self.get_task_status(task_id)
            
            if status["status"] in ["completed", "failed", "cancelled"]:
                return await self.get_task(task_id)
            
            await asyncio.sleep(1)
        
        raise TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")
    
    async def close(self):
        """Close the client"""
        await self.client.aclose()

async def test_rag_evaluator():
    """Test the Offline-First RAG Evaluator Agent"""
    
    client = A2AClient()
    
    try:
        print("🔍 Getting agent capabilities...")
        agent_card = await client.get_agent_card()
        print(f"✅ Connected to: {agent_card['name']} v{agent_card['version']}")
        print(f"📋 Available skills: {[s['name'] for s in agent_card['skills']]}")
        print()
        
        # Test 1: Evaluate RAG System
        print("📊 Test 1: Evaluating RAG System...")
        task1 = await client.create_task(
            skill="evaluate_rag_system",
            parameters={
                "target_system": "/Users/agents/.claude/todos/app_todos_bd_tasks/frontend",
                "evaluation_depth": "comprehensive",
                "focus_areas": ["cache", "sync", "performance", "ux"]
            }
        )
        print(f"✅ Task created: {task1['id']}")
        
        # Wait for completion
        print("⏳ Waiting for evaluation to complete...")
        result1 = await client.wait_for_completion(task1['id'])
        
        if result1['status'] == 'completed':
            print(f"✅ Evaluation complete!")
            print(f"📈 Score: {result1['result']['score']}/100")
            print("\n📄 Report:")
            print(result1['result']['report'])
            print("\n💡 Recommendations:")
            for rec in result1['result']['recommendations']:
                print(f"  [{rec['priority']}] {rec['title']}")
                print(f"    {rec['description']}")
        print()
        
        # Test 2: Test Offline Functionality
        print("🧪 Test 2: Testing Offline Search...")
        task2 = await client.create_task(
            skill="test_offline_functionality",
            parameters={
                "feature": "search",
                "test_scenarios": ["Local search", "Semantic search", "Cache hit rate"]
            }
        )
        print(f"✅ Task created: {task2['id']}")
        
        result2 = await client.wait_for_completion(task2['id'])
        if result2['status'] == 'completed':
            print(f"✅ Tests complete: {'PASSED' if result2['result']['passed'] else 'FAILED'}")
            for test in result2['result']['results']:
                print(f"  - {test['scenario']}: {'✅' if test.get('passed', True) else '❌'}")
        print()
        
        # Test 3: Optimize Cache Strategy
        print("🚀 Test 3: Optimizing Cache Strategy...")
        task3 = await client.create_task(
            skill="optimize_cache_strategy",
            parameters={
                "current_strategy": {
                    "storage": "IndexedDB",
                    "ttl": 3600,
                    "max_size": 10
                },
                "constraints": {
                    "max_cache_size": 50,
                    "target_hit_rate": 0.95
                }
            }
        )
        print(f"✅ Task created: {task3['id']}")
        
        result3 = await client.wait_for_completion(task3['id'])
        if result3['status'] == 'completed':
            print("✅ Optimization complete!")
            print("📊 Expected improvements:")
            for key, value in result3['result']['expected_improvements'].items():
                print(f"  - {key}: {value}")
            print("\n💻 Implementation code provided")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await client.close()

if __name__ == "__main__":
    print("🚀 A2A Protocol RAG Evaluator Test Client")
    print("=" * 50)
    asyncio.run(test_rag_evaluator())