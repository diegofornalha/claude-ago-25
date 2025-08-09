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