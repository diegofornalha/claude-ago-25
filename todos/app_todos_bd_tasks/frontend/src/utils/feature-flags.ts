export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers?: string[];
  targetGroups?: string[];
  conditions?: FeatureCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureCondition {
  type: 'user' | 'group' | 'environment' | 'date' | 'custom';
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: Map<string, FeatureFlag> = new Map();
  private userId: string | null = null;
  private userGroups: string[] = [];
  private overrides: Map<string, boolean> = new Map();

  private constructor() {
    this.loadFlags();
    this.loadOverrides();
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  // Carregar flags do servidor ou localStorage
  private async loadFlags(): Promise<void> {
    try {
      // Tentar buscar do servidor
      const response = await fetch('/api/feature-flags', {
        headers: { 'X-User-Id': this.userId || '' }
      });
      
      if (response.ok) {
        const flags = await response.json();
        this.updateFlags(flags);
      }
    } catch (error) {
      // Fallback para flags locais
      this.loadLocalFlags();
    }
  }

  private loadLocalFlags(): void {
    const localFlags = localStorage.getItem('feature-flags');
    if (localFlags) {
      const flags = JSON.parse(localFlags);
      this.updateFlags(flags);
    } else {
      // Flags padrão
      this.setDefaultFlags();
    }
  }

  private setDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'new-ui',
        name: 'Nova Interface',
        description: 'Interface redesenhada com melhor UX',
        enabled: false,
        rolloutPercentage: 0
      },
      {
        key: 'rag-search',
        name: 'Busca Semântica RAG',
        description: 'Busca avançada com embeddings locais',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'offline-mode',
        name: 'Modo Offline Completo',
        description: 'Funcionalidade completa sem internet',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'auto-backup',
        name: 'Backup Automático',
        description: 'Backup incremental automático',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'real-time-sync',
        name: 'Sincronização em Tempo Real',
        description: 'Sync via WebSocket em tempo real',
        enabled: false,
        rolloutPercentage: 50
      },
      {
        key: 'ai-suggestions',
        name: 'Sugestões de IA',
        description: 'Sugestões inteligentes baseadas em contexto',
        enabled: false,
        rolloutPercentage: 25
      },
      {
        key: 'advanced-analytics',
        name: 'Analytics Avançado',
        description: 'Dashboard com métricas detalhadas',
        enabled: false,
        rolloutPercentage: 10
      },
      {
        key: 'debug-mode',
        name: 'Modo Debug',
        description: 'Ferramentas avançadas de debug',
        enabled: process.env.NODE_ENV === 'development',
        rolloutPercentage: 100
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });

    this.saveFlags();
  }

  private updateFlags(flags: FeatureFlag[]): void {
    flags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
    this.saveFlags();
  }

  private saveFlags(): void {
    const flagsArray = Array.from(this.flags.values());
    localStorage.setItem('feature-flags', JSON.stringify(flagsArray));
  }

  private loadOverrides(): void {
    const overrides = localStorage.getItem('feature-flag-overrides');
    if (overrides) {
      const parsed = JSON.parse(overrides);
      Object.entries(parsed).forEach(([key, value]) => {
        this.overrides.set(key, value as boolean);
      });
    }
  }

  private saveOverrides(): void {
    const overridesObj = Object.fromEntries(this.overrides);
    localStorage.setItem('feature-flag-overrides', JSON.stringify(overridesObj));
  }

  // Configurar usuário
  setUser(userId: string, groups: string[] = []): void {
    this.userId = userId;
    this.userGroups = groups;
    this.loadFlags(); // Recarregar flags com contexto do usuário
  }

  // Verificar se feature está habilitada
  isEnabled(key: string): boolean {
    // Verificar override primeiro
    if (this.overrides.has(key)) {
      return this.overrides.get(key)!;
    }

    const flag = this.flags.get(key);
    if (!flag) return false;

    // Flag desabilitada globalmente
    if (!flag.enabled) return false;

    // Verificar usuários específicos
    if (flag.targetUsers && this.userId) {
      if (flag.targetUsers.includes(this.userId)) {
        return true;
      }
    }

    // Verificar grupos
    if (flag.targetGroups && this.userGroups.length > 0) {
      const hasTargetGroup = flag.targetGroups.some(group => 
        this.userGroups.includes(group)
      );
      if (hasTargetGroup) return true;
    }

    // Verificar condições
    if (flag.conditions && flag.conditions.length > 0) {
      const meetsConditions = this.evaluateConditions(flag.conditions);
      if (!meetsConditions) return false;
    }

    // Rollout percentual
    if (flag.rolloutPercentage < 100) {
      return this.isInRollout(key, flag.rolloutPercentage);
    }

    return true;
  }

  private evaluateConditions(conditions: FeatureCondition[]): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'environment':
          return this.evaluateEnvironmentCondition(condition);
        case 'date':
          return this.evaluateDateCondition(condition);
        case 'user':
          return this.evaluateUserCondition(condition);
        case 'custom':
          return this.evaluateCustomCondition(condition);
        default:
          return true;
      }
    });
  }

  private evaluateEnvironmentCondition(condition: FeatureCondition): boolean {
    const env = process.env.NODE_ENV;
    switch (condition.operator) {
      case 'equals':
        return env === condition.value;
      case 'contains':
        return env?.includes(condition.value) || false;
      default:
        return false;
    }
  }

  private evaluateDateCondition(condition: FeatureCondition): boolean {
    const now = Date.now();
    switch (condition.operator) {
      case 'greaterThan':
        return now > new Date(condition.value).getTime();
      case 'lessThan':
        return now < new Date(condition.value).getTime();
      case 'between':
        const [start, end] = condition.value;
        return now > new Date(start).getTime() && now < new Date(end).getTime();
      default:
        return false;
    }
  }

  private evaluateUserCondition(condition: FeatureCondition): boolean {
    if (!this.userId) return false;
    
    switch (condition.operator) {
      case 'equals':
        return this.userId === condition.value;
      case 'contains':
        return this.userId.includes(condition.value);
      default:
        return false;
    }
  }

  private evaluateCustomCondition(condition: FeatureCondition): boolean {
    // Implementar lógica customizada
    return true;
  }

  private isInRollout(key: string, percentage: number): boolean {
    if (!this.userId) {
      // Sem usuário, usar random
      return Math.random() * 100 < percentage;
    }

    // Hash consistente baseado no userId e key
    const hash = this.hashCode(`${this.userId}-${key}`);
    const bucket = Math.abs(hash) % 100;
    return bucket < percentage;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Override manual
  override(key: string, enabled: boolean): void {
    this.overrides.set(key, enabled);
    this.saveOverrides();
  }

  clearOverride(key: string): void {
    this.overrides.delete(key);
    this.saveOverrides();
  }

  clearAllOverrides(): void {
    this.overrides.clear();
    this.saveOverrides();
  }

  // Obter todas as flags
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  // Obter flag específica
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  // Atualizar flag (admin)
  updateFlag(key: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(key);
    if (flag) {
      Object.assign(flag, updates);
      this.saveFlags();
    }
  }

  // Criar nova flag
  createFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
    this.saveFlags();
  }

  // Deletar flag
  deleteFlag(key: string): void {
    this.flags.delete(key);
    this.saveFlags();
  }

  // Analytics
  trackUsage(key: string, value?: any): void {
    // Enviar para analytics
    const event = {
      type: 'feature_flag_usage',
      flag: key,
      enabled: this.isEnabled(key),
      value,
      userId: this.userId,
      timestamp: Date.now()
    };

    // Enviar para servidor ou analytics local
    console.log('Feature flag usage:', event);
  }
}

// Singleton instance
export const featureFlags = FeatureFlagManager.getInstance();

// React Hook
export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(() => featureFlags.isEnabled(key));

  useEffect(() => {
    // Re-verificar quando mudar
    const checkFlag = () => {
      setEnabled(featureFlags.isEnabled(key));
    };

    // Verificar a cada 30 segundos
    const interval = setInterval(checkFlag, 30000);

    return () => clearInterval(interval);
  }, [key]);

  // Track usage
  useEffect(() => {
    featureFlags.trackUsage(key);
  }, [key, enabled]);

  return enabled;
}

// HOC para feature flags
export function withFeatureFlag<P extends object>(
  key: string,
  fallback?: React.ComponentType<P>
): (Component: React.ComponentType<P>) => React.ComponentType<P> {
  return (Component: React.ComponentType<P>) => {
    return (props: P) => {
      const enabled = useFeatureFlag(key);
      
      if (!enabled) {
        return fallback ? React.createElement(fallback, props) : null;
      }
      
      return React.createElement(Component, props);
    };
  };
}