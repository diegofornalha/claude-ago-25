import { StorageQuotaManager } from '../utils/storage-quota-manager';
import { db } from '../db/pglite-instance';
import { BackupManager } from '../backup/backup-manager';

export interface StorageFailureTestResult {
  testName: string;
  passed: boolean;
  failureType: string;
  recovered: boolean;
  dataLoss: boolean;
  errors: string[];
  metrics: {
    storageUsedBefore: number;
    storageUsedAfter: number;
    operationsFailed: number;
    operationsSucceeded: number;
  };
}

export class StorageFailureTests {
  private results: StorageFailureTestResult[] = [];
  private originalStorage: {
    setItem: typeof localStorage.setItem;
    getItem: typeof localStorage.getItem;
    removeItem: typeof localStorage.removeItem;
    clear: typeof localStorage.clear;
  };
  
  constructor(
    private storageManager: StorageQuotaManager,
    private backupManager: BackupManager
  ) {
    // Salvar métodos originais
    this.originalStorage = {
      setItem: localStorage.setItem.bind(localStorage),
      getItem: localStorage.getItem.bind(localStorage),
      removeItem: localStorage.removeItem.bind(localStorage),
      clear: localStorage.clear.bind(localStorage)
    };
  }

  async runAllTests(): Promise<StorageFailureTestResult[]> {
    console.log('🧪 Starting Storage Failure Tests...');
    
    this.results = [];
    
    // Executar testes
    await this.testQuotaExceeded();
    await this.testStorageUnavailable();
    await this.testIndexedDBFailure();
    await this.testCorruptedStorage();
    await this.testStoragePermissionDenied();
    await this.testConcurrentStorageAccess();
    await this.testStorageEviction();
    await this.testBackupRecovery();
    
    // Restaurar storage original
    this.restoreOriginalStorage();
    
    console.log('✅ Storage Failure Tests completed');
    return this.results;
  }

