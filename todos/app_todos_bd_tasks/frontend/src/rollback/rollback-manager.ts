import { BackupManager } from '../backup/backup-manager';
import { featureFlags } from '../utils/feature-flags';
import { db } from '../db/pglite-instance';
import { sql } from 'drizzle-orm';

export interface RollbackPoint {
  id: string;
  timestamp: number;
  version: string;
  description: string;
  backupId: string;
  featureFlags: Record<string, boolean>;
  metadata: {
    userCount: number;
    dataCount: number;
    schemaVersion: string;
    environment: string;
  };
}

export interface RollbackConfig {
  autoRollbackEnabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    availabilityTarget: number;
  };
  monitoringWindow: number; // ms
  cooldownPeriod: number; // ms
}

export class RollbackManager {
  private static instance: RollbackManager;
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private config: RollbackConfig;
  private backupManager: BackupManager;
  private isMonitoring: boolean = false;
  private monitoringInterval?: number;
  private metrics = {
    errorCount: 0,
    totalRequests: 0,
    responseTimeSum: 0,
    downtime: 0,
    lastHealthCheck: Date.now()
  };

  private constructor() {
    this.config = this.loadConfig();
    this.backupManager = new BackupManager();
    this.loadRollbackPoints();
    
    if (this.config.autoRollbackEnabled) {
      this.startMonitoring();
    }
  }

