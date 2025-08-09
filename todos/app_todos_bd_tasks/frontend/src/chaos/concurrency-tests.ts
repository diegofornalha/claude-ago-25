import { db } from '../db/pglite-instance';
import { users, issues, syncQueue } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { SyncEngine } from '../sync/sync-engine';
import { ConflictResolver } from '../sync/conflict-resolver';

export interface ConcurrencyTestResult {
  testName: string;
  passed: boolean;
  concurrencyType: string;
  conflicts: number;
  resolved: boolean;
  dataIntegrity: boolean;
  errors: string[];
  metrics: {
    operations: number;
    successful: number;
    failed: number;
    averageTime: number;
    maxTime: number;
  };
}

export class ConcurrencyTests {
  private results: ConcurrencyTestResult[] = [];
  
  constructor(
    private syncEngine: SyncEngine,
    private conflictResolver: ConflictResolver
  ) {}

  async runAllTests(): Promise<ConcurrencyTestResult[]> {
    console.log('🧪 Starting Concurrency Tests...');
    
    this.results = [];
    
    // Executar testes
    await this.testSimultaneousWrites();
    await this.testOptimisticLocking();
    await this.testPessimisticLocking();
    await this.testReadWriteConflicts();
    await this.testBatchOperations();
    await this.testTransactionIsolation();
    await this.testDeadlockScenarios();
    await this.testRAGConcurrentIndexing();
    
    console.log('✅ Concurrency Tests completed');
    return this.results;
  }

