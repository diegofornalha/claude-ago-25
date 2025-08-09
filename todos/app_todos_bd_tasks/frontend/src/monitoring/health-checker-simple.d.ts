export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: number;
}

export class HealthChecker {
  constructor(intervalMs?: number, timeoutMs?: number);
  registerCheck(service: string, checkFn: () => Promise<HealthCheckResult>): void;
  runCheck(service: string): Promise<HealthCheckResult>;
  runAllChecks(): Promise<SystemHealth>;
  start(): void;
  stop(): void;
  onHealthChange(listener: (health: SystemHealth) => void): () => void;
  getLastResults(): SystemHealth;
}