  private async testQuotaExceeded(): Promise<void> {
    const testName = 'Storage Quota Exceeded Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Obter uso atual
      const estimate = await navigator.storage.estimate();
      metrics.storageUsedBefore = estimate.usage || 0;

      // Simular quota excedida
      localStorage.setItem = () => {
        metrics.operationsFailed++;
        throw new DOMException('QuotaExceededError');
      };

      // Tentar salvar dados grandes
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      
      try {
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`quota-test-${i}`, largeData);
        }
        errors.push('Storage should have rejected large data');
      } catch (error) {
        // Esperado
        
        // Verificar se o sistema ativa limpeza automática
        const cleanupTriggered = await this.storageManager.checkAndCleanup();
        if (cleanupTriggered) {
          recovered = true;
          
          // Tentar novamente após limpeza
          this.restoreOriginalStorage();
          try {
            localStorage.setItem('quota-test-after-cleanup', 'small data');
            metrics.operationsSucceeded++;
          } catch (e) {
            errors.push('Failed to write after cleanup');
            dataLoss = true;
          }
        }
      }

      // Verificar uso final
      const finalEstimate = await navigator.storage.estimate();
      metrics.storageUsedAfter = finalEstimate.usage || 0;

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.restoreOriginalStorage();
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'quota_exceeded',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testStorageUnavailable(): Promise<void> {
    const testName = 'Storage Unavailable Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Simular storage completamente indisponível
      localStorage.setItem = () => {
        metrics.operationsFailed++;
        throw new Error('Storage unavailable');
      };
      
      localStorage.getItem = () => {
        metrics.operationsFailed++;
        throw new Error('Storage unavailable');
      };

      // Verificar se sistema ativa modo emergência
      try {
        // Sistema deve detectar falha e ativar fallback
        const testWrite = () => localStorage.setItem('test', 'data');
        testWrite();
      } catch (error) {
        // Verificar se emergency mode foi ativado
        if (window.isEmergencyMode) {
          recovered = true;
          
          // Verificar se dados podem ser salvos em memória
          if (window.emergencyStore?.data) {
            window.emergencyStore.data.set('emergency-test', { value: 'test' });
            metrics.operationsSucceeded++;
          }
        } else {
          errors.push('Emergency mode not activated');
        }
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.restoreOriginalStorage();
      window.isEmergencyMode = false;
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'storage_unavailable',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testIndexedDBFailure(): Promise<void> {
    const testName = 'IndexedDB Failure Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Salvar IndexedDB original
      const originalIDB = window.indexedDB;

      // Simular falha do IndexedDB
      // @ts-ignore
      window.indexedDB = {
        open: () => {
          metrics.operationsFailed++;
          throw new Error('IndexedDB unavailable');
        },
        deleteDatabase: () => {
          throw new Error('IndexedDB unavailable');
        }
      };

      // Tentar operação que usa IndexedDB
      try {
        const request = indexedDB.open('test-db');
        errors.push('IndexedDB should have failed');
      } catch (error) {
        // Esperado
        
        // Verificar se sistema tem fallback
        // PGlite deve detectar e usar alternativa
        const fallbackActive = window.isEmergencyMode || 
                              window.emergencyStore?.isActive;
        
        if (fallbackActive) {
          recovered = true;
          metrics.operationsSucceeded++;
        }
      }

      // Restaurar IndexedDB
      window.indexedDB = originalIDB;

      // Verificar se dados podem ser recuperados
      try {
        const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('recovery-test', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        testDB.close();
        await new Promise((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase('recovery-test');
          deleteReq.onsuccess = () => resolve(undefined);
          deleteReq.onerror = () => reject(deleteReq.error);
        });
        
        metrics.operationsSucceeded++;
      } catch (error) {
        errors.push('Failed to recover IndexedDB functionality');
        dataLoss = true;
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'indexeddb_failure',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testCorruptedStorage(): Promise<void> {
    const testName = 'Corrupted Storage Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Salvar dados válidos
      this.originalStorage.setItem('valid-data', JSON.stringify({ test: true }));

      // Corromper dados
      this.originalStorage.setItem('corrupted-json', '{invalid json}');
      this.originalStorage.setItem('corrupted-encoding', '\uDFFF\uD800'); // Invalid UTF-16
      this.originalStorage.setItem('corrupted-null', 'null\x00data');

      // Testar leitura de dados corrompidos
      const corruptedKeys = ['corrupted-json', 'corrupted-encoding', 'corrupted-null'];
      
      for (const key of corruptedKeys) {
        try {
          const data = this.originalStorage.getItem(key);
          if (key === 'corrupted-json') {
            JSON.parse(data!);
            errors.push(`Should fail parsing: ${key}`);
          }
          metrics.operationsFailed++;
        } catch (error) {
          // Esperado para JSON inválido
          recovered = true;
        }
      }

      // Verificar se dados válidos ainda são acessíveis
      try {
        const validData = this.originalStorage.getItem('valid-data');
        JSON.parse(validData!);
        metrics.operationsSucceeded++;
      } catch (error) {
        errors.push('Valid data corrupted');
        dataLoss = true;
      }

      // Limpar dados corrompidos
      for (const key of corruptedKeys) {
        this.originalStorage.removeItem(key);
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'corrupted_storage',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testStoragePermissionDenied(): Promise<void> {
    const testName = 'Storage Permission Denied Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Simular permissão negada
      localStorage.setItem = () => {
        metrics.operationsFailed++;
        throw new DOMException('The user denied permission to access the database');
      };

      // Tentar operação
      try {
        localStorage.setItem('permission-test', 'data');
        errors.push('Should have thrown permission error');
      } catch (error) {
        // Esperado
        
        // Verificar se sistema pede permissão ou usa alternativa
        if ('storage' in navigator && 'persist' in navigator.storage) {
          // Tentar solicitar persistência
          try {
            const isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
              const permission = await navigator.storage.persist();
              if (permission) {
                recovered = true;
                metrics.operationsSucceeded++;
              }
            }
          } catch (e) {
            // Navegador não suporta ou usuário negou
          }
        }
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    } finally {
      this.restoreOriginalStorage();
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      failureType: 'permission_denied',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testConcurrentStorageAccess(): Promise<void> {
    const testName = 'Concurrent Storage Access Test';
    const errors: string[] = [];
    let recovered = true;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      const key = 'concurrent-test';
      let value = 0;

      // Simular múltiplos acessos concorrentes
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          new Promise<void>((resolve) => {
            try {
              // Ler valor atual
              const current = this.originalStorage.getItem(key);
              const currentValue = current ? parseInt(current) : 0;
              
              // Simular processamento
              setTimeout(() => {
                try {
                  // Escrever valor incrementado
                  this.originalStorage.setItem(key, String(currentValue + 1));
                  metrics.operationsSucceeded++;
                } catch (e) {
                  metrics.operationsFailed++;
                }
                resolve();
              }, Math.random() * 10);
            } catch (e) {
              metrics.operationsFailed++;
              resolve();
            }
          })
        );
      }

      await Promise.all(operations);

      // Verificar resultado final
      const finalValue = this.originalStorage.getItem(key);
      const finalNumber = finalValue ? parseInt(finalValue) : 0;

      if (finalNumber !== 100) {
        errors.push(`Race condition detected: expected 100, got ${finalNumber}`);
        dataLoss = true;
      }

      // Limpar
      this.originalStorage.removeItem(key);

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      failureType: 'concurrent_access',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testStorageEviction(): Promise<void> {
    const testName = 'Storage Eviction Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Marcar dados importantes
      const importantData = {
        id: 'important-data',
        value: 'This should be preserved',
        priority: 'high'
      };
      
      this.originalStorage.setItem('important', JSON.stringify(importantData));

      // Preencher storage com dados menos importantes
      for (let i = 0; i < 100; i++) {
        try {
          this.originalStorage.setItem(
            `evictable-${i}`,
            JSON.stringify({ value: `data-${i}`, priority: 'low' })
          );
        } catch (e) {
          // Storage cheio
          break;
        }
      }

      // Simular pressão de memória
      const cleanup = await this.storageManager.checkAndCleanup();

      // Verificar se dados importantes foram preservados
      const important = this.originalStorage.getItem('important');
      if (important) {
        try {
          const parsed = JSON.parse(important);
          if (parsed.id === importantData.id) {
            recovered = true;
            metrics.operationsSucceeded++;
          }
        } catch (e) {
          errors.push('Important data corrupted');
          dataLoss = true;
        }
      } else {
        errors.push('Important data was evicted');
        dataLoss = true;
      }

      // Verificar quantos dados evictable foram removidos
      let evictedCount = 0;
      for (let i = 0; i < 100; i++) {
        if (!this.originalStorage.getItem(`evictable-${i}`)) {
          evictedCount++;
        }
      }

      if (evictedCount === 0 && cleanup) {
        errors.push('No data was evicted despite cleanup');
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'storage_eviction',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private async testBackupRecovery(): Promise<void> {
    const testName = 'Backup Recovery Test';
    const errors: string[] = [];
    let recovered = false;
    let dataLoss = false;
    const metrics = {
      storageUsedBefore: 0,
      storageUsedAfter: 0,
      operationsFailed: 0,
      operationsSucceeded: 0
    };

    try {
      // Criar backup antes da falha
      const backupId = await this.backupManager.performBackup('full');

      // Simular perda catastrófica de dados
      try {
        // Limpar todo o storage
        this.originalStorage.clear();
        
        // Limpar IndexedDB
        const databases = await indexedDB.databases?.() || [];
        for (const db of databases) {
          if (db.name) {
            await indexedDB.deleteDatabase(db.name);
          }
        }
        
        metrics.operationsFailed++;
      } catch (e) {
        // Alguns navegadores não suportam databases()
      }

      // Tentar recuperar do backup
      try {
        await this.backupManager.restoreBackup(backupId);
        recovered = true;
        metrics.operationsSucceeded++;
        
        // Verificar integridade dos dados restaurados
        const estimate = await navigator.storage.estimate();
        metrics.storageUsedAfter = estimate.usage || 0;
        
        if (metrics.storageUsedAfter === 0) {
          errors.push('No data restored from backup');
          dataLoss = true;
        }
      } catch (error) {
        errors.push(`Backup restoration failed: ${error}`);
        dataLoss = true;
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      failureType: 'catastrophic_failure',
      recovered,
      dataLoss,
      errors,
      metrics
    });
  }

  private restoreOriginalStorage(): void {
    localStorage.setItem = this.originalStorage.setItem;
    localStorage.getItem = this.originalStorage.getItem;
    localStorage.removeItem = this.originalStorage.removeItem;
    localStorage.clear = this.originalStorage.clear;
  }

  generateReport(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const recoveredTests = this.results.filter(r => r.recovered).length;
    const dataLossTests = this.results.filter(r => r.dataLoss).length;

    let report = `
# Storage Failure Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${totalTests - passedTests}
- Recovery Rate: ${((recoveredTests / totalTests) * 100).toFixed(1)}%
- Data Loss Events: ${dataLossTests}

## Test Results
`;

    for (const result of this.results) {
      report += `
### ${result.testName}
- Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- Failure Type: ${result.failureType}
- Recovered: ${result.recovered ? 'Yes' : 'No'}
- Data Loss: ${result.dataLoss ? 'Yes' : 'No'}
- Metrics:
  - Operations Failed: ${result.metrics.operationsFailed}
  - Operations Succeeded: ${result.metrics.operationsSucceeded}
  - Storage Before: ${(result.metrics.storageUsedBefore / 1024 / 1024).toFixed(2)}MB
  - Storage After: ${(result.metrics.storageUsedAfter / 1024 / 1024).toFixed(2)}MB
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