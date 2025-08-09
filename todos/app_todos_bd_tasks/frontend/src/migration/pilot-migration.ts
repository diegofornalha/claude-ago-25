import { MigrationManager } from './migration-manager';
import { featureFlags } from '../utils/feature-flags';
import { db } from '../db/pglite-instance';
import { users } from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';

export interface PilotGroup {
  id: string;
  name: string;
  description: string;
  userIds: string[];
  startDate: Date;
  endDate?: Date;
  rollbackThreshold: {
    errorRate: number;
    performanceDegradation: number;
    userComplaints: number;
  };
  status: 'planned' | 'active' | 'completed' | 'rolled_back';
}

export interface MigrationMetrics {
  startTime: number;
  endTime?: number;
  usersTotal: number;
  usersMigrated: number;
  errorCount: number;
  errorRate: number;
  avgMigrationTime: number;
  rollbackCount: number;
  successRate: number;
}

export class PilotMigrationManager {
  private static instance: PilotMigrationManager;
  private pilotGroups: Map<string, PilotGroup> = new Map();
  private metrics: MigrationMetrics = {
    startTime: 0,
    usersTotal: 0,
    usersMigrated: 0,
    errorCount: 0,
    errorRate: 0,
    avgMigrationTime: 0,
    rollbackCount: 0,
    successRate: 0
  };
  private migrationManager: MigrationManager;
  private abortController?: AbortController;

  private constructor() {
    this.migrationManager = new MigrationManager({
      batchSize: 10,
      onProgress: this.updateProgress.bind(this),
      onError: this.handleError.bind(this)
    });
    
    this.loadPilotGroups();
  }

  static getInstance(): PilotMigrationManager {
    if (!PilotMigrationManager.instance) {
      PilotMigrationManager.instance = new PilotMigrationManager();
    }
    return PilotMigrationManager.instance;
  }

  private loadPilotGroups(): void {
    // Carregar grupos do localStorage ou servidor
    const saved = localStorage.getItem('pilot-groups');
    if (saved) {
      const groups = JSON.parse(saved);
      groups.forEach((group: PilotGroup) => {
        this.pilotGroups.set(group.id, group);
      });
    } else {
      // Criar grupos padrão
      this.createDefaultGroups();
    }
  }

  private createDefaultGroups(): void {
    const groups: PilotGroup[] = [
      {
        id: 'alpha-testers',
        name: 'Alpha Testers',
        description: 'Usuários internos e early adopters',
        userIds: [],
        startDate: new Date(),
        rollbackThreshold: {
          errorRate: 0.05, // 5%
          performanceDegradation: 0.2, // 20%
          userComplaints: 3
        },
        status: 'planned'
      },
      {
        id: 'beta-testers',
        name: 'Beta Testers',
        description: 'Usuários selecionados para teste beta',
        userIds: [],
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 semana
        rollbackThreshold: {
          errorRate: 0.02, // 2%
          performanceDegradation: 0.1, // 10%
          userComplaints: 5
        },
        status: 'planned'
      },
      {
        id: 'gradual-rollout',
        name: 'Rollout Gradual',
        description: 'Migração gradual de todos os usuários',
        userIds: [],
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 semanas
        rollbackThreshold: {
          errorRate: 0.01, // 1%
          performanceDegradation: 0.05, // 5%
          userComplaints: 10
        },
        status: 'planned'
      }
    ];

    groups.forEach(group => {
      this.pilotGroups.set(group.id, group);
    });

    this.savePilotGroups();
  }

  private savePilotGroups(): void {
    const groups = Array.from(this.pilotGroups.values());
    localStorage.setItem('pilot-groups', JSON.stringify(groups));
  }

  // Criar novo grupo piloto
  createPilotGroup(group: Omit<PilotGroup, 'status'>): PilotGroup {
    const newGroup: PilotGroup = {
      ...group,
      status: 'planned'
    };

    this.pilotGroups.set(newGroup.id, newGroup);
    this.savePilotGroups();

    return newGroup;
  }

