export interface Metric {
  value: number;
  timestamp: number;
}

export interface PercentileMetrics {
  p50: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, Map<string, Metric[]>> = new Map();
  private readonly maxDataPoints = 1000;
  private readonly retentionPeriod = 3600000; // 1 hora

  private constructor() {
    // Limpar métricas antigas periodicamente
    setInterval(() => this.cleanOldMetrics(), 60000); // A cada minuto
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordMetric(category: string, metric: string, value: number): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, new Map());
    }

    const categoryMetrics = this.metrics.get(category)!;
    if (!categoryMetrics.has(metric)) {
      categoryMetrics.set(metric, []);
    }

    const metricData = categoryMetrics.get(metric)!;
    metricData.push({
      value,
      timestamp: Date.now()
    });

    // Manter apenas os últimos N pontos
    if (metricData.length > this.maxDataPoints) {
      metricData.shift();
    }
  }

  getMetric(category: string, metric: string): Metric[] {
    return this.metrics.get(category)?.get(metric) || [];
  }

  getPercentiles(category: string, metric: string): PercentileMetrics {
    const data = this.getMetric(category, metric);
    if (data.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const values = data.map(d => d.value).sort((a, b) => a - b);
    const p50Index = Math.floor(values.length * 0.5);
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);

    return {
      p50: values[p50Index] || 0,
      p95: values[p95Index] || 0,
      p99: values[p99Index] || 0
    };
  }

  getAverage(category: string, metric: string): number {
    const data = this.getMetric(category, metric);
    if (data.length === 0) return 0;

    const sum = data.reduce((acc, d) => acc + d.value, 0);
    return sum / data.length;
  }

  getRate(category: string, metric: string, windowMs: number = 60000): number {
    const data = this.getMetric(category, metric);
    const now = Date.now();
    const windowStart = now - windowMs;

    const recentData = data.filter(d => d.timestamp >= windowStart);
    return recentData.length / (windowMs / 1000); // Por segundo
  }

  getAllMetrics(): Record<string, Record<string, any>> {
    const result: Record<string, Record<string, any>> = {};

    this.metrics.forEach((categoryMetrics, category) => {
      result[category] = {};
      
      categoryMetrics.forEach((data, metric) => {
        if (data.length > 0) {
          const percentiles = this.getPercentiles(category, metric);
          const average = this.getAverage(category, metric);
          const rate = this.getRate(category, metric);

          result[category][metric] = {
            current: data[data.length - 1].value,
            average,
            ...percentiles,
            rate,
            dataPoints: data.length
          };
        }
      });
    });

    return result;
  }

  reset(): void {
    this.metrics.clear();
  }

  private cleanOldMetrics(): void {
    const now = Date.now();
    const cutoffTime = now - this.retentionPeriod;

    this.metrics.forEach((categoryMetrics) => {
      categoryMetrics.forEach((data, metric) => {
        const filteredData = data.filter(d => d.timestamp > cutoffTime);
        if (filteredData.length !== data.length) {
          categoryMetrics.set(metric, filteredData);
        }
      });
    });
  }

  // Métodos adicionais para integração com monitoring hooks
  startAutoCollection(): void {
    // Coletar métricas de performance do navegador
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        // Memory metrics (se disponível)
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          if (memory) {
            this.recordMetric('browser', 'heap-used', memory.usedJSHeapSize / 1048576); // MB
            this.recordMetric('browser', 'heap-total', memory.totalJSHeapSize / 1048576); // MB
          }
        }

        // Navigation timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.recordMetric('performance', 'page-load', navigation.loadEventEnd - navigation.fetchStart);
          this.recordMetric('performance', 'dom-content-loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
        }
      }, 10000); // A cada 10 segundos
    }
  }
}