#!/usr/bin/env python3
"""
A2A Protocol Server for Offline-First RAG Evaluator Agent
Implements the A2A Protocol specification for agent-to-agent communication
"""

import json
import uuid
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum
from pathlib import Path
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# A2A Protocol Models
class Role(str, Enum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"

class TaskStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class TextPart(BaseModel):
    text: str
    format: str = "plain"

class Part(BaseModel):
    root: TextPart

class Message(BaseModel):
    messageId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Role
    parts: List[Part]
    taskId: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict] = None

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contextId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: TaskStatus = TaskStatus.CREATED
    priority: TaskPriority = TaskPriority.NORMAL
    skill: str
    parameters: Dict[str, Any]
    history: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict] = None
    metadata: Optional[Dict] = None

class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Dict[str, Any]
    id: Optional[str] = None

class JsonRpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Optional[Any] = None
    error: Optional[Dict] = None
    id: Optional[str] = None

# Load agent card
agent_card_path = Path(__file__).parent / "agent-card.json"
with open(agent_card_path) as f:
    AGENT_CARD = json.load(f)

# In-memory task storage
tasks: Dict[str, Task] = {}

# FastAPI app
app = FastAPI(
    title="Offline-First RAG Evaluator Agent",
    description="A2A Protocol compliant agent for evaluating RAG systems",
    version="1.0.0"
)

# RAG Evaluation Logic
class RAGEvaluator:
    """Core evaluation logic for RAG systems"""
    
    @staticmethod
    async def evaluate_system(target_system: str, depth: str = "comprehensive", focus_areas: List[str] = None) -> Dict:
        """Evaluate a RAG system for offline-first capabilities"""
        
        # Simulated evaluation logic
        score = 0
        report_sections = []
        recommendations = []
        
        # Architecture evaluation
        report_sections.append("## Architecture Analysis\n")
        report_sections.append("✅ IndexedDB implementation detected\n")
        report_sections.append("✅ Service Worker configured\n")
        report_sections.append("✅ WebSocket sync implemented\n")
        score += 30
        
        # Cache efficiency
        if not focus_areas or "cache" in focus_areas:
            report_sections.append("\n## Cache Efficiency\n")
            report_sections.append("- Cache hit rate: 92%\n")
            report_sections.append("- Storage used: 47KB of 50MB\n")
            report_sections.append("- Compression enabled: Yes\n")
            score += 20
        
        # Sync reliability
        if not focus_areas or "sync" in focus_areas:
            report_sections.append("\n## Synchronization\n")
            report_sections.append("- Auto-sync configured\n")
            report_sections.append("- Conflict resolution: CRDT-based\n")
            report_sections.append("- Retry mechanism: Exponential backoff\n")
            score += 20
            
            recommendations.append({
                "priority": "medium",
                "title": "Implement queue-based sync",
                "description": "Add offline queue for sync operations",
                "implementation": "Use IndexedDB to queue sync operations when offline"
            })
        
        # Performance
        if not focus_areas or "performance" in focus_areas:
            report_sections.append("\n## Performance Metrics\n")
            report_sections.append("- Local search: <50ms\n")
            report_sections.append("- Index size: Optimized\n")
            report_sections.append("- Memory usage: Low\n")
            score += 15
        
        # UX
        if not focus_areas or "ux" in focus_areas:
            report_sections.append("\n## User Experience\n")
            report_sections.append("- Offline indicators: Present\n")
            report_sections.append("- Sync feedback: Real-time\n")
            report_sections.append("- Error handling: Graceful\n")
            score += 15
            
            recommendations.append({
                "priority": "high",
                "title": "Add offline mode indicator",
                "description": "Make offline status more prominent in UI",
                "implementation": "Add persistent banner when offline"
            })
        
        return {
            "score": min(score, 100),
            "report": "".join(report_sections),
            "recommendations": recommendations
        }
    
    @staticmethod
    async def test_offline(feature: str, scenarios: List[str] = None) -> Dict:
        """Test specific features in offline mode"""
        
        results = []
        issues = []
        
        # Simulate testing
        if feature == "search":
            results.append({"scenario": "Local search", "passed": True, "time": "45ms"})
            results.append({"scenario": "Semantic search", "passed": True, "time": "120ms"})
        elif feature == "sync":
            results.append({"scenario": "Queue sync", "passed": True})
            results.append({"scenario": "Conflict resolution", "passed": False})
            issues.append("Conflict resolution needs manual intervention")
        
        return {
            "passed": len(issues) == 0,
            "results": results,
            "issues": issues
        }
    
    @staticmethod
    async def optimize_cache(current_strategy: Dict, constraints: Dict = None) -> Dict:
        """Optimize caching strategy"""
        
        optimized = {
            "storage": "IndexedDB",
            "fallback": "localStorage",
            "compression": "gzip",
            "ttl": 86400,
            "max_size": constraints.get("max_cache_size", 50) if constraints else 50,
            "eviction": "LRU",
            "prefetch": ["frequently_accessed", "recent"]
        }
        
        improvements = {
            "expected_hit_rate": "95%",
            "storage_reduction": "30%",
            "load_time_improvement": "60%"
        }
        
        code = """
// Optimized cache strategy implementation
const cacheConfig = {
    name: 'rag-cache-optimized',
    version: 2,
    stores: {
        documents: {
            keyPath: 'id',
            indexes: ['url', 'category', 'timestamp'],
            compression: true
        }
    },
    ttl: 86400000, // 24 hours
    maxSize: 50 * 1024 * 1024, // 50MB
    evictionPolicy: 'LRU'
};

class OptimizedCache {
    constructor() {
        this.initDB();
    }
    
    async initDB() {
        // IndexedDB initialization with optimizations
        this.db = await this.openDB(cacheConfig);
    }
    
    async get(key) {
        // Try IndexedDB first, fallback to localStorage
        try {
            return await this.getFromIndexedDB(key);
        } catch {
            return this.getFromLocalStorage(key);
        }
    }
}
"""
        
        return {
            "optimized_strategy": optimized,
            "expected_improvements": improvements,
            "implementation_code": code
        }

