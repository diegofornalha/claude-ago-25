// Servidor de teste simples para verificar RAG
const express = require('express');
const path = require('path');
const app = express();

// Servir arquivos estáticos do build
app.use(express.static(path.join(__dirname, 'dist')));

// Rota catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5173;
app.listen(PORT, () => {
  console.log(`Frontend rodando em http://localhost:${PORT}`);
  console.log(`Acesse RAG Manager em: http://localhost:${PORT}/rag`);
});