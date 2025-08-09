#!/usr/bin/env python3
"""
MCP RAG Server Smoke Test
Quick validation that the MCP server is working correctly
"""

import json
import subprocess
import sys
import os
from pathlib import Path

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'  # No Color

def print_colored(message, color=NC):
    """Print colored output"""
    print(f"{color}{message}{NC}")

def test_mcp_command(command, expected_keys=None, test_name="Test"):
    """Run MCP command and check response"""
    try:
        # Run the command
        process = subprocess.Popen(
            ['python3', 'rag_server_v2.py'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=json.dumps(command))
        
        # Parse response
        response = json.loads(stdout)
        
        # Check for errors
        if 'error' in response:
            print_colored(f"✗ {test_name} failed: {response['error']}", RED)
            return False
        
        # Check expected keys
        if expected_keys:
            result = response.get('result', {})
            for key in expected_keys:
                if key not in result:
                    print_colored(f"✗ {test_name} failed: Missing key '{key}'", RED)
                    return False
        
        print_colored(f"✓ {test_name} passed", GREEN)
        return True
        
    except json.JSONDecodeError as e:
        print_colored(f"✗ {test_name} failed: Invalid JSON response - {e}", RED)
        if stdout:
            print(f"  Output: {stdout[:200]}")
        return False
    except Exception as e:
        print_colored(f"✗ {test_name} failed: {e}", RED)
        return False

def main():
    """Run all smoke tests"""
    print_colored("🧪 MCP RAG Server Smoke Test v3.0", YELLOW)
    print("=" * 40)
    
    # Check if server file exists
    if not Path('rag_server_v2.py').exists():
        print_colored("✗ rag_server_v2.py not found", RED)
        sys.exit(1)
    
    # Check cache directory
    cache_dir = Path.home() / '.claude' / 'mcp-rag-cache'
    if not cache_dir.exists():
        print_colored(f"Creating cache directory: {cache_dir}", YELLOW)
        cache_dir.mkdir(parents=True, exist_ok=True)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Initialize
    print_colored("\n1. Testing MCP initialization...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"capabilities": {}}
    }
    if test_mcp_command(
        command, 
        expected_keys=['protocolVersion', 'capabilities', 'serverInfo'],
        test_name="Initialize"
    ):
        tests_passed += 1
    
    # Test 2: Tools List
    print_colored("\n2. Testing tools list...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    }
    if test_mcp_command(
        command,
        expected_keys=['tools'],
        test_name="Tools List"
    ):
        tests_passed += 1
    
    # Test 3: Add Document
    print_colored("\n3. Testing document addition...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "add",
            "arguments": {
                "title": "Test Document",
                "content": "This is a test document for MCP smoke test",
                "tags": ["test", "smoke"],
                "category": "testing"
            }
        }
    }
    if test_mcp_command(
        command,
        test_name="Add Document"
    ):
        tests_passed += 1
    
    # Test 4: Search
    print_colored("\n4. Testing search functionality...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "search",
            "arguments": {
                "query": "test",
                "limit": 5
            }
        }
    }
    if test_mcp_command(
        command,
        test_name="Search"
    ):
        tests_passed += 1
    
    # Test 5: Stats
    print_colored("\n5. Testing statistics...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "stats",
            "arguments": {}
        }
    }
    if test_mcp_command(
        command,
        test_name="Statistics"
    ):
        tests_passed += 1
    
    # Test 6: List Documents
    print_colored("\n6. Testing document listing...", YELLOW)
    tests_total += 1
    command = {
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": {
            "name": "list",
            "arguments": {}
        }
    }
    if test_mcp_command(
        command,
        test_name="List Documents"
    ):
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 40)
    if tests_passed == tests_total:
        print_colored(f"✅ All tests passed! ({tests_passed}/{tests_total})", GREEN)
        print_colored("\n✨ MCP RAG Server is working correctly!", GREEN)
        print("\nNext steps:")
        print("1. Configure Claude Desktop (see README.md)")
        print("2. Run the web API: python3 create_api_endpoint.py")
        print("3. Access the web UI: http://localhost:5173/rag")
        return 0
    else:
        print_colored(f"⚠️  Some tests failed ({tests_passed}/{tests_total})", YELLOW)
        print_colored("\nTroubleshooting:", YELLOW)
        print("1. Check if all dependencies are installed:")
        print("   pip install -r requirements.txt")
        print("2. Ensure cache directory has write permissions:")
        print(f"   chmod 755 {cache_dir}")
        print("3. Review the error messages above")
        return 1

if __name__ == "__main__":
    sys.exit(main())