import React, { lazy, Suspense, ComponentType } from 'react';

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

// Error boundary para lazy components
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-red-500">
          <p>Erro ao carregar componente</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper para criar lazy components com fallback
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
): React.LazyExoticComponent<T> {
  const LazyComponent = lazy(importFunc);

  return React.forwardRef((props, ref) => (
    <LazyErrorBoundary>
      <Suspense fallback={fallback || <LoadingFallback />}>
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </LazyErrorBoundary>
  )) as any;
}

// Prefetch component
export function prefetchComponent(
  importFunc: () => Promise<{ default: ComponentType<any> }>
): void {
  importFunc().catch(err => {
    console.error('Prefetch failed:', err);
  });
}

// Hook para prefetch no hover
export function usePrefetch(
  importFunc: () => Promise<{ default: ComponentType<any> }>
) {
  const prefetched = React.useRef(false);

  const handlePrefetch = React.useCallback(() => {
    if (!prefetched.current) {
      prefetched.current = true;
      prefetchComponent(importFunc);
    }
  }, [importFunc]);

  return handlePrefetch;
}

// Lazy load com retry
export function lazyLoadWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await importFunc();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  });
}

// Componentes lazy carregados
export const LazyComponents = {
  // Dashboard principal
  Dashboard: lazyLoad(() => import('@/components/Dashboard')),
  
  // Monitoring
  MonitoringDashboard: lazyLoad(() => import('@/monitoring/monitoring-dashboard')),
  
  // Debug
  DebugPanel: lazyLoad(() => import('@/debug/debug-panel')),
  
  // Backup
  BackupUI: lazyLoad(() => import('@/backup/backup-ui')),
  
  // Charts (pesado, carregar sob demanda)
  Charts: lazyLoadWithRetry(() => import('@/components/Charts')),
  
  // Editor (Monaco é pesado)
  CodeEditor: lazyLoadWithRetry(() => import('@/components/CodeEditor')),
  
  // Migration UI
  MigrationUI: lazyLoad(() => import('@/migration/migration-ui'))
};

// Route-based code splitting
export const LazyRoutes = {
  Home: lazyLoad(() => import('@/pages/Home')),
  Settings: lazyLoad(() => import('@/pages/Settings')),
  Backup: lazyLoad(() => import('@/pages/Backup')),
  Debug: lazyLoad(() => import('@/pages/Debug')),
  Migration: lazyLoad(() => import('@/pages/Migration'))
};

// Intersection Observer para lazy loading de componentes visíveis
export function LazyVisible({ 
  children, 
  threshold = 0.1,
  rootMargin = '100px'
}: {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : <LoadingFallback />}
    </div>
  );
}