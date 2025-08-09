import { NetworkChaos, NetworkProfiles } from './network-chaos';
import { SyncEngine } from '../sync/sync-engine';
import { WebSocketManager } from '../sync/websocket-manager';
import { db } from '../db/pglite-instance';

export interface ChaosTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  errors: string[];
  metrics: {
    syncSuccess: number;
    syncFailures: number;
    reconnects: number;
    dataLoss: boolean;
    averageLatency: number;
  };
}

export class NetworkChaosTests {
  private chaos: NetworkChaos;
  private results: ChaosTestResult[] = [];

  constructor(
    private syncEngine: SyncEngine,
    private wsManager: WebSocketManager
  ) {
    this.chaos = new NetworkChaos();
  }

  async runAllTests(): Promise<ChaosTestResult[]> {
    console.log('🧪 Starting Network Chaos Tests...');
    
    this.results = [];
    
    // Executar testes em sequência
    await this.testOfflineSync();
    await this.testIntermittentConnection();
    await this.testSlowNetwork();
    await this.testPacketLoss();
    await this.testBandwidthThrottling();
    await this.testNetworkStorm();
    await this.testRAGOfflineCapability();
    
    console.log('✅ Network Chaos Tests completed');
    return this.results;
  }

  private async testOfflineSync(): Promise<void> {
    const testName = 'Offline Sync Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();

    try {
      // Criar dados de teste
      const testData = {
        id: `offline-test-${Date.now()}`,
        content: 'Test data for offline sync',
        timestamp: Date.now()
      };

      // Ativar modo offline
      this.chaos.activate(NetworkProfiles.OFFLINE);

      // Tentar sincronizar (deve falhar mas enfileirar)
      try {
        await this.syncEngine.sync({ type: 'test', data: testData });
        metrics.syncFailures++;
      } catch (error) {
        // Esperado
      }

      // Verificar se foi enfileirado
      const queueSize = await this.syncEngine.getQueueSize();
      if (queueSize === 0) {
        errors.push('Data not queued while offline');
        metrics.dataLoss = true;
      }

      // Voltar online
      this.chaos.deactivate();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar se sincronizou
      const newQueueSize = await this.syncEngine.getQueueSize();
      if (newQueueSize === 0) {
        metrics.syncSuccess++;
      } else {
        errors.push('Data not synced after coming online');
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testIntermittentConnection(): Promise<void> {
    const testName = 'Intermittent Connection Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();
    let reconnectCount = 0;

    // Monitor reconnects
    const handleReconnect = () => reconnectCount++;
    this.wsManager.on('reconnected', handleReconnect);

    try {
      // Executar cenário intermitente por 20 segundos
      await this.chaos.runScenario('INTERMITTENT_CONNECTION', 20000);

      metrics.reconnects = reconnectCount;

      // Verificar integridade dos dados
      const finalQueueSize = await this.syncEngine.getQueueSize();
      if (finalQueueSize > 0) {
        errors.push(`${finalQueueSize} items still in queue after test`);
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.wsManager.off('reconnected', handleReconnect);
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && metrics.reconnects > 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testSlowNetwork(): Promise<void> {
    const testName = 'Slow Network Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();
    const latencies: number[] = [];

    try {
      // Ativar rede lenta
      this.chaos.activate(NetworkProfiles.SLOW_3G);

      // Executar várias operações de sync
      for (let i = 0; i < 5; i++) {
        const opStart = Date.now();
        
        try {
          await this.syncEngine.sync({
            type: 'test',
            data: { id: `slow-test-${i}`, value: i }
          });
          
          const latency = Date.now() - opStart;
          latencies.push(latency);
          metrics.syncSuccess++;
          
          // Verificar se latência está dentro do esperado para 3G
          if (latency < 300) {
            errors.push(`Latency too low for 3G simulation: ${latency}ms`);
          }
        } catch (error) {
          metrics.syncFailures++;
        }
      }

      metrics.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && metrics.averageLatency > 300,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testPacketLoss(): Promise<void> {
    const testName = 'Packet Loss Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();

    try {
      // Ativar rede com perda de pacotes
      this.chaos.activate(NetworkProfiles.FLAKY);

      // Tentar 20 operações
      const operations = 20;
      for (let i = 0; i < operations; i++) {
        try {
          await this.syncEngine.sync({
            type: 'test',
            data: { id: `loss-test-${i}`, value: i }
          });
          metrics.syncSuccess++;
        } catch (error) {
          metrics.syncFailures++;
        }
      }

      // Verificar taxa de perda
      const lossRate = metrics.syncFailures / operations;
      if (lossRate < 0.2 || lossRate > 0.4) {
        errors.push(`Unexpected packet loss rate: ${(lossRate * 100).toFixed(1)}%`);
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testBandwidthThrottling(): Promise<void> {
    const testName = 'Bandwidth Throttling Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();

    try {
      // Ativar throttling severo
      this.chaos.activate(NetworkProfiles.CONGESTED);

      // Enviar dados grandes
      const largeData = {
        id: 'bandwidth-test',
        content: 'x'.repeat(10000), // 10KB de dados
        items: Array(100).fill({ data: 'test' })
      };

      const uploadStart = Date.now();
      await this.syncEngine.sync({ type: 'test', data: largeData });
      const uploadTime = Date.now() - uploadStart;

      // Com 10KB/s de bandwidth, deve levar ~1 segundo
      if (uploadTime < 800) {
        errors.push(`Upload too fast for throttled connection: ${uploadTime}ms`);
      }

      metrics.syncSuccess++;
      metrics.averageLatency = uploadTime;

    } catch (error) {
      errors.push(`Test error: ${error}`);
      metrics.syncFailures++;
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testNetworkStorm(): Promise<void> {
    const testName = 'Network Storm Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();
    const initialQueueSize = await this.syncEngine.getQueueSize();

    try {
      // Executar storm por 15 segundos
      const stormPromise = this.chaos.runScenario('NETWORK_STORM', 15000);

      // Tentar operações durante o storm
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          this.syncEngine.sync({
            type: 'test',
            data: { id: `storm-test-${i}`, value: i }
          }).then(() => {
            metrics.syncSuccess++;
          }).catch(() => {
            metrics.syncFailures++;
          })
        );
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      await Promise.all(operations);
      await stormPromise;

      // Verificar se dados não foram perdidos
      const finalQueueSize = await this.syncEngine.getQueueSize();
      if (finalQueueSize > initialQueueSize + metrics.syncFailures) {
        metrics.dataLoss = true;
        errors.push('Possible data loss detected');
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && metrics.syncSuccess > 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  private async testRAGOfflineCapability(): Promise<void> {
    const testName = 'RAG Offline Capability Test';
    const errors: string[] = [];
    const metrics = {
      syncSuccess: 0,
      syncFailures: 0,
      reconnects: 0,
      dataLoss: false,
      averageLatency: 0
    };

    const startTime = Date.now();

    try {
      // Simular cenário RAG: buscar embeddings com rede ruim
      this.chaos.activate(NetworkProfiles.OFFLINE);

      // Testar busca semântica local (deve funcionar offline)
      const searchStart = Date.now();
      
      // Simular busca no PGlite
      const mockSearch = async () => {
        // Esta busca deve funcionar localmente
        const result = await db.execute(`
          SELECT content, embedding 
          FROM documents 
          WHERE embedding <-> $1 < 0.5
          LIMIT 5
        `);
        return result;
      };

      try {
        await mockSearch();
        const searchTime = Date.now() - searchStart;
        
        if (searchTime > 50) {
          errors.push(`Local search too slow: ${searchTime}ms (expected <50ms)`);
        }
        
        metrics.syncSuccess++;
        metrics.averageLatency = searchTime;
      } catch (error) {
        errors.push('Local RAG search failed while offline');
        metrics.syncFailures++;
      }

      // Testar se novos embeddings são enfileirados para sync
      const newDocument = {
        id: `rag-test-${Date.now()}`,
        content: 'Test document for RAG',
        embedding: Array(384).fill(0).map(() => Math.random())
      };

      // Deve enfileirar para sync posterior
      await this.syncEngine.sync({ type: 'document', data: newDocument });

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.chaos.deactivate();
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      errors,
      metrics
    });
  }

  generateReport(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    let report = `
# Network Chaos Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${totalTests - passedTests}
- Total Duration: ${(totalDuration / 1000).toFixed(2)}s

## Test Results
`;

    for (const result of this.results) {
      report += `
### ${result.testName}
- Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- Duration: ${result.duration}ms
- Metrics:
  - Sync Success: ${result.metrics.syncSuccess}
  - Sync Failures: ${result.metrics.syncFailures}
  - Reconnects: ${result.metrics.reconnects}
  - Data Loss: ${result.metrics.dataLoss ? 'Yes' : 'No'}
  - Avg Latency: ${result.metrics.averageLatency.toFixed(0)}ms
`;

      if (result.errors.length > 0) {
        report += `- Errors:\n`;
        result.errors.forEach(error => {
          report += `  - ${error}\n`;
        });
      }
    }

    return report;
  }
}