#!/usr/bin/env python3
"""
API HTTP para o RAG Server Improved
Fornece endpoints REST para integração com o frontend em localhost:5173
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from pathlib import Path

# Adicionar caminho do servidor melhorado
sys.path.insert(0, str(Path(__file__).parent))
from rag_server_improved import ImprovedRAGServer

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173'])  # Permitir CORS para o frontend

# Instância única do servidor
rag_server = ImprovedRAGServer()

@app.route('/api/rag/documents', methods=['GET'])
def get_documents():
    """Lista todos os documentos"""
    try:
        documents = []
        for doc in rag_server.documents:
            documents.append({
                'id': doc.id,
                'title': doc.title,
                'content': doc.content[:200] + '...' if len(doc.content) > 200 else doc.content,
                'type': doc.type.value,
                'source': doc.source,
                'metadata': doc.metadata,
                'created_at': doc.created_at
            })
        
        stats = rag_server.get_stats()
        return jsonify({
            'documents': documents,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rag/search', methods=['POST'])
def search_documents():
    """Busca vetorial em documentos"""
    try:
        data = request.json
        query = data.get('query', '')
        limit = data.get('limit', 5)
        
        results = rag_server.search(query, limit)
        return jsonify({
            'query': query,
            'results': results,
            'total': len(results)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rag/add', methods=['POST'])
def add_document():
    """Adiciona novo documento"""
    try:
        data = request.json
        doc = rag_server.add_document(data)
        return jsonify({
            'success': True,
            'document': doc.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rag/remove/<doc_id>', methods=['DELETE'])
def remove_document(doc_id):
    """Remove documento por ID"""
    try:
        success = rag_server.remove_document(doc_id)
        if success:
            return jsonify({'success': True, 'message': f'Documento {doc_id} removido'})
        else:
            return jsonify({'error': 'Documento não encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rag/stats', methods=['GET'])
def get_stats():
    """Retorna estatísticas do sistema"""
    try:
        stats = rag_server.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rag/health', methods=['GET'])
def health_check():
    """Verifica se o servidor está funcionando"""
    return jsonify({
        'status': 'healthy',
        'version': rag_server.version,
        'documents_count': len(rag_server.documents)
    })

if __name__ == '__main__':
    print("🚀 RAG API Server iniciado em http://localhost:5001")
    print("📊 Documentos carregados:", len(rag_server.documents))
    print("✨ Endpoints disponíveis:")
    print("  - GET  /api/rag/documents")
    print("  - POST /api/rag/search")
    print("  - POST /api/rag/add")
    print("  - DELETE /api/rag/remove/<id>")
    print("  - GET  /api/rag/stats")
    print("  - GET  /api/rag/health")
    
    app.run(host='0.0.0.0', port=5001, debug=True)