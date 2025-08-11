import asyncio
import httpx
from a2a.client import A2AClient
from a2a.types import AgentCard, SendMessageRequest, MessageSendParams
from uuid import uuid4

async def main():
    # Agent card for the running helloworld agent
    agent_card = AgentCard(
        name="Hello World Agent",
        description="Just a hello world agent",
        url="http://localhost:9999/",
        version="1.0.0",
        defaultInputModes=["text"],
        defaultOutputModes=["text"],
        capabilities={"streaming": True},
        skills=[
            {
                "id": "find_and_greet_agent",
                "name": "Find and Greet Agent",
                "description": "Finds and greets another agent.",
                "tags": ["mcp", "greet"],
                "examples": ["find and greet an agent"]
            }
        ]
    )

    async with httpx.AsyncClient() as httpx_client:
        client = A2AClient(agent_card=agent_card, httpx_client=httpx_client)

        send_message_payload = {
            'message': {
                'role': 'user',
                'parts': [
                    {'kind': 'text', 'text': 'find and greet an agent'}
                ],
                'messageId': uuid4().hex,
            },
            'skill': 'find_and_greet_agent'
        }
        request = SendMessageRequest(
            id=str(uuid4()), params=MessageSendParams(**send_message_payload)
        )

        response = await client.send_message(request)
        print(f"Response from agent: {response}")

if __name__ == "__main__":
    asyncio.run(main())
