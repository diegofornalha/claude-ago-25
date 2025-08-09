// Script rápido para testar se o servidor compila
console.log("Testando compilação do servidor...");

try {
  require('./src/http/server.ts');
  console.log("✅ Servidor pode ser carregado");
} catch (error) {
  console.log("❌ Erro ao carregar servidor:");
  console.log(error.message);
}