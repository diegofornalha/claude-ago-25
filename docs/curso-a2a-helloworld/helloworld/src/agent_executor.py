import logging
from typing import Optional

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.types import (
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
)
from a2a.utils import (
    new_agent_text_message,
    new_data_artifact,
    new_task,
    new_text_artifact,
)

from agent import HelloWorldAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HelloWorldAgentExecutor(AgentExecutor):
    """
    HelloWorld agent executor with complete TaskStatusUpdateEvent implementation.
    """

    def __init__(self):
        self.agent = HelloWorldAgent()
        logger.info("✅ HelloWorldAgentExecutor initialized with TaskStatusUpdateEvent support")

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        """Execute a HelloWorld task with complete lifecycle management."""
        query = context.get_user_input()
        task = context.current_task
        
        # Create task if not exists
        if not task:
            task = new_task(context.message)
            await event_queue.enqueue_event(task)
            logger.info(f"📋 Created new task: {task.id}")

        try:
            # Mark task as working
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(
                        state=TaskState.working,
                        message=new_agent_text_message(
                            "Processing your request...",
                            task.contextId,
                            task.id,
                        ),
                    ),
                    final=False,
                    contextId=task.contextId,
                    taskId=task.id,
                )
            )
            logger.info(f"🔄 Task {task.id} marked as WORKING")

            # Process the request
            result = await self.agent.process_request(query, task.contextId)
            
            is_task_complete = result.get("is_task_complete", True)
            require_user_input = result.get("require_user_input", False)
            result_text = result.get("result", "Hello World!")
            data = result.get("data", {})

            # Create artifact based on result
            if data:
                # If we have structured data, create a data artifact
                artifact = new_data_artifact(
                    name="super_hello_world_result",
                    description="SuperHelloWorld response with extra data",
                    data=data,
                )
                logger.info(f"📊 Created data artifact for task {task.id}")
            else:
                # Otherwise create a text artifact
                artifact = new_text_artifact(
                    name="hello_world_result",
                    description="HelloWorld response",
                    text=result_text,
                )
                logger.info(f"📝 Created text artifact for task {task.id}")

            # Send artifact
            await event_queue.enqueue_event(
                TaskArtifactUpdateEvent(
                    append=False,
                    contextId=task.contextId,
                    taskId=task.id,
                    lastChunk=True,
                    artifact=artifact,
                )
            )
            logger.info(f"📤 Artifact sent for task {task.id}")

            # Mark task as completed
            if is_task_complete:
                await event_queue.enqueue_event(
                    TaskStatusUpdateEvent(
                        status=TaskStatus(state=TaskState.completed),
                        final=True,
                        contextId=task.contextId,
                        taskId=task.id,
                    )
                )
                logger.info(f"✅ Task {task.id} marked as COMPLETED")
            elif require_user_input:
                await event_queue.enqueue_event(
                    TaskStatusUpdateEvent(
                        status=TaskStatus(
                            state=TaskState.input_required,
                            message=new_agent_text_message(
                                "Please provide additional information.",
                                task.contextId,
                                task.id,
                            ),
                        ),
                        final=True,
                        contextId=task.contextId,
                        taskId=task.id,
                    )
                )
                logger.info(f"❓ Task {task.id} marked as INPUT_REQUIRED")

        except Exception as e:
            logger.error(f"❌ Error executing task {task.id}: {e}")
            # Mark task as failed
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(
                        state=TaskState.failed,
                        message=new_agent_text_message(
                            f"Error: {str(e)}",
                            task.contextId,
                            task.id,
                        ),
                    ),
                    final=True,
                    contextId=task.contextId,
                    taskId=task.id,
                )
            )
            logger.info(f"❌ Task {task.id} marked as FAILED")

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        """Cancel a running task."""
        task = context.current_task
        if task:
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(
                        state=TaskState.cancelled,
                        message=new_agent_text_message(
                            "Task cancelled by user.",
                            task.contextId,
                            task.id,
                        ),
                    ),
                    final=True,
                    contextId=task.contextId,
                    taskId=task.id,
                )
            )
            logger.info(f"🚫 Task {task.id} marked as CANCELLED")