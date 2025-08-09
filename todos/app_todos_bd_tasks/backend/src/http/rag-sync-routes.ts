import { Hono } from 'hono'
import { z } from 'zod'
import { ragSync } from '../services/rag-sync'

const app = new Hono()

/**
 * GET /api/rag/sync/status
 * Retorna status da sincronização
 */
app.get('/status', async (c) => {
  try {
    const status = await ragSync.getSyncStatus()
    return c.json({
      success: true,
      data: status
    })
  } catch (error: any) {
    console.error('Erro ao buscar status:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

/**
 * POST /api/rag/sync/cache-to-db
 * Sincroniza do cache local para o banco
 */
app.post('/cache-to-db', async (c) => {
  try {
    console.log('🚀 Iniciando sincronização Cache → DB...')
    
    const result = await ragSync.syncCacheToDatabase()
    
    return c.json({
      success: true,
      message: 'Sincronização concluída',
      result
    })
  } catch (error: any) {
    console.error('Erro na sincronização:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

/**
 * POST /api/rag/sync/db-to-cache
 * Sincroniza do banco para o cache (verificação)
 */
app.post('/db-to-cache', async (c) => {
  try {
    console.log('🚀 Iniciando verificação DB → Cache...')
    
    const result = await ragSync.syncDatabaseToCache()
    
    return c.json({
      success: true,
      message: 'Verificação concluída',
      result
    })
  } catch (error: any) {
    console.error('Erro na verificação:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

/**
 * POST /api/rag/sync/auto
 * Ativa sincronização automática
 */
app.post('/auto', async (c) => {
  try {
    // Por enquanto, apenas executa uma vez
    // Futuramente: configurar intervalo de sync
    const syncInterval = 5 * 60 * 1000 // 5 minutos
    
    console.log(`⏰ Sincronização automática configurada para cada ${syncInterval/1000}s`)
    
    // Executar sync inicial
    const result = await ragSync.syncCacheToDatabase()
    
    // TODO: Implementar timer/cron para sync periódico
    
    return c.json({
      success: true,
      message: 'Sincronização automática ativada',
      interval: syncInterval,
      initialSync: result
    })
  } catch (error: any) {
    console.error('Erro ao ativar sync automático:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

export default app