  static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }

  private loadConfig(): RollbackConfig {
    const saved = localStorage.getItem('rollback-config');
    if (saved) {
      return JSON.parse(saved);
    }

    return {
      autoRollbackEnabled: true,
      thresholds: {
        errorRate: 0.05, // 5%
        responseTime: 2000, // 2s
        availabilityTarget: 0.995 // 99.5%
      },
      monitoringWindow: 300000, // 5 minutos
      cooldownPeriod: 3600000 // 1 hora
    };
  }

  private saveConfig(): void {
    localStorage.setItem('rollback-config', JSON.stringify(this.config));
  }

  private loadRollbackPoints(): void {
    const saved = localStorage.getItem('rollback-points');
    if (saved) {
      const points = JSON.parse(saved);
      points.forEach((point: RollbackPoint) => {
        this.rollbackPoints.set(point.id, point);
      });
    }
  }

  private saveRollbackPoints(): void {
    const points = Array.from(this.rollbackPoints.values());
    localStorage.setItem('rollback-points', JSON.stringify(points));
  }

  // Criar ponto de rollback
  async createRollbackPoint(description: string): Promise<RollbackPoint> {
    console.log('📍 Criando ponto de rollback:', description);

    // Criar backup completo
    const backupId = await this.backupManager.performBackup('full');
    
    // Capturar estado atual
    const point: RollbackPoint = {
      id: `rollback-${Date.now()}`,
      timestamp: Date.now(),
      version: this.getCurrentVersion(),
      description,
      backupId,
      featureFlags: this.captureFeatureFlags(),
      metadata: await this.captureMetadata()
    };

    this.rollbackPoints.set(point.id, point);
    this.saveRollbackPoints();

    console.log('✅ Ponto de rollback criado:', point.id);
    return point;
  }

  private getCurrentVersion(): string {
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  private captureFeatureFlags(): Record<string, boolean> {
    const flags = featureFlags.getAllFlags();
    const snapshot: Record<string, boolean> = {};
    
    flags.forEach(flag => {
      snapshot[flag.key] = flag.enabled;
    });
    
    return snapshot;
  }

  private async captureMetadata(): Promise<RollbackPoint['metadata']> {
    const [userCount] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const [dataCount] = await db.execute(sql`SELECT COUNT(*) as count FROM issues`);
    
    return {
      userCount: Number(userCount.rows[0]?.count) || 0,
      dataCount: Number(dataCount.rows[0]?.count) || 0,
      schemaVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    };
  }

  // Executar rollback
  async rollback(pointId: string): Promise<void> {
    const point = this.rollbackPoints.get(pointId);
    if (!point) {
      throw new Error('Ponto de rollback não encontrado');
    }

    console.log('🔄 Iniciando rollback para:', point.description);

    try {
      // 1. Pausar todas as operações
      await this.pauseOperations();

      // 2. Restaurar backup
      await this.backupManager.restoreBackup(point.backupId);

      // 3. Restaurar feature flags
      await this.restoreFeatureFlags(point.featureFlags);

      // 4. Limpar caches
      await this.clearCaches();

      // 5. Recarregar aplicação
      this.scheduleReload();

      console.log('✅ Rollback completo');
      
    } catch (error) {
      console.error('❌ Erro durante rollback:', error);
      throw error;
    }
  }

  private async pauseOperations(): Promise<void> {
    // Pausar sync
    const event = new CustomEvent('pause-all-operations');
    window.dispatchEvent(event);
    
    // Aguardar operações em andamento
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async restoreFeatureFlags(flags: Record<string, boolean>): Promise<void> {
    Object.entries(flags).forEach(([key, enabled]) => {
      const flag = featureFlags.getFlag(key);
      if (flag) {
        featureFlags.updateFlag(key, { enabled });
      }
    });
  }

  private async clearCaches(): Promise<void> {
    // Limpar caches do browser
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Limpar localStorage (exceto dados críticos)
    const keysToKeep = ['user-id', 'auth-token'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
  }

  private scheduleReload(): void {
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  // Monitoramento automático
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Interceptar erros globais
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handleRejection.bind(this));

    // Monitorar performance
    this.monitorPerformance();

    // Verificar thresholds periodicamente
    this.monitoringInterval = window.setInterval(() => {
      this.checkThresholds();
    }, 10000); // A cada 10 segundos

    console.log('🔍 Monitoramento de rollback ativado');
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    window.removeEventListener('error', this.handleError.bind(this));
    window.removeEventListener('unhandledrejection', this.handleRejection.bind(this));

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('🔍 Monitoramento de rollback desativado');
  }

  private handleError(event: ErrorEvent): void {
    this.metrics.errorCount++;
    this.metrics.totalRequests++;
    
    // Log do erro
    console.error('Erro capturado para rollback:', event.error);
  }

  private handleRejection(event: PromiseRejectionEvent): void {
    this.metrics.errorCount++;
    this.metrics.totalRequests++;
    
    console.error('Promise rejeitada:', event.reason);
  }

  private monitorPerformance(): void {
    // Observar performance de navegação
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
          this.metrics.totalRequests++;
          this.metrics.responseTimeSum += entry.duration;
        }
      }
    });

    observer.observe({ entryTypes: ['navigation', 'resource'] });
  }

  private async checkThresholds(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    // Calcular métricas
    const errorRate = this.metrics.totalRequests > 0 
      ? this.metrics.errorCount / this.metrics.totalRequests 
      : 0;
      
    const avgResponseTime = this.metrics.totalRequests > 0
      ? this.metrics.responseTimeSum / this.metrics.totalRequests
      : 0;

    const availability = 1 - (this.metrics.downtime / (now - this.metrics.lastHealthCheck));

    // Verificar se deve fazer rollback
    const shouldRollback = 
      errorRate > this.config.thresholds.errorRate ||
      avgResponseTime > this.config.thresholds.responseTime ||
      availability < this.config.thresholds.availabilityTarget;

    if (shouldRollback) {
      console.warn('⚠️ Thresholds excedidos, iniciando rollback automático');
      await this.performAutoRollback();
    }

    // Reset metrics para próxima janela
    if (now - this.metrics.lastHealthCheck > this.config.monitoringWindow) {
      this.resetMetrics();
    }
  }

  private async performAutoRollback(): Promise<void> {
    // Verificar cooldown
    const lastRollback = localStorage.getItem('last-auto-rollback');
    if (lastRollback) {
      const timeSinceLastRollback = Date.now() - parseInt(lastRollback);
      if (timeSinceLastRollback < this.config.cooldownPeriod) {
        console.log('⏳ Em período de cooldown, rollback não executado');
        return;
      }
    }

    // Buscar último ponto de rollback
    const points = Array.from(this.rollbackPoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
      
    if (points.length === 0) {
      console.error('❌ Nenhum ponto de rollback disponível');
      return;
    }

    // Executar rollback
    try {
      await this.rollback(points[0].id);
      localStorage.setItem('last-auto-rollback', Date.now().toString());
    } catch (error) {
      console.error('❌ Erro no rollback automático:', error);
    }
  }

  private resetMetrics(): void {
    this.metrics = {
      errorCount: 0,
      totalRequests: 0,
      responseTimeSum: 0,
      downtime: 0,
      lastHealthCheck: Date.now()
    };
  }

  // Métodos públicos
  updateConfig(config: Partial<RollbackConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();

    if (this.config.autoRollbackEnabled && !this.isMonitoring) {
      this.startMonitoring();
    } else if (!this.config.autoRollbackEnabled && this.isMonitoring) {
      this.stopMonitoring();
    }
  }

  getRollbackPoints(): RollbackPoint[] {
    return Array.from(this.rollbackPoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  deleteRollbackPoint(id: string): void {
    this.rollbackPoints.delete(id);
    this.saveRollbackPoints();
  }

  getConfig(): RollbackConfig {
    return { ...this.config };
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  // Teste de rollback
  async testRollback(pointId: string): Promise<boolean> {
    try {
      const point = this.rollbackPoints.get(pointId);
      if (!point) return false;

      // Verificar se backup existe
      const backupList = await this.backupManager.listBackups();
      const backupExists = backupList.some(b => b.id === point.backupId);

      if (!backupExists) {
        console.error('Backup não encontrado para teste');
        return false;
      }

      console.log('✅ Teste de rollback: OK');
      return true;
      
    } catch (error) {
      console.error('❌ Teste de rollback falhou:', error);
      return false;
    }
  }
}

// Export singleton
export const rollbackManager = RollbackManager.getInstance();