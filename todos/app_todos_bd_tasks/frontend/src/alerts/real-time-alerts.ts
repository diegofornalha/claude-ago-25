import { EventEmitter } from 'events';

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  source: string;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  metadata?: Record<string, any>;
  persistent?: boolean;
  autoDismiss?: number; // ms
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  severity: Alert['severity'];
  type: Alert['type'];
  title: string;
  message: (data: any) => string;
  cooldown?: number; // ms entre alertas
  maxAlerts?: number; // máximo de alertas por período
  enabled: boolean;
}

export class RealTimeAlertSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Alert[] = [];
  private cooldowns: Map<string, number> = new Map();
  private alertCounts: Map<string, number> = new Map();
  private listeners: Set<(alert: Alert) => void> = new Set();

  constructor() {
    super();
    this.setupDefaultRules();
    this.startCleanupInterval();
  }

  private setupDefaultRules(): void {
    // Regra: Taxa de erro alta
    this.addRule({
      id: 'high-error-rate',
      name: 'Taxa de Erro Alta',
      condition: (data) => data.errorRate > 0.05,
      severity: 'high',
      type: 'error',
      title: 'Taxa de Erro Elevada',
      message: (data) => `Taxa de erro: ${(data.errorRate * 100).toFixed(1)}%`,
      cooldown: 300000, // 5 minutos
      enabled: true
    });

    // Regra: Memória alta
    this.addRule({
      id: 'high-memory',
      name: 'Uso de Memória Alto',
      condition: (data) => data.memoryUsage > 90,
      severity: 'high',
      type: 'warning',
      title: 'Memória Quase Cheia',
      message: (data) => `Uso de memória: ${data.memoryUsage.toFixed(1)}%`,
      cooldown: 600000, // 10 minutos
      enabled: true
    });

    // Regra: Storage crítico
    this.addRule({
      id: 'critical-storage',
      name: 'Armazenamento Crítico',
      condition: (data) => data.storageUsage > 95,
      severity: 'critical',
      type: 'error',
      title: 'Armazenamento Crítico',
      message: (data) => `Apenas ${(100 - data.storageUsage).toFixed(1)}% de espaço livre`,
      cooldown: 1800000, // 30 minutos
      enabled: true
    });

    // Regra: Fila de sync grande
    this.addRule({
      id: 'large-sync-queue',
      name: 'Fila de Sincronização Grande',
      condition: (data) => data.syncQueueSize > 1000,
      severity: 'medium',
      type: 'warning',
      title: 'Fila de Sync Grande',
      message: (data) => `${data.syncQueueSize} itens aguardando sincronização`,
      cooldown: 900000, // 15 minutos
      enabled: true
    });

    // Regra: Desconexão prolongada
    this.addRule({
      id: 'prolonged-disconnect',
      name: 'Desconexão Prolongada',
      condition: (data) => data.disconnectedTime > 300000, // 5 minutos
      severity: 'medium',
      type: 'warning',
      title: 'Offline Há Muito Tempo',
      message: (data) => `Desconectado há ${Math.round(data.disconnectedTime / 60000)} minutos`,
      cooldown: 1800000, // 30 minutos
      enabled: true
    });

    // Regra: Latência alta
    this.addRule({
      id: 'high-latency',
      name: 'Latência Alta',
      condition: (data) => data.latencyP95 > 2000,
      severity: 'medium',
      type: 'warning',
      title: 'Performance Degradada',
      message: (data) => `Latência P95: ${data.latencyP95.toFixed(0)}ms`,
      cooldown: 600000, // 10 minutos
      enabled: true
    });

    // Regra: Conflitos frequentes
    this.addRule({
      id: 'frequent-conflicts',
      name: 'Conflitos Frequentes',
      condition: (data) => data.conflictRate > 0.1,
      severity: 'medium',
      type: 'warning',
      title: 'Muitos Conflitos de Dados',
      message: (data) => `${(data.conflictRate * 100).toFixed(1)}% das operações geraram conflitos`,
      cooldown: 1200000, // 20 minutos
      enabled: true
    });

    // Regra: Backup atrasado
    this.addRule({
      id: 'backup-overdue',
      name: 'Backup Atrasado',
      condition: (data) => data.timeSinceLastBackup > 86400000, // 24 horas
      severity: 'high',
      type: 'warning',
      title: 'Backup Necessário',
      message: (data) => `Último backup há ${Math.round(data.timeSinceLastBackup / 3600000)} horas`,
      cooldown: 14400000, // 4 horas
      enabled: true
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  evaluate(data: Record<string, any>): void {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(data)) {
          this.triggerAlert(rule, data);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }
  }

  private triggerAlert(rule: AlertRule, data: any): void {
    // Verificar cooldown
    const lastAlertTime = this.cooldowns.get(rule.id) || 0;
    const now = Date.now();
    
    if (now - lastAlertTime < (rule.cooldown || 0)) {
      return; // Ainda em cooldown
    }

    // Verificar limite de alertas
    if (rule.maxAlerts) {
      const count = this.alertCounts.get(rule.id) || 0;
      if (count >= rule.maxAlerts) {
        return;
      }
      this.alertCounts.set(rule.id, count + 1);
    }

    // Criar alerta
    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      type: rule.type,
      severity: rule.severity,
      title: rule.title,
      message: rule.message(data),
      timestamp: now,
      source: rule.id,
      persistent: rule.severity === 'critical',
      autoDismiss: rule.severity === 'low' ? 5000 : 
                   rule.severity === 'medium' ? 10000 : undefined,
      metadata: { ruleId: rule.id, data }
    };

    // Adicionar ações baseadas no tipo de alerta
    if (rule.id === 'backup-overdue') {
      alert.actions = [{
        label: 'Fazer Backup Agora',
        action: () => this.emit('action:backup')
      }];
    } else if (rule.id === 'critical-storage') {
      alert.actions = [{
        label: 'Limpar Cache',
        action: () => this.emit('action:clear-cache')
      }];
    }

    // Registrar alerta
    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    this.cooldowns.set(rule.id, now);

    // Notificar listeners
    this.emit('alert', alert);
    this.listeners.forEach(listener => listener(alert));

    // Auto-dismiss se configurado
    if (alert.autoDismiss) {
      setTimeout(() => this.dismissAlert(alert.id), alert.autoDismiss);
    }
  }

  createManualAlert(options: Partial<Alert> & { title: string; message: string }): string {
    const alert: Alert = {
      id: `manual-${Date.now()}`,
      type: options.type || 'info',
      severity: options.severity || 'low',
      timestamp: Date.now(),
      source: 'manual',
      ...options
    };

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    
    this.emit('alert', alert);
    this.listeners.forEach(listener => listener(alert));

    return alert.id;
  }

  dismissAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      this.alerts.delete(alertId);
      this.emit('alert:dismissed', alert);
    }
  }

  dismissAllAlerts(): void {
    const alertIds = Array.from(this.alerts.keys());
    alertIds.forEach(id => this.dismissAlert(id));
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => {
        // Ordenar por severidade e depois por timestamp
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
      });
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  onAlert(listener: (alert: Alert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notificações do navegador
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async showNotification(alert: Alert): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(alert.title, {
      body: alert.message,
      icon: '/icon.png',
      badge: '/badge.png',
      tag: alert.id,
      requireInteraction: alert.severity === 'critical',
      silent: alert.severity === 'low',
      data: alert
    });

    notification.onclick = () => {
      window.focus();
      this.emit('notification:clicked', alert);
    };
  }

  private startCleanupInterval(): void {
    // Limpar alertas antigos e resetar contadores a cada hora
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      
      // Limpar histórico antigo
      this.alertHistory = this.alertHistory.filter(
        alert => alert.timestamp > oneHourAgo
      );

      // Resetar contadores de alerta
      this.alertCounts.clear();
    }, 3600000); // 1 hora
  }

  destroy(): void {
    this.removeAllListeners();
    this.listeners.clear();
    this.alerts.clear();
    this.rules.clear();
    this.alertHistory = [];
  }
}