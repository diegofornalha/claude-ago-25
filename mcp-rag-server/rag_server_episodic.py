#!/usr/bin/env python3
"""
MCP RAG Server with Episodic Memory Integration
Combines traditional RAG with revolutionary Episodic learning
"""

import os
import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Import traditional RAG
from rag_server_v2 import RAGServer as TraditionalRAG

# Import Episodic RAG
from episodic_rag_prototype import EpisodicRAG

# Load environment variables
load_dotenv()

# Configuration
CONFIG = {
    'host': os.getenv('HOST', '0.0.0.0'),
    'port': int(os.getenv('PORT', 5001)),
    'episodic_enabled': os.getenv('EPISODIC_ENABLED', 'true').lower() == 'true',
    'cache_dir': os.getenv('CACHE_DIR', '.cache'),
    'episodic_cache_dir': os.getenv('EPISODIC_CACHE_DIR', '.episodic_cache'),
    'debug': os.getenv('DEBUG', 'false').lower() == 'true'
}

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HybridRAGServer:
    """
    Hybrid RAG Server combining Traditional and Episodic approaches
    """
    
    def __init__(self):
        # Traditional RAG
        self.traditional_rag = TraditionalRAG(cache_dir=CONFIG['cache_dir'])
        
        # Episodic RAG (optional)
        self.episodic_rag = None
        if CONFIG['episodic_enabled']:
            self.episodic_rag = EpisodicRAG(cache_dir=CONFIG['episodic_cache_dir'])
            logger.info("Episodic RAG enabled with memory and learning")
        else:
            logger.info("Running in traditional RAG mode only")
        
        # Flask app
        self.app = Flask(__name__)
        CORS(self.app)
        
        # Setup routes
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            return jsonify({
                'status': 'healthy',
                'mode': 'hybrid' if self.episodic_rag else 'traditional',
                'episodic_enabled': CONFIG['episodic_enabled']
            })
        
        @self.app.route('/add', methods=['POST'])
        def add_document():
            data = request.json
            
            # Add to traditional RAG
            result = self.traditional_rag.add_document(
                data.get('content'),
                data.get('metadata', {}),
                data.get('doc_id')
            )
            
            return jsonify(result)
        
        @self.app.route('/search', methods=['POST'])
        def search():
            data = request.json
            query = data.get('query', '')
            limit = data.get('limit', 5)
            use_episodic = data.get('use_episodic', CONFIG['episodic_enabled'])
            
            if use_episodic and self.episodic_rag:
                # Use Episodic RAG
                return self._episodic_search(query, limit)
            else:
                # Use Traditional RAG
                results = self.traditional_rag.search(query, limit)
                return jsonify({
                    'results': results,
                    'mode': 'traditional',
                    'query': query
                })
        
        @self.app.route('/search/progressive', methods=['POST'])
        def progressive_search():
            """Progressive search with streaming results"""
            if not self.episodic_rag:
                return jsonify({'error': 'Episodic RAG not enabled'}), 400
            
            data = request.json
            query = data.get('query', '')
            
            # Start async search
            task_id = self._start_progressive_search(query)
            
            return jsonify({
                'task_id': task_id,
                'status': 'started',
                'message': 'Progressive search initiated'
            })
        
        @self.app.route('/stats', methods=['GET'])
        def stats():
            stats = {
                'traditional': self.traditional_rag.get_stats()
            }
            
            if self.episodic_rag:
                stats['episodic'] = self.episodic_rag.get_learning_stats()
            
            return jsonify(stats)
        
        @self.app.route('/compare', methods=['POST'])
        def compare():
            """Compare traditional vs episodic results"""
            if not self.episodic_rag:
                return jsonify({'error': 'Episodic RAG not enabled'}), 400
            
            data = request.json
            query = data.get('query', '')
            
            # Get results from both
            traditional_results = self.traditional_rag.search(query, 5)
            episodic_results = asyncio.run(
                self._get_episodic_results(query)
            )
            
            return jsonify({
                'query': query,
                'traditional': {
                    'results': traditional_results,
                    'latency': 200  # Simulated
                },
                'episodic': episodic_results
            })
    
    def _episodic_search(self, query: str, limit: int) -> Dict:
        """Execute episodic search"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            results = loop.run_until_complete(
                self._get_episodic_results(query, limit)
            )
            return jsonify(results)
        finally:
            loop.close()
    
    async def _get_episodic_results(self, query: str, limit: int = 5) -> Dict:
        """Get results from episodic RAG"""
        all_results = []
        phases = []
        
        async for result in self.episodic_rag.progressive_search(query):
            phases.append({
                'phase': result['phase'],
                'latency': result['latency'],
                'confidence': result['confidence'],
                'num_results': len(result['results'])
            })
            
            # Keep best results
            if result['results']:
                all_results = result['results'][:limit]
        
        return {
            'results': all_results,
            'mode': 'episodic',
            'phases': phases,
            'query': query,
            'learning_stats': self.episodic_rag.get_learning_stats()
        }
    
    def _start_progressive_search(self, query: str) -> str:
        """Start progressive search in background"""
        import uuid
        task_id = str(uuid.uuid4())
        
        # In production, use a task queue like Celery
        # For now, just return the task ID
        logger.info(f"Started progressive search task {task_id} for query: {query}")
        
        return task_id
    
    def run(self):
        """Run the server"""
        logger.info(f"Starting Hybrid RAG Server on {CONFIG['host']}:{CONFIG['port']}")
        logger.info(f"Episodic RAG: {'Enabled' if CONFIG['episodic_enabled'] else 'Disabled'}")
        
        self.app.run(
            host=CONFIG['host'],
            port=CONFIG['port'],
            debug=CONFIG['debug']
        )

def main():
    """Main entry point"""
    server = HybridRAGServer()
    
    # Print startup info
    print("=" * 60)
    print("🚀 MCP RAG Server - Hybrid Mode")
    print("=" * 60)
    print(f"Mode: {'Hybrid (Traditional + Episodic)' if CONFIG['episodic_enabled'] else 'Traditional Only'}")
    print(f"URL: http://{CONFIG['host']}:{CONFIG['port']}")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST /add           - Add document")
    print("  POST /search        - Search (traditional or episodic)")
    print("  POST /search/progressive - Progressive episodic search")
    print("  POST /compare       - Compare both approaches")
    print("  GET  /stats         - View statistics")
    print("  GET  /health        - Health check")
    print("=" * 60)
    
    try:
        server.run()
    except KeyboardInterrupt:
        print("\n\nShutting down gracefully...")
        logger.info("Server stopped by user")

if __name__ == "__main__":
    main()