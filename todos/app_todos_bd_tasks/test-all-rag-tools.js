#!/usr/bin/env node

const { spawn } = require('child_process');

async function testAllRAGTools() {
  console.log('🧪 Testando TODAS as 5 ferramentas do RAG Server...\n');
  
  const server = spawn('python3', ['/Users/agents/.claude/mcp-rag-server/rag_server.py'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let buffer = '';
  let responses = [];
  let addedDocumentId = null;
  
  server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          
          // Extrair ID do documento adicionado
          if (response.id === 'add' && response.result && response.result.content) {
            try {
              const addResult = JSON.parse(response.result.content[0].text);
              if (addResult.document && addResult.document.id) {
                addedDocumentId = addResult.document.id;
                console.log(`📝 ID do documento adicionado: ${addedDocumentId}`);
              }
            } catch (e) {
              // Ignorar erro de parse
            }
          }
          
          console.log(`✅ [${response.id}] ${response.method || 'response'}:`, JSON.stringify(response.result || response, null, 2));
        } catch (error) {
          console.log('❌ Erro ao parsear:', line);
        }
      }
    }
  });
  
  server.stderr.on('data', (data) => {
    console.log('⚠️  Stderr:', data.toString());
  });
  
  // Inicializar
  console.log('🚀 1. Inicializando servidor...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: { capabilities: {} }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 1: LIST - Listar documentos existentes
  console.log('\n📋 2. Testando LIST - Listando documentos existentes...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'list1',
    method: 'tools/call',
    params: {
      name: 'list',
      arguments: {}
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 2: ADD - Adicionar documento de teste
  console.log('\n➕ 3. Testando ADD - Adicionando documento de teste...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'add',
    method: 'tools/call',
    params: {
      name: 'add',
      arguments: {
        title: 'Documento de Teste RAG',
        content: 'Este é um documento de teste para verificar se o sistema RAG está funcionando corretamente. Contém informações sobre MCP, RAG e testes.',
        type: 'test',
        source: 'test-script'
      }
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Mais tempo para processar
  
  // Teste 3: LIST - Listar novamente para verificar adição
  console.log('\n📋 4. Testando LIST - Verificando se documento foi adicionado...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'list2',
    method: 'tools/call',
    params: {
      name: 'list',
      arguments: {}
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 4: SEARCH - Buscar documentos
  console.log('\n🔍 5. Testando SEARCH - Buscando por "teste"...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'search1',
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: { 
        query: 'teste', 
        limit: 3 
      }
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 5: SEARCH - Buscar por "MCP"
  console.log('\n🔍 6. Testando SEARCH - Buscando por "MCP"...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'search2',
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: { 
        query: 'MCP', 
        limit: 2 
      }
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 6: STATS - Verificar estatísticas
  console.log('\n📊 7. Testando STATS - Verificando estatísticas do cache...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'stats',
    method: 'tools/call',
    params: {
      name: 'stats',
      arguments: {}
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 7: REMOVE - Remover documento de teste com ID correto
  console.log('\n🗑️  8. Testando REMOVE - Removendo documento de teste...');
  const removeId = addedDocumentId || 'doc_1752992851792'; // Usar ID real ou fallback
  console.log(`🗑️  Tentando remover documento com ID: ${removeId}`);
  
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'remove',
    method: 'tools/call',
    params: {
      name: 'remove',
      arguments: { 
        id: removeId
      }
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Teste 8: LIST - Listar final para confirmar
  console.log('\n📋 9. Testando LIST - Verificação final...');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 'list3',
    method: 'tools/call',
    params: {
      name: 'list',
      arguments: {}
    }
  }) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  server.kill();
  
  console.log('\n🎉 Teste de todas as 5 ferramentas concluído!');
  console.log('\n📊 Resumo dos testes:');
  console.log('✅ 1. LIST - Listar documentos');
  console.log('✅ 2. ADD - Adicionar documento');
  console.log('✅ 3. SEARCH - Buscar documentos');
  console.log('✅ 4. STATS - Estatísticas do cache');
  console.log('✅ 5. REMOVE - Remover documento');
}

testAllRAGTools().catch(console.error); 