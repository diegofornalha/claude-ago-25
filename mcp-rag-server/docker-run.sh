#!/bin/bash
# Docker helper script for MCP RAG Server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_colored() {
    echo -e "${2}${1}${NC}"
}

show_help() {
    echo "MCP RAG Server Docker Helper"
    echo ""
    echo "Usage: ./docker-run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build Docker image"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        Show logs"
    echo "  test        Run tests"
    echo "  dev         Start development environment"
    echo "  shell       Open shell in container"
    echo "  mcp         Send MCP command (JSON via stdin)"
    echo "  backup      Backup data volume"
    echo "  restore     Restore data volume"
    echo "  clean       Clean up containers and volumes"
    echo "  status      Show container status"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./docker-run.sh build"
    echo "  ./docker-run.sh start"
    echo "  echo '{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"initialize\", \"params\": {}}' | ./docker-run.sh mcp"
}

# Main command handler
case "$1" in
    build)
        print_colored "🔨 Building Docker image..." "$YELLOW"
        docker-compose build
        print_colored "✅ Build complete!" "$GREEN"
        ;;
    
    start)
        print_colored "🚀 Starting services..." "$YELLOW"
        docker-compose up -d
        print_colored "✅ Services started!" "$GREEN"
        docker-compose ps
        ;;
    
    stop)
        print_colored "🛑 Stopping services..." "$YELLOW"
        docker-compose down
        print_colored "✅ Services stopped!" "$GREEN"
        ;;
    
    restart)
        print_colored "🔄 Restarting services..." "$YELLOW"
        docker-compose restart
        print_colored "✅ Services restarted!" "$GREEN"
        ;;
    
    logs)
        docker-compose logs -f "${2:-rag-server}"
        ;;
    
    test)
        print_colored "🧪 Running tests..." "$YELLOW"
        docker-compose --profile test up rag-test
        print_colored "✅ Tests complete!" "$GREEN"
        ;;
    
    dev)
        print_colored "💻 Starting development environment..." "$YELLOW"
        docker-compose --profile dev run --rm rag-dev
        ;;
    
    shell)
        print_colored "🐚 Opening shell..." "$YELLOW"
        docker-compose exec "${2:-rag-server}" /bin/bash
        ;;
    
    mcp)
        if [ -t 0 ]; then
            print_colored "📝 Enter MCP command (JSON):" "$YELLOW"
            read -r json_input
        else
            json_input=$(cat)
        fi
        echo "$json_input" | docker-compose exec -T rag-server python rag_server.py
        ;;
    
    backup)
        backup_file="${2:-rag-backup-$(date +%Y%m%d-%H%M%S).tar.gz}"
        print_colored "💾 Creating backup: $backup_file" "$YELLOW"
        docker run --rm -v mcp-rag-data:/data -v "$(pwd)":/backup \
            alpine tar czf "/backup/$backup_file" -C /data .
        print_colored "✅ Backup saved to $backup_file" "$GREEN"
        ;;
    
    restore)
        if [ -z "$2" ]; then
            print_colored "❌ Please specify backup file" "$RED"
            echo "Usage: ./docker-run.sh restore <backup-file>"
            exit 1
        fi
        print_colored "📂 Restoring from: $2" "$YELLOW"
        docker run --rm -v mcp-rag-data:/data -v "$(pwd)":/backup \
            alpine tar xzf "/backup/$2" -C /data
        print_colored "✅ Restore complete!" "$GREEN"
        ;;
    
    clean)
        print_colored "🧹 Cleaning up..." "$YELLOW"
        docker-compose down -v
        docker system prune -f
        print_colored "✅ Cleanup complete!" "$GREEN"
        ;;
    
    status)
        print_colored "📊 Container Status:" "$YELLOW"
        docker-compose ps
        echo ""
        print_colored "📈 Resource Usage:" "$YELLOW"
        docker stats --no-stream mcp-rag-server mcp-rag-api 2>/dev/null || true
        ;;
    
    help|--help|-h|"")
        show_help
        ;;
    
    *)
        print_colored "❌ Unknown command: $1" "$RED"
        echo ""
        show_help
        exit 1
        ;;
esac