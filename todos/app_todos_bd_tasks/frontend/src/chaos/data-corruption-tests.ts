import { db } from '../db/pglite-instance';
import { users, issues, syncQueue } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface CorruptionTestResult {
  testName: string;
  passed: boolean;
  corruptionType: string;
  recovered: boolean;
  dataIntegrity: boolean;
  errors: string[];
}

export class DataCorruptionTests {
  private results: CorruptionTestResult[] = [];
  private backupData: Map<string, any[]> = new Map();

  async runAllTests(): Promise<CorruptionTestResult[]> {
    console.log('🧪 Starting Data Corruption Tests...');
    
    this.results = [];
    
    // Fazer backup dos dados antes dos testes
    await this.backupCurrentData();
    
    // Executar testes
    await this.testInvalidDataTypes();
    await this.testNullConstraintViolation();
    await this.testDuplicateKeys();
    await this.testInvalidForeignKeys();
    await this.testDataTruncation();
    await this.testEncodingCorruption();
    await this.testRAGEmbeddingCorruption();
    await this.testConcurrentWriteCorruption();
    
    // Restaurar dados originais
    await this.restoreBackupData();
    
    console.log('✅ Data Corruption Tests completed');
    return this.results;
  }

  private async backupCurrentData(): Promise<void> {
    const usersData = await db.select().from(users);
    const issuesData = await db.select().from(issues);
    const syncQueueData = await db.select().from(syncQueue);
    
    this.backupData.set('users', usersData);
    this.backupData.set('issues', issuesData);
    this.backupData.set('syncQueue', syncQueueData);
  }

  private async restoreBackupData(): Promise<void> {
    // Limpar tabelas
    await db.delete(syncQueue);
    await db.delete(issues);
    await db.delete(users);
    
    // Restaurar dados
    const usersBackup = this.backupData.get('users') || [];
    const issuesBackup = this.backupData.get('issues') || [];
    const syncQueueBackup = this.backupData.get('syncQueue') || [];
    
    if (usersBackup.length > 0) {
      await db.insert(users).values(usersBackup);
    }
    if (issuesBackup.length > 0) {
      await db.insert(issues).values(issuesBackup);
    }
    if (syncQueueBackup.length > 0) {
      await db.insert(syncQueue).values(syncQueueBackup);
    }
  }

