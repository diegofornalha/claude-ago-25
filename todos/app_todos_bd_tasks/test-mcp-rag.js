#!/usr/bin/env node

const { spawn } = require('child_process');

async function testMCPRAG() {
  console.log('🧪 Testando MCP RAG Server...\n');
  
  const server = spawn('python3', ['/Users/agents/.claude/mcp-rag-server/rag_server.py'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let buffer = '';
  
  server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log('✅ Resposta:', JSON.stringify(response, null, 2));
        } catch (error) {
          console.log('❌ Erro ao parsear:', line);
        }
      }
    }
  });
  
  server.stderr.on('data', (data) => {
    console.log('⚠️  Stderr:', data.toString());
  });
  
  // Teste 1: Initialize
  console.log('1️⃣ Testando initialize...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { capabilities: {} }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Teste 2: Tools list
  console.log('\n2️⃣ Testando tools/list...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Teste 3: Search
  console.log('\n3️⃣ Testando search...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: { query: 'MCP', limit: 2 }
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  server.kill();
  console.log('\n✅ Teste concluído!');
}

testMCPRAG().catch(console.error); 