# Initialize evaluator
evaluator = RAGEvaluator()

# A2A Protocol Endpoints
@app.get("/.well-known/agent-card")
async def get_agent_card():
    """Return agent capabilities according to A2A spec"""
    return JSONResponse(content=AGENT_CARD)

@app.post("/a2a")
async def handle_a2a_request(request: JsonRpcRequest):
    """Main A2A protocol endpoint"""
    
    try:
        if request.method == "a2a.createTask":
            # Create new task
            skill = request.params.get("skill")
            parameters = request.params.get("parameters", {})
            
            # Validate skill
            if not any(s["name"] == skill for s in AGENT_CARD["skills"]):
                raise HTTPException(400, f"Skill '{skill}' not found")
            
            # Create task
            task = Task(
                skill=skill,
                parameters=parameters,
                status=TaskStatus.RUNNING
            )
            tasks[task.id] = task
            
            # Start task execution in background
            asyncio.create_task(execute_task(task))
            
            return JsonRpcResponse(
                result=task.dict(),
                id=request.id
            )
        
        elif request.method == "a2a.sendMessage":
            # Add message to task
            task_id = request.params.get("taskId")
            message_data = request.params.get("message")
            
            if task_id not in tasks:
                raise HTTPException(404, "Task not found")
            
            task = tasks[task_id]
            message = Message(**message_data)
            task.history.append(message)
            task.updated_at = datetime.utcnow()
            
            # Generate response
            response_message = await process_message(task, message)
            task.history.append(response_message)
            
            return JsonRpcResponse(
                result=response_message.dict(),
                id=request.id
            )
        
        elif request.method == "a2a.getTask":
            # Get task status
            task_id = request.params.get("taskId")
            
            if task_id not in tasks:
                raise HTTPException(404, "Task not found")
            
            return JsonRpcResponse(
                result=tasks[task_id].dict(),
                id=request.id
            )
        
        else:
            raise HTTPException(400, f"Method '{request.method}' not supported")
            
    except Exception as e:
        logger.error(f"Error handling request: {e}")
        return JsonRpcResponse(
            error={
                "code": -32603,
                "message": str(e)
            },
            id=request.id
        )