  private async testInvalidDataTypes(): Promise<void> {
    const testName = 'Invalid Data Types Test';
    const errors: string[] = [];
    let recovered = false;
    let dataIntegrity = true;

    try {
      // Tentar inserir dados com tipos inválidos
      const corruptUser = {
        id: 'corrupt-type-test',
        name: 123, // Deveria ser string
        email: null, // Deveria ser string
        role: 'invalid_role', // Valor inválido para enum
        createdAt: 'not-a-date', // Deveria ser Date
        updatedAt: 'not-a-date'
      };

      try {
        // @ts-ignore - Ignorar erro de tipo para teste
        await db.insert(users).values(corruptUser);
        errors.push('System accepted invalid data types');
        dataIntegrity = false;
      } catch (error) {
        // Esperado - sistema rejeitou dados inválidos
        recovered = true;
      }

      // Testar recuperação com dados válidos
      const validUser = {
        id: 'valid-type-test',
        name: 'Valid User',
        email: 'valid@test.com',
        role: 'viewer' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(users).values(validUser);
      
      // Verificar se foi inserido corretamente
      const inserted = await db.select().from(users).where(eq(users.id, validUser.id));
      if (inserted.length === 0) {
        errors.push('Failed to insert valid data after corruption attempt');
        dataIntegrity = false;
      }

      // Limpar
      await db.delete(users).where(eq(users.id, validUser.id));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      corruptionType: 'invalid_types',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testNullConstraintViolation(): Promise<void> {
    const testName = 'Null Constraint Violation Test';
    const errors: string[] = [];
    let recovered = false;
    let dataIntegrity = true;

    try {
      // Tentar inserir com campos obrigatórios nulos
      const corruptIssue = {
        id: 'null-test',
        title: null, // NOT NULL constraint
        description: 'Test',
        status: 'open' as const,
        priority: 'low' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        // @ts-ignore
        await db.insert(issues).values(corruptIssue);
        errors.push('System accepted null in NOT NULL field');
        dataIntegrity = false;
      } catch (error) {
        // Esperado
        recovered = true;
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      corruptionType: 'null_constraint',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testDuplicateKeys(): Promise<void> {
    const testName = 'Duplicate Keys Test';
    const errors: string[] = [];
    let recovered = false;
    let dataIntegrity = true;

    try {
      const user1 = {
        id: 'duplicate-test',
        name: 'User 1',
        email: 'duplicate@test.com',
        role: 'viewer' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Inserir primeiro usuário
      await db.insert(users).values(user1);

      // Tentar inserir duplicata
      try {
        await db.insert(users).values(user1);
        errors.push('System accepted duplicate primary key');
        dataIntegrity = false;
      } catch (error) {
        // Esperado
        recovered = true;
      }

      // Limpar
      await db.delete(users).where(eq(users.id, user1.id));

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0 && recovered,
      corruptionType: 'duplicate_keys',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testInvalidForeignKeys(): Promise<void> {
    const testName = 'Invalid Foreign Keys Test';
    const errors: string[] = [];
    let recovered = true;
    let dataIntegrity = true;

    try {
      // Tentar inserir issue com assignee inexistente
      const orphanIssue = {
        id: 'orphan-test',
        title: 'Orphan Issue',
        description: 'Issue with invalid assignee',
        status: 'open' as const,
        priority: 'high' as const,
        assigneeId: 'non-existent-user', // FK inválida
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await db.insert(issues).values(orphanIssue);
        // Se não houver constraint FK, pode passar
        
        // Verificar integridade
        const issue = await db.select().from(issues).where(eq(issues.id, orphanIssue.id));
        if (issue[0]?.assigneeId) {
          const assignee = await db.select().from(users).where(eq(users.id, issue[0].assigneeId));
          if (assignee.length === 0) {
            errors.push('Orphan foreign key detected');
            dataIntegrity = false;
          }
        }
        
        // Limpar
        await db.delete(issues).where(eq(issues.id, orphanIssue.id));
      } catch (error) {
        // FK constraint funcionou
        recovered = true;
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      corruptionType: 'invalid_foreign_keys',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testDataTruncation(): Promise<void> {
    const testName = 'Data Truncation Test';
    const errors: string[] = [];
    let recovered = true;
    let dataIntegrity = true;

    try {
      // Criar string muito longa
      const veryLongString = 'x'.repeat(10000);
      
      const oversizedIssue = {
        id: 'truncation-test',
        title: veryLongString,
        description: veryLongString,
        status: 'open' as const,
        priority: 'low' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(issues).values(oversizedIssue);
      
      // Verificar se foi truncado
      const saved = await db.select().from(issues).where(eq(issues.id, oversizedIssue.id));
      
      if (saved[0]) {
        if (saved[0].title.length === veryLongString.length) {
          errors.push('No truncation applied to oversized data');
        } else {
          // Dados foram truncados - verificar se ainda são válidos
          if (!saved[0].title || saved[0].title.length === 0) {
            dataIntegrity = false;
            errors.push('Data truncated to empty string');
          }
        }
      }
      
      // Limpar
      await db.delete(issues).where(eq(issues.id, oversizedIssue.id));

    } catch (error) {
      // Sistema rejeitou dados muito grandes
      recovered = true;
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      corruptionType: 'data_truncation',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testEncodingCorruption(): Promise<void> {
    const testName = 'Encoding Corruption Test';
    const errors: string[] = [];
    let recovered = true;
    let dataIntegrity = true;

    try {
      // Testar vários encodings problemáticos
      const encodingTests = [
        { name: 'Emoji overload', value: '🔥💥🎯'.repeat(100) },
        { name: 'Mixed scripts', value: 'Hello مرحبا 你好 Здравствуйте' },
        { name: 'Control chars', value: 'Test\x00\x01\x02\x03' },
        { name: 'Invalid UTF-8', value: 'Test\xED\xA0\x80' }
      ];

      for (const test of encodingTests) {
        const issue = {
          id: `encoding-${test.name}`,
          title: test.value,
          description: test.value,
          status: 'open' as const,
          priority: 'low' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        try {
          await db.insert(issues).values(issue);
          
          // Verificar se foi salvo corretamente
          const saved = await db.select().from(issues).where(eq(issues.id, issue.id));
          
          if (saved[0]) {
            // Verificar se o encoding foi preservado
            if (saved[0].title !== test.value && !test.name.includes('Invalid')) {
              errors.push(`Encoding corrupted for: ${test.name}`);
              dataIntegrity = false;
            }
          }
          
          // Limpar
          await db.delete(issues).where(eq(issues.id, issue.id));
        } catch (error) {
          // Encoding inválido rejeitado
          if (test.name.includes('Invalid')) {
            recovered = true;
          } else {
            errors.push(`Valid encoding rejected: ${test.name}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      corruptionType: 'encoding_corruption',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testRAGEmbeddingCorruption(): Promise<void> {
    const testName = 'RAG Embedding Corruption Test';
    const errors: string[] = [];
    let recovered = true;
    let dataIntegrity = true;

    try {
      // Simular corrupção de embeddings
      const corruptionScenarios = [
        {
          name: 'Invalid dimensions',
          embedding: Array(100).fill(0) // Deveria ser 384
        },
        {
          name: 'NaN values',
          embedding: Array(384).fill(NaN)
        },
        {
          name: 'Infinite values',
          embedding: Array(384).fill(Infinity)
        },
        {
          name: 'Out of range',
          embedding: Array(384).fill(1000) // Embeddings normalizados são [-1, 1]
        }
      ];

      for (const scenario of corruptionScenarios) {
        const document = {
          id: `rag-corrupt-${scenario.name}`,
          content: 'Test document',
          embedding: scenario.embedding,
          metadata: { test: true }
        };

        try {
          // Simular inserção de documento com embedding corrompido
          // Em um sistema real, isso seria validado
          
          // Verificar se o sistema detecta embeddings inválidos
          const isValid = scenario.embedding.length === 384 && 
                         scenario.embedding.every(v => !isNaN(v) && isFinite(v) && Math.abs(v) <= 1);
          
          if (!isValid) {
            // Sistema deveria rejeitar
            errors.push(`System should reject: ${scenario.name}`);
            dataIntegrity = false;
          }
        } catch (error) {
          // Esperado para embeddings inválidos
          recovered = true;
        }
      }

      // Testar recuperação com embedding válido
      const validEmbedding = Array(384).fill(0).map(() => (Math.random() - 0.5) * 2);
      const validDoc = {
        id: 'rag-valid-test',
        content: 'Valid test document',
        embedding: validEmbedding,
        metadata: { test: true }
      };

      // Verificar normalização
      const magnitude = Math.sqrt(validEmbedding.reduce((sum, v) => sum + v * v, 0));
      if (Math.abs(magnitude - 1) > 0.01) {
        errors.push('Embeddings not properly normalized');
      }

    } catch (error) {
      errors.push(`Test error: ${error}`);
    }

    this.results.push({
      testName,
      passed: errors.length === 0,
      corruptionType: 'rag_embedding_corruption',
      recovered,
      dataIntegrity,
      errors
    });
  }

  private async testConcurrentWriteCorruption(): Promise<void> {
    const testName = 'Concurrent Write Corruption Test';
    const errors: string[] = [];
    let recovered = true;
    let dataIntegrity = true;

    try {
      const testId = 'concurrent-test';
      
      // Criar issue inicial
      await db.insert(issues).values({
        id: testId,
        title: 'Initial Title',
        description: 'Initial Description',
        status: 'open' as const,
        priority: 'low' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simular escritas concorrentes
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(
          db.update(issues)
            .set({ 
              title: `Update ${i}`,
              updatedAt: new Date()
            })
            .where(eq(issues.id, testId))
        );
      }

      // Executar todas simultaneamente
      await Promise.all(updates);

      // Verificar estado final
      const final = await db.select().from(issues).where(eq(issues.id, testId));
      
      if (!final[0]) {
        errors.push('Data lost during concurrent updates');
        dataIntegrity = false;
      } else {
        // Verificar se o título é um dos esperados
        const validTitles = Array.from({ length: 10 }, (_, i) => `Update ${i}`);
        if (!validTitles.includes(final[0].title)) {
          errors.push(`Unexpected final state: ${final[0].title}`);
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
      passed: errors.length === 0,
      corruptionType: 'concurrent_writes',
      recovered,
      dataIntegrity,
      errors
    });
  }

  generateReport(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const recoveredTests = this.results.filter(r => r.recovered).length;
    const integrityMaintained = this.results.filter(r => r.dataIntegrity).length;

    let report = `
# Data Corruption Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${totalTests - passedTests}
- Recovery Rate: ${((recoveredTests / totalTests) * 100).toFixed(1)}%
- Data Integrity: ${((integrityMaintained / totalTests) * 100).toFixed(1)}%

## Test Results
`;

    for (const result of this.results) {
      report += `
### ${result.testName}
- Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- Corruption Type: ${result.corruptionType}
- Recovered: ${result.recovered ? 'Yes' : 'No'}
- Data Integrity: ${result.dataIntegrity ? 'Maintained' : 'Compromised'}
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