  // Adicionar usuários ao grupo
  async addUsersToGroup(groupId: string, userIds: string[]): Promise<void> {
    const group = this.pilotGroups.get(groupId);
    if (!group) throw new Error('Grupo não encontrado');

    // Verificar se usuários existem
    const existingUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));

    const validUserIds = existingUsers.map(u => u.id);
    
    group.userIds = [...new Set([...group.userIds, ...validUserIds])];
    this.savePilotGroups();

    // Atualizar feature flags para usuários do piloto
    validUserIds.forEach(userId => {
      featureFlags.setUser(userId, [groupId]);
    });
  }

  // Iniciar migração piloto
  async startPilotMigration(groupId: string): Promise<void> {
    const group = this.pilotGroups.get(groupId);
    if (!group) throw new Error('Grupo não encontrado');
    if (group.status !== 'planned') {
      throw new Error('Grupo já está em migração ou foi completado');
    }

    console.log(`🚀 Iniciando migração piloto: ${group.name}`);

    group.status = 'active';
    this.metrics.startTime = Date.now();
    this.metrics.usersTotal = group.userIds.length;
    this.abortController = new AbortController();

    // Habilitar features para o grupo
    this.enableGroupFeatures(groupId);

    try {
      // Migrar usuários do grupo
      for (const userId of group.userIds) {
        if (this.abortController.signal.aborted) {
          throw new Error('Migração cancelada');
        }

        await this.migrateUser(userId, groupId);
        
        // Verificar thresholds após cada usuário
        if (this.shouldRollback(group)) {
          await this.rollbackGroup(groupId);
          return;
        }
      }

      // Migração completa
      group.status = 'completed';
      group.endDate = new Date();
      this.metrics.endTime = Date.now();
      this.savePilotGroups();

      console.log(`✅ Migração piloto completa: ${group.name}`);
      
    } catch (error) {
      console.error('❌ Erro na migração piloto:', error);
      await this.rollbackGroup(groupId);
    }
  }

  private async migrateUser(userId: string, groupId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Buscar dados do usuário no sistema antigo
      const userData = await this.fetchLegacyUserData(userId);
      
      // Migrar para novo sistema
      await this.migrationManager.migrateUserData(userData);
      
      // Atualizar métricas
      this.metrics.usersMigrated++;
      const migrationTime = Date.now() - startTime;
      this.updateAverageMigrationTime(migrationTime);
      
      // Log de sucesso
      await this.logMigration(userId, groupId, 'success', migrationTime);
      
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.errorRate = this.metrics.errorCount / this.metrics.usersMigrated;
      
      // Log de erro
      await this.logMigration(userId, groupId, 'error', 0, error);
      
      throw error;
    }
  }

  private updateAverageMigrationTime(newTime: number): void {
    const total = this.metrics.avgMigrationTime * (this.metrics.usersMigrated - 1) + newTime;
    this.metrics.avgMigrationTime = total / this.metrics.usersMigrated;
  }

  private async fetchLegacyUserData(userId: string): Promise<any> {
    // Simular busca de dados do sistema legado
    return {
      id: userId,
      // ... outros dados
    };
  }

  private shouldRollback(group: PilotGroup): boolean {
    const { rollbackThreshold } = group;
    
    // Verificar taxa de erro
    if (this.metrics.errorRate > rollbackThreshold.errorRate) {
      console.warn('⚠️ Taxa de erro excedeu threshold');
      return true;
    }

    // Verificar degradação de performance
    const performanceDegradation = this.calculatePerformanceDegradation();
    if (performanceDegradation > rollbackThreshold.performanceDegradation) {
      console.warn('⚠️ Degradação de performance excedeu threshold');
      return true;
    }

    // Verificar reclamações de usuários (simulado)
    const complaints = this.getUserComplaints(group.id);
    if (complaints > rollbackThreshold.userComplaints) {
      console.warn('⚠️ Número de reclamações excedeu threshold');
      return true;
    }

    return false;
  }

  private calculatePerformanceDegradation(): number {
    // Simular cálculo de degradação
    return Math.random() * 0.1; // 0-10%
  }

  private getUserComplaints(groupId: string): number {
    // Simular contagem de reclamações
    return Math.floor(Math.random() * 5);
  }

  // Rollback automático
  async rollbackGroup(groupId: string): Promise<void> {
    const group = this.pilotGroups.get(groupId);
    if (!group) return;

    console.log(`🔄 Iniciando rollback para grupo: ${group.name}`);

    group.status = 'rolled_back';
    this.metrics.rollbackCount++;
    
    // Desabilitar features
    this.disableGroupFeatures(groupId);
    
    // Reverter migração dos usuários
    for (const userId of group.userIds) {
      try {
        await this.rollbackUser(userId);
      } catch (error) {
        console.error(`Erro ao reverter usuário ${userId}:`, error);
      }
    }

    // Cancelar migração em andamento
    this.abortController?.abort();
    
    this.savePilotGroups();
    
    console.log(`✅ Rollback completo para grupo: ${group.name}`);
  }

  private async rollbackUser(userId: string): Promise<void> {
    // Implementar lógica de rollback
    // - Desabilitar features para o usuário
    // - Restaurar dados anteriores se necessário
    // - Limpar dados migrados
    
    featureFlags.override('new-ui', false);
    featureFlags.override('rag-search', false);
  }

  private enableGroupFeatures(groupId: string): void {
    // Habilitar features progressivamente
    featureFlags.updateFlag('new-ui', {
      enabled: true,
      targetGroups: [groupId]
    });

    featureFlags.updateFlag('rag-search', {
      enabled: true,
      targetGroups: [groupId]
    });

    featureFlags.updateFlag('real-time-sync', {
      enabled: true,
      targetGroups: [groupId]
    });
  }

  private disableGroupFeatures(groupId: string): void {
    const flags = ['new-ui', 'rag-search', 'real-time-sync'];
    
    flags.forEach(flag => {
      const current = featureFlags.getFlag(flag);
      if (current && current.targetGroups) {
        current.targetGroups = current.targetGroups.filter(g => g !== groupId);
        featureFlags.updateFlag(flag, current);
      }
    });
  }

  private async logMigration(
    userId: string,
    groupId: string,
    status: 'success' | 'error',
    duration: number,
    error?: any
  ): Promise<void> {
    const log = {
      userId,
      groupId,
      status,
      duration,
      error: error?.message,
      timestamp: Date.now()
    };

    // Salvar log localmente
    const logs = JSON.parse(localStorage.getItem('migration-logs') || '[]');
    logs.push(log);
    localStorage.setItem('migration-logs', JSON.stringify(logs));

    // Enviar para servidor se online
    if (navigator.onLine) {
      try {
        await fetch('/api/migration/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });
      } catch (e) {
        // Ignorar erros de rede
      }
    }
  }

  private updateProgress(progress: number): void {
    // Atualizar UI ou enviar eventos
    const event = new CustomEvent('migration-progress', {
      detail: { progress, metrics: this.metrics }
    });
    window.dispatchEvent(event);
  }

  private handleError(error: Error): void {
    console.error('Erro na migração:', error);
    this.metrics.errorCount++;
  }

  // Métodos públicos para UI
  getPilotGroups(): PilotGroup[] {
    return Array.from(this.pilotGroups.values());
  }

  getMetrics(): MigrationMetrics {
    return { ...this.metrics };
  }

  getMigrationLogs(): any[] {
    return JSON.parse(localStorage.getItem('migration-logs') || '[]');
  }

  // Pausar migração
  pauseMigration(): void {
    this.abortController?.abort();
    this.migrationManager.pause();
  }

  // Retomar migração
  resumeMigration(): void {
    this.migrationManager.resume();
  }

  // Limpar dados
  clearMigrationData(): void {
    localStorage.removeItem('migration-logs');
    localStorage.removeItem('pilot-groups');
    this.pilotGroups.clear();
    this.createDefaultGroups();
  }
}

// Export singleton
export const pilotMigration = PilotMigrationManager.getInstance();