@app.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task details"""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    return tasks[task_id].dict()

@app.get("/a2a/tasks/{task_id}/status")
async def get_task_status(task_id: str):
    """Get task status"""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    
    task = tasks[task_id]
    return {
        "id": task.id,
        "status": task.status,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "completed_at": task.completed_at,
        "error": task.error
    }

@app.post("/a2a/tasks/{task_id}/messages")
async def send_message(task_id: str, message: Message):
    """Send message to task"""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    
    task = tasks[task_id]
    task.history.append(message)
    task.updated_at = datetime.utcnow()
    
    # Process and generate response
    response = await process_message(task, message)
    task.history.append(response)
    
    return response.dict()

@app.get("/a2a/tasks/{task_id}/stream")
async def stream_task(task_id: str):
    """Stream task updates via SSE"""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    
    async def event_generator():
        task = tasks[task_id]
        last_update = task.updated_at
        
        while task.status in [TaskStatus.RUNNING, TaskStatus.CREATED]:
            if task.updated_at > last_update:
                yield f"data: {json.dumps({'type': 'update', 'task': task.dict()})}\n\n"
                last_update = task.updated_at
            
            await asyncio.sleep(1)
            task = tasks.get(task_id)
            
            if not task:
                break
        
        # Send final status
        if task:
            yield f"data: {json.dumps({'type': 'complete', 'task': task.dict()})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

# Task execution
async def execute_task(task: Task):
    """Execute task based on skill"""
    try:
        if task.skill == "evaluate_rag_system":
            result = await evaluator.evaluate_system(
                task.parameters.get("target_system"),
                task.parameters.get("evaluation_depth", "comprehensive"),
                task.parameters.get("focus_areas")
            )
        elif task.skill == "test_offline_functionality":
            result = await evaluator.test_offline(
                task.parameters.get("feature"),
                task.parameters.get("test_scenarios")
            )
        elif task.skill == "optimize_cache_strategy":
            result = await evaluator.optimize_cache(
                task.parameters.get("current_strategy", {}),
                task.parameters.get("constraints")
            )
        else:
            raise ValueError(f"Unknown skill: {task.skill}")
        
        task.result = result
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        
    except Exception as e:
        task.error = str(e)
        task.status = TaskStatus.FAILED
        task.completed_at = datetime.utcnow()
        logger.error(f"Task {task.id} failed: {e}")
    
    task.updated_at = datetime.utcnow()

async def process_message(task: Task, message: Message) -> Message:
    """Process incoming message and generate response"""
    
    # Extract message content
    content = message.parts[0].root.text if message.parts else ""
    
    # Generate response based on task context
    if "help" in content.lower():
        response_text = f"I can help you with {task.skill}. Current task status: {task.status}"
    elif "status" in content.lower():
        response_text = f"Task {task.id} is {task.status}. Created at {task.created_at}"
    else:
        response_text = f"Processing your request for {task.skill}..."
    
    return Message(
        role=Role.AGENT,
        parts=[Part(root=TextPart(text=response_text))],
        taskId=task.id
    )

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": AGENT_CARD["name"],
        "version": AGENT_CARD["version"],
        "protocol": "a2a",
        "tasks_active": len([t for t in tasks.values() if t.status == TaskStatus.RUNNING])
    }

if __name__ == "__main__":
    print(f"🚀 Starting {AGENT_CARD['name']} A2A Server")
    print(f"📍 Agent Card: http://localhost:8800/.well-known/agent-card")
    print(f"🔌 A2A Endpoint: http://localhost:8800/a2a")
    print(f"✅ Ready to evaluate RAG systems!")
    
    uvicorn.run(app, host="0.0.0.0", port=8800)