  private async testSimultaneousWrites(): Promise<void> {
    const testName = 'Simultaneous Writes Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      const testId = 'concurrent-write-test';
      
      // Criar registro inicial
      await db.insert(issues).values({
        id: testId,
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simular 10 escritas simultâneas
      const writes = [];
      const times: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const writeOperation = async () => {
          const start = Date.now();
          metrics.operations++;
          
          try {
            await db.update(issues)
              .set({
                title: `Update ${i}`,
                description: `Description ${i}`,
                updatedAt: new Date(Date.now() + i) // Diferentes timestamps
              })
              .where(eq(issues.id, testId));
              
            metrics.successful++;
          } catch (error) {
            metrics.failed++;
            conflicts++;
          }
          
          const time = Date.now() - start;
          times.push(time);
          return time;
        };
        
        writes.push(writeOperation());
      }

      // Executar todas simultaneamente
      await Promise.all(writes);

      // Calcular métricas
      metrics.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      metrics.maxTime = Math.max(...times);

      // Verificar estado final
      const final = await db.select().from(issues).where(eq(issues.id, testId));
      
      if (!final[0]) {
        errors.push('Data lost during concurrent writes');
        dataIntegrity = false;
      } else {
        // Verificar se o título é um dos esperados
        const validTitles = Array.from({ length: 10 }, (_, i) => `Update ${i}`);
        if (!validTitles.includes(final[0].title)) {
          errors.push('Invalid final state');
          dataIntegrity = false;
        }
      }

      // Limpar
      await db.delete(issues).where(eq(issues.id, testId));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && dataIntegrity,
      concurrencyType: 'simultaneous_writes',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testOptimisticLocking(): Promise<void> {
    const testName = 'Optimistic Locking Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      const testId = 'optimistic-lock-test';
      
      // Criar registro com versão
      const initialVersion = 1;
      await db.insert(issues).values({
        id: testId,
        title: 'Version Test',
        description: 'Testing optimistic locking',
        status: 'open',
        priority: 'high',
        version: initialVersion,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simular duas transações concorrentes
      const transaction1 = async () => {
        const start = Date.now();
        metrics.operations++;
        
        // Ler registro
        const [record] = await db.select().from(issues).where(eq(issues.id, testId));
        const version = record.version || 0;
        
        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Tentar atualizar com check de versão
        try {
          const result = await db.update(issues)
            .set({
              title: 'Transaction 1 Update',
              version: version + 1,
              updatedAt: new Date()
            })
            .where(eq(issues.id, testId))
            .where(eq(issues.version, version));
            
          if (result.rowCount === 0) {
            conflicts++;
            throw new Error('Version mismatch');
          }
          
          metrics.successful++;
        } catch (error) {
          metrics.failed++;
          throw error;
        }
        
        return Date.now() - start;
      };

      const transaction2 = async () => {
        const start = Date.now();
        metrics.operations++;
        
        // Ler registro
        const [record] = await db.select().from(issues).where(eq(issues.id, testId));
        const version = record.version || 0;
        
        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Tentar atualizar com check de versão
        try {
          const result = await db.update(issues)
            .set({
              title: 'Transaction 2 Update',
              version: version + 1,
              updatedAt: new Date()
            })
            .where(eq(issues.id, testId))
            .where(eq(issues.version, version));
            
          if (result.rowCount === 0) {
            conflicts++;
            throw new Error('Version mismatch');
          }
          
          metrics.successful++;
        } catch (error) {
          metrics.failed++;
          // Esperado - uma transação deve falhar
        }
        
        return Date.now() - start;
      };

      // Executar concorrentemente
      const times = await Promise.allSettled([transaction1(), transaction2()]);
      
      // Verificar que uma falhou e outra teve sucesso
      if (metrics.successful !== 1 || metrics.failed !== 1) {
        errors.push('Optimistic locking not working correctly');
        resolved = false;
      }

      // Limpar
      await db.delete(issues).where(eq(issues.id, testId));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && conflicts === 1,
      concurrencyType: 'optimistic_locking',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testPessimisticLocking(): Promise<void> {
    const testName = 'Pessimistic Locking Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      // PGlite não suporta SELECT FOR UPDATE nativamente
      // Simular com flag de lock manual
      const locks = new Map<string, boolean>();
      
      const acquireLock = async (id: string): Promise<boolean> => {
        if (locks.get(id)) {
          return false;
        }
        locks.set(id, true);
        return true;
      };
      
      const releaseLock = (id: string) => {
        locks.delete(id);
      };

      const testId = 'pessimistic-lock-test';
      
      // Criar registro
      await db.insert(issues).values({
        id: testId,
        title: 'Lock Test',
        description: 'Testing pessimistic locking',
        status: 'open',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simular transações com lock
      const transaction = async (name: string): Promise<number> => {
        const start = Date.now();
        metrics.operations++;
        
        // Tentar adquirir lock
        let locked = false;
        let attempts = 0;
        
        while (!locked && attempts < 10) {
          locked = await acquireLock(testId);
          if (!locked) {
            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
          }
        }
        
        if (!locked) {
          metrics.failed++;
          conflicts++;
          throw new Error('Could not acquire lock');
        }
        
        try {
          // Operação com lock
          await db.update(issues)
            .set({
              title: `${name} Update`,
              updatedAt: new Date()
            })
            .where(eq(issues.id, testId));
            
          // Simular processamento
          await new Promise(resolve => setTimeout(resolve, 100));
          
          metrics.successful++;
        } finally {
          releaseLock(testId);
        }
        
        return Date.now() - start;
      };

      // Executar múltiplas transações
      const transactions = [];
      for (let i = 0; i < 5; i++) {
        transactions.push(transaction(`Transaction ${i}`));
      }
      
      const times = await Promise.allSettled(transactions);
      
      // Todas devem ter sucesso (executadas em sequência devido ao lock)
      if (metrics.successful !== 5) {
        errors.push('Some transactions failed with pessimistic locking');
        resolved = false;
      }

      // Limpar
      await db.delete(issues).where(eq(issues.id, testId));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && metrics.successful === 5,
      concurrencyType: 'pessimistic_locking',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testReadWriteConflicts(): Promise<void> {
    const testName = 'Read-Write Conflicts Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      const testId = 'read-write-test';
      let readValue = '';
      
      // Criar registro
      await db.insert(issues).values({
        id: testId,
        title: 'Initial Value',
        description: 'Testing read-write conflicts',
        status: 'open',
        priority: 'low',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Operações de leitura
      const readOperations = async (): Promise<void> => {
        for (let i = 0; i < 20; i++) {
          metrics.operations++;
          const start = Date.now();
          
          try {
            const [record] = await db.select().from(issues).where(eq(issues.id, testId));
            readValue = record.title;
            metrics.successful++;
          } catch (error) {
            metrics.failed++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      // Operações de escrita
      const writeOperations = async (): Promise<void> => {
        for (let i = 0; i < 10; i++) {
          metrics.operations++;
          
          try {
            await db.update(issues)
              .set({
                title: `Write ${i}`,
                updatedAt: new Date()
              })
              .where(eq(issues.id, testId));
              
            metrics.successful++;
          } catch (error) {
            metrics.failed++;
            conflicts++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      };

      // Executar concorrentemente
      await Promise.all([
        readOperations(),
        writeOperations()
      ]);

      // Verificar integridade
      const [final] = await db.select().from(issues).where(eq(issues.id, testId));
      if (!final) {
        errors.push('Data lost during read-write operations');
        dataIntegrity = false;
      }

      // Limpar
      await db.delete(issues).where(eq(issues.id, testId));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && dataIntegrity,
      concurrencyType: 'read_write_conflicts',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testBatchOperations(): Promise<void> {
    const testName = 'Batch Operations Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      // Criar múltiplos registros para batch
      const batchSize = 100;
      const records = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-${i}`,
        title: `Batch Item ${i}`,
        description: 'Batch test',
        status: 'open' as const,
        priority: 'low' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Operação batch insert
      const batchInsert = async (): Promise<number> => {
        const start = Date.now();
        metrics.operations++;
        
        try {
          await db.insert(issues).values(records);
          metrics.successful++;
        } catch (error) {
          metrics.failed++;
          throw error;
        }
        
        return Date.now() - start;
      };

      // Operação batch update
      const batchUpdate = async (): Promise<number> => {
        const start = Date.now();
        metrics.operations++;
        
        try {
          // Atualizar todos de uma vez
          for (let i = 0; i < batchSize; i++) {
            await db.update(issues)
              .set({ 
                title: `Updated Batch ${i}`,
                updatedAt: new Date()
              })
              .where(eq(issues.id, `batch-${i}`));
          }
          metrics.successful++;
        } catch (error) {
          metrics.failed++;
          conflicts++;
        }
        
        return Date.now() - start;
      };

      // Executar inserção
      const insertTime = await batchInsert();

      // Executar múltiplas atualizações concorrentes
      const updatePromises = [
        batchUpdate(),
        batchUpdate(),
        batchUpdate()
      ];

      const times = await Promise.allSettled(updatePromises);

      // Verificar integridade
      const count = await db.select({ count: sql`count(*)` })
        .from(issues)
        .where(sql`id LIKE 'batch-%'`);
        
      if (Number(count[0]?.count) !== batchSize) {
        errors.push('Batch operation data loss');
        dataIntegrity = false;
      }

      // Limpar
      for (let i = 0; i < batchSize; i++) {
        await db.delete(issues).where(eq(issues.id, `batch-${i}`));
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && dataIntegrity,
      concurrencyType: 'batch_operations',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testTransactionIsolation(): Promise<void> {
    const testName = 'Transaction Isolation Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      // Testar isolamento de transações
      const testId = 'isolation-test';
      
      // Criar registro inicial
      await db.insert(users).values({
        id: testId,
        name: 'Test User',
        email: 'isolation@test.com',
        role: 'viewer',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Transação 1: Lê e atualiza
      const transaction1 = async (): Promise<void> => {
        metrics.operations++;
        
        await db.transaction(async (tx) => {
          // Ler valor
          const [user] = await tx.select().from(users).where(eq(users.id, testId));
          
          // Simular processamento
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Atualizar baseado no valor lido
          await tx.update(users)
            .set({ 
              name: user.name + ' - T1',
              updatedAt: new Date()
            })
            .where(eq(users.id, testId));
            
          metrics.successful++;
        });
      };

      // Transação 2: Tenta ler durante T1
      const transaction2 = async (): Promise<void> => {
        metrics.operations++;
        
        // Esperar T1 começar
        await new Promise(resolve => setTimeout(resolve, 50));
        
        await db.transaction(async (tx) => {
          // Tentar ler durante T1
          const [user] = await tx.select().from(users).where(eq(users.id, testId));
          
          // Não deve ver mudanças de T1 ainda
          if (user.name.includes('T1')) {
            errors.push('Transaction isolation violated');
            dataIntegrity = false;
          }
          
          metrics.successful++;
        });
      };

      // Executar concorrentemente
      await Promise.all([transaction1(), transaction2()]);

      // Limpar
      await db.delete(users).where(eq(users.id, testId));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && dataIntegrity,
      concurrencyType: 'transaction_isolation',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testDeadlockScenarios(): Promise<void> {
    const testName = 'Deadlock Scenarios Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = false;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      // Criar dois recursos
      const resource1 = 'deadlock-1';
      const resource2 = 'deadlock-2';
      
      await db.insert(issues).values([
        {
          id: resource1,
          title: 'Resource 1',
          description: 'Deadlock test',
          status: 'open',
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: resource2,
          title: 'Resource 2',
          description: 'Deadlock test',
          status: 'open',
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Detectar deadlock com timeout
      const withDeadlockDetection = async (
        operation: () => Promise<void>,
        timeout: number = 5000
      ): Promise<void> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Deadlock detected')), timeout);
        });
        
        try {
          await Promise.race([operation(), timeoutPromise]);
        } catch (error) {
          if (error.message === 'Deadlock detected') {
            conflicts++;
            resolved = true; // Deadlock foi detectado e resolvido
          }
          throw error;
        }
      };

      // Transação 1: Lock R1 então R2
      const transaction1 = async (): Promise<void> => {
        metrics.operations++;
        
        try {
          await withDeadlockDetection(async () => {
            await db.transaction(async (tx) => {
              // Lock resource 1
              await tx.update(issues)
                .set({ status: 'in_progress' })
                .where(eq(issues.id, resource1));
                
              // Delay
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Try to lock resource 2
              await tx.update(issues)
                .set({ status: 'in_progress' })
                .where(eq(issues.id, resource2));
                
              metrics.successful++;
            });
          });
        } catch (error) {
          metrics.failed++;
        }
      };

      // Transação 2: Lock R2 então R1 (ordem oposta)
      const transaction2 = async (): Promise<void> => {
        metrics.operations++;
        
        try {
          await withDeadlockDetection(async () => {
            await db.transaction(async (tx) => {
              // Lock resource 2
              await tx.update(issues)
                .set({ status: 'closed' })
                .where(eq(issues.id, resource2));
                
              // Delay
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Try to lock resource 1
              await tx.update(issues)
                .set({ status: 'closed' })
                .where(eq(issues.id, resource1));
                
              metrics.successful++;
            });
          });
        } catch (error) {
          metrics.failed++;
        }
      };

      // Executar concorrentemente (pode causar deadlock)
      await Promise.allSettled([transaction1(), transaction2()]);

      // Limpar
      await db.delete(issues).where(eq(issues.id, resource1));
      await db.delete(issues).where(eq(issues.id, resource2));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && resolved,
      concurrencyType: 'deadlock_detection',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  private async testRAGConcurrentIndexing(): Promise<void> {
    const testName = 'RAG Concurrent Indexing Test';
    const errors: string[] = [];
    let conflicts = 0;
    let resolved = true;
    let dataIntegrity = true;
    const metrics = {
      operations: 0,
      successful: 0,
      failed: 0,
      averageTime: 0,
      maxTime: 0
    };

    try {
      // Simular indexação concorrente de documentos para RAG
      const documents = Array.from({ length: 50 }, (_, i) => ({
        id: `rag-doc-${i}`,
        content: `Document ${i} content for knowledge base`,
        embedding: Array(384).fill(0).map(() => Math.random() - 0.5),
        metadata: {
          source: 'test',
          timestamp: Date.now(),
          version: 1
        }
      }));

      // Função de indexação
      const indexDocument = async (doc: any): Promise<void> => {
        metrics.operations++;
        const start = Date.now();
        
        try {
          // Simular processamento de embedding
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          
          // Verificar duplicatas antes de inserir
          const existing = await db.execute(
            sql`SELECT id FROM documents WHERE id = ${doc.id}`
          );
          
          if (existing.rows.length > 0) {
            // Atualizar existente
            await db.execute(sql`
              UPDATE documents 
              SET content = ${doc.content},
                  embedding = ${JSON.stringify(doc.embedding)},
                  metadata = ${JSON.stringify(doc.metadata)},
                  updated_at = NOW()
              WHERE id = ${doc.id}
            `);
          } else {
            // Inserir novo
            await db.execute(sql`
              INSERT INTO documents (id, content, embedding, metadata)
              VALUES (${doc.id}, ${doc.content}, ${JSON.stringify(doc.embedding)}, ${JSON.stringify(doc.metadata)})
            `);
          }
          
          metrics.successful++;
        } catch (error) {
          metrics.failed++;
          conflicts++;
        }
      };

      // Indexar todos os documentos concorrentemente
      const indexPromises = documents.map(doc => indexDocument(doc));
      await Promise.all(indexPromises);

      // Verificar integridade
      if (metrics.successful + metrics.failed !== documents.length) {
        errors.push('Some documents were not processed');
        dataIntegrity = false;
      }

      // Testar busca concorrente durante indexação
      const searchOperations = Array(10).fill(0).map(async (_, i) => {
        try {
          // Simular busca semântica
          const query = Array(384).fill(0).map(() => Math.random() - 0.5);
          
          // Esta seria uma busca real com pgvector
          const results = await db.execute(sql`
            SELECT id, content, 
                   1 - (embedding <-> ${JSON.stringify(query)}) as similarity
            FROM documents
            WHERE embedding IS NOT NULL
            ORDER BY similarity DESC
            LIMIT 5
          `);
          
          return results.rows.length;
        } catch (error) {
          return 0;
        }
      });

      await Promise.all(searchOperations);

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && dataIntegrity,
      concurrencyType: 'rag_concurrent_indexing',
      conflicts,
      resolved,
      dataIntegrity,
      errors,
      metrics
    });
  }

  generateReport(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalConflicts = this.results.reduce((sum, r) => sum + r.conflicts, 0);
    const resolvedTests = this.results.filter(r => r.resolved).length;

    let report = `
# Concurrency Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${totalTests - passedTests}
- Total Conflicts: ${totalConflicts}
- Resolution Rate: ${((resolvedTests / totalTests) * 100).toFixed(1)}%

## Test Results
`;

    for (const result of this.results) {
      const successRate = result.metrics.operations > 0 
        ? ((result.metrics.successful / result.metrics.operations) * 100).toFixed(1)
        : 0;

      report += `
### ${result.testName}
- Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- Concurrency Type: ${result.concurrencyType}
- Conflicts: ${result.conflicts}
- Resolved: ${result.resolved ? 'Yes' : 'No'}
- Data Integrity: ${result.dataIntegrity ? 'Maintained' : 'Compromised'}
- Success Rate: ${successRate}%
- Metrics:
  - Total Operations: ${result.metrics.operations}
  - Successful: ${result.metrics.successful}
  - Failed: ${result.metrics.failed}
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