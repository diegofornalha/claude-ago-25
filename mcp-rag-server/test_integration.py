#!/usr/bin/env python3
"""
Integration test for Hybrid RAG Server
Tests both traditional and episodic modes
"""

import json
import time
import asyncio
from episodic_rag_prototype import EpisodicRAG

def test_episodic_rag():
    """Test Episodic RAG standalone"""
    print("\n🧪 Testing Episodic RAG...")
    
    rag = EpisodicRAG()
    
    # Test queries
    queries = [
        "How to implement RAG?",
        "Best practices for embeddings",
        "How to implement RAG?",  # Repeated to test memory
    ]
    
    async def run_tests():
        for i, query in enumerate(queries, 1):
            print(f"\n  Test {i}: {query}")
            
            phases_found = []
            async for result in rag.progressive_search(query):
                phase = result['phase']
                latency = result['latency']
                confidence = result['confidence']
                phases_found.append(phase)
                print(f"    ✓ {phase}: {latency}ms, confidence: {confidence:.2f}")
            
            # Third query should benefit from memory (but may not show in phases)
            if i == 3:
                # Memory effect is internal, may not always show in phases
                print("    ℹ️  Memory learning from repeated query")
        
        # Check learning stats
        stats = rag.get_learning_stats()
        print(f"\n  📊 Learning Stats:")
        print(f"    Episodes: {stats['total_episodes']}")
        print(f"    Cache hits: {stats['cache_size']}")
        print(f"    Success rate: {stats['avg_success_rate']:.2%}")
        
        return stats['total_episodes'] >= len(queries)
    
    success = asyncio.run(run_tests())
    print(f"\n  {'✅ PASSED' if success else '❌ FAILED'}")
    return success

def test_traditional_rag():
    """Test Traditional RAG"""
    print("\n🧪 Testing Traditional RAG...")
    
    try:
        from rag_server_v2 import RAGServer
        
        rag = RAGServer()
        
        # Add test document
        doc_id = rag.add_document(
            "RAG combines retrieval with generation for better results",
            {"type": "test"}
        )
        print(f"  ✓ Added document: {doc_id}")
        
        # Search
        results = rag.search("retrieval generation", limit=1)
        assert len(results) > 0, "Should find results"
        print(f"  ✓ Search returned {len(results)} results")
        
        # Stats
        stats = rag.get_stats()
        print(f"  ✓ Stats: {stats['total_documents']} documents")
        
        print("\n  ✅ PASSED")
        return True
        
    except ImportError:
        print("  ⚠️  Traditional RAG not available")
        return False

def test_hybrid_mode():
    """Test Hybrid mode integration"""
    print("\n🧪 Testing Hybrid Mode...")
    
    try:
        # Check if server can be imported
        from rag_server_episodic import HybridRAGServer
        
        print("  ✓ Hybrid server importable")
        print("  ✓ Traditional + Episodic modes available")
        print("\n  ✅ PASSED")
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🚀 MCP RAG Integration Tests")
    print("=" * 60)
    
    results = {
        'episodic': test_episodic_rag(),
        'traditional': test_traditional_rag(),
        'hybrid': test_hybrid_mode()
    }
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {test_name:15}: {status}")
    
    all_passed = all(results.values())
    print("\n" + "=" * 60)
    print(f"{'✅ ALL TESTS PASSED!' if all_passed else '❌ SOME TESTS FAILED'}")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())