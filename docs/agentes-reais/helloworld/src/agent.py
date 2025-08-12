import logging
from typing import Any, Dict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HelloWorldAgent:
    """Simple Hello World agent with multiple skills."""

    def __init__(self):
        self.name = "HelloWorld Agent"
        self.description = "Simple agent that provides hello world functionality"
        logger.info(f"🤖 {self.name} initialized")

    async def hello_world(self, query: str, session_id: str) -> Dict[str, Any]:
        """Process a hello world request."""
        logger.info(f"Processing hello_world request: {query}")
        result = "Hello World!"
        
        return {
            "is_task_complete": True,
            "require_user_input": False,
            "result": result,
            "success": True
        }

    async def super_hello_world(self, query: str, session_id: str) -> Dict[str, Any]:
        """Process a super hello world request."""
        logger.info(f"Processing super_hello_world request: {query}")
        result = "🌟 SUPER Hello World! 🌟"
        
        return {
            "is_task_complete": True,
            "require_user_input": False,
            "result": result,
            "success": True,
            "data": {
                "enthusiasm_level": "SUPER",
                "emoji_count": 2,
                "special_message": "You asked for SUPER, you got SUPER!"
            }
        }

    async def process_request(self, query: str, session_id: str, skill: str = None) -> Dict[str, Any]:
        """Process a general request and route to appropriate skill."""
        logger.info(f"Processing request - Query: '{query}', Skill: '{skill}', Session: {session_id}")
        
        # Route to appropriate skill based on query or skill parameter
        if skill == "super_hello_world" or "super" in query.lower():
            return await self.super_hello_world(query, session_id)
        else:
            return await self.hello_world(query, session_id)