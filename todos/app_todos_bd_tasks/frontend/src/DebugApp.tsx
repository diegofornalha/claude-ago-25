import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  consoleErrors: string[];
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      consoleErrors: []
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      consoleErrors: []
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  componentDidMount() {
    // Capturar erros do console
    const originalError = console.error;
    console.error = (...args) => {
      this.setState(prev => ({
        consoleErrors: [...prev.consoleErrors, args.join(' ')]
      }));
      originalError.apply(console, args);
    };

    // Capturar erros globais
    window.addEventListener('error', (event) => {
      this.setState(prev => ({
        consoleErrors: [...prev.consoleErrors, `Global error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`]
      }));
    });

    // Capturar promises rejeitadas
    window.addEventListener('unhandledrejection', (event) => {
      this.setState(prev => ({
        consoleErrors: [...prev.consoleErrors, `Unhandled promise rejection: ${event.reason}`]
      }));
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>Erro Capturado!</h1>
          
          <h2>Erro:</h2>
          <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          
          <h2>Stack Trace:</h2>
          <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
            {this.state.error?.stack}
          </pre>
          
          {this.state.errorInfo && (
            <>
              <h2>Component Stack:</h2>
              <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </>
          )}

          {this.state.consoleErrors.length > 0 && (
            <>
              <h2>Console Errors:</h2>
              <div style={{ backgroundColor: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
                {this.state.consoleErrors.map((err, i) => (
                  <pre key={i}>{err}</pre>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        {this.props.children}
        {this.state.consoleErrors.length > 0 && (
          <div style={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            backgroundColor: '#ffcccc', 
            padding: '10px',
            maxHeight: '200px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            <strong>Console Errors:</strong>
            {this.state.consoleErrors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}
      </>
    );
  }
}

// Componente de teste simples
function TestComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Debug Mode Ativo</h1>
      <p>Este componente captura e exibe erros.</p>
      <button onClick={() => {
        throw new Error('Erro de teste!');
      }}>
        Gerar Erro de Teste
      </button>
    </div>
  );
}

// App principal com debug
export function DebugApp() {
  const [showApp, setShowApp] = React.useState(false);

  return (
    <ErrorBoundary>
      <div>
        <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
          <h2>Debug Control Panel</h2>
          <button onClick={() => setShowApp(!showApp)}>
            {showApp ? 'Esconder' : 'Mostrar'} App Principal
          </button>
        </div>
        
        {showApp ? (
          <div>
            <h3>Tentando carregar App principal...</h3>
            {/* Vamos tentar importar o App dinamicamente */}
            <DynamicAppLoader />
          </div>
        ) : (
          <TestComponent />
        )}
      </div>
    </ErrorBoundary>
  );
}

// Componente que tenta carregar o App dinamicamente
function DynamicAppLoader() {
  const [App, setApp] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    import('./App')
      .then(module => {
        setApp(() => module.App);
      })
      .catch(err => {
        setError(err.toString());
      });
  }, []);

  if (error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        <h3>Erro ao carregar App:</h3>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!App) {
    return <div>Carregando App...</div>;
  }

  return <App />;
}