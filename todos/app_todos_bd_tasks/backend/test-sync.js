#!/usr/bin/env node

/**
 * Script para testar a sincronização RAG
 */

async function testSync() {
  const baseUrl = 'http://localhost:3344/api/rag/sync';
  
  console.log('🧪 Testando sincronização RAG...\n');
  
  try {
    // 1. Verificar status
    console.log('1️⃣ Verificando status...');
    const statusRes = await fetch(`${baseUrl}/status`);
    const status = await statusRes.json();
    
    console.log('📊 Status atual:');
    console.log(`   Cache: ${status.data.cache.total} documentos`);
    console.log(`   DB: ${status.data.database.total} documentos`);
    console.log('');
    
    // 2. Sincronizar Cache → DB
    console.log('2️⃣ Sincronizando Cache → PostgreSQL...');
    const syncRes = await fetch(`${baseUrl}/cache-to-db`, { method: 'POST' });
    const syncResult = await syncRes.json();
    
    if (syncResult.success) {
      console.log('✅ Sincronização concluída!');
      console.log(`   Total: ${syncResult.result.total} documentos`);
      console.log(`   Web: ${syncResult.result.webDocs} documentos`);
      console.log(`   Sessões: ${syncResult.result.sessionDocs} documentos`);
    } else {
      console.log('❌ Erro:', syncResult.error);
    }
    console.log('');
    
    // 3. Verificar sincronização reversa
    console.log('3️⃣ Verificando sincronização DB → Cache...');
    const verifyRes = await fetch(`${baseUrl}/db-to-cache`, { method: 'POST' });
    const verifyResult = await verifyRes.json();
    
    if (verifyResult.success) {
      console.log('✅ Verificação concluída!');
      console.log(`   DB: ${verifyResult.result.dbTotal} documentos`);
      console.log(`   Cache: ${verifyResult.result.cacheTotal} documentos`);
      console.log(`   Faltando no cache: ${verifyResult.result.missing} documentos`);
    } else {
      console.log('❌ Erro:', verifyResult.error);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('\n💡 Certifique-se de que o servidor backend está rodando na porta 3344');
  }
}

// Executar teste
testSync();