# MCP RAG Server Docker Image
# Multi-stage build for optimized size

# Stage 1: Builder
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 raguser

# Set working directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /root/.local /home/raguser/.local

# Copy application files
COPY --chown=raguser:raguser . .

# Create cache directory
RUN mkdir -p /home/raguser/.claude/mcp-rag-cache && \
    chown -R raguser:raguser /home/raguser/.claude

# Switch to non-root user
USER raguser

# Update PATH
ENV PATH=/home/raguser/.local/bin:$PATH

# Environment variables
ENV RAG_CACHE_DIR=/home/raguser/.claude/mcp-rag-cache \
    RAG_LOG_LEVEL=INFO \
    RAG_SERVER_MODE=enhanced \
    RAG_USE_EMBEDDINGS=true \
    RAG_USE_TFIDF=true \
    RAG_MAX_DOCUMENTS=10000 \
    RAG_SERVER_NAME=rag-server-docker \
    RAG_SERVER_VERSION=3.1.0 \
    PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}' | \
        python rag_server.py > /dev/null 2>&1 || exit 1

# Volume for persistent cache
VOLUME ["/home/raguser/.claude/mcp-rag-cache"]

# Expose port for API (if using create_api_endpoint.py)
EXPOSE 5001

# Default command - run MCP server
CMD ["python", "rag_server.py"]

# Alternative commands (uncomment as needed):
# CMD ["python", "create_api_endpoint.py"]  # For REST API
# CMD ["bash", "setup.sh"]  # For setup
# CMD ["python", "test_mcp.py"]  # For testing