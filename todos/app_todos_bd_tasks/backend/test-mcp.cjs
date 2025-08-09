const { spawn } = require('child_process');

console.log('Testando servidor MCP...');

const proc = spawn('python3', ['/Users/agents/.claude/mcp-rag-server/rag_server.py'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

proc.stdout.on('data', (data) => {
  console.log('STDOUT recebido:', data.toString());
  console.log('Bytes:', Array.from(data));
  buffer += data.toString();
  
  // Tentar processar linhas
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      console.log('Linha:', line);
      try {
        const parsed = JSON.parse(line);
        console.log('JSON válido:', parsed);
      } catch (e) {
        console.log('Erro ao fazer parse:', e.message);
      }
    }
  });
});

proc.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

proc.on('close', (code) => {
  console.log('Processo encerrado com código:', code);
});

// Enviar requisição de inicialização
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {}
};

setTimeout(() => {
  console.log('Enviando requisição:', request);
  proc.stdin.write(JSON.stringify(request) + '\n');
}, 100);

// Encerrar após 2 segundos
setTimeout(() => {
  proc.kill();
}, 2000);