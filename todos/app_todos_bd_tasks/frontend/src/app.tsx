import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useState, useRef, useEffect } from 'react'

// Importar páginas
import { PotentialIssues } from './pages/PotentialIssues'
import { ClaudeSessions } from './pages/ClaudeSessions'
import Documents from './pages/Documents'
import { ClaudeSessionDetailSimple } from './pages/ClaudeSessionDetailSimple'
import { RAGManagerEnhanced } from './components/RAGManagerEnhanced'

// Criar QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false
    }
  }
})

// Componente de Navegação
function Navigation() {
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const isActive = (path: string) => {
    return location.pathname === path
  }
  
  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  return (
    <nav className="bg-white shadow-sm mb-6">
      <div className="container mx-auto px-4 py-3">
        <div className="flex space-x-6 flex-wrap items-center">
          {/* Páginas Principais */}
          <Link 
            to="/playbooks" 
            className={`font-medium transition-colors ${
              isActive('/playbooks') || location.pathname.startsWith('/playbooks/') ? 'text-blue-800' : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            Playbooks
          </Link>
          
          <Link 
            to="/conversas" 
            className={`font-medium transition-colors ${
              isActive('/conversas') ? 'text-blue-800' : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            Conversas
          </Link>
          
          {/* Separador */}
          <span className="text-gray-300">|</span>
          
          {/* Páginas do Sistema */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={`font-medium transition-colors flex items-center gap-1 ${
                isActive('/') || isActive('/potential-issues') || isActive('/rag') ? 'text-blue-800' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              Sistema
              <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                <Link
                  to="/"
                  onClick={() => setShowDropdown(false)}
                  className={`block px-4 py-2 text-sm hover:bg-gray-100 ${
                    isActive('/') ? 'bg-gray-100 text-blue-800' : 'text-gray-700'
                  }`}
                >
                  Dashboard Principal
                </Link>
                <Link
                  to="/potential-issues"
                  onClick={() => setShowDropdown(false)}
                  className={`block px-4 py-2 text-sm hover:bg-gray-100 ${
                    isActive('/potential-issues') ? 'bg-gray-100 text-blue-800' : 'text-gray-700'
                  }`}
                >
                  Potenciais Problemas
                </Link>
                <Link
                  to="/rag"
                  onClick={() => setShowDropdown(false)}
                  className={`block px-4 py-2 text-sm hover:bg-gray-100 ${
                    isActive('/rag') ? 'bg-gray-100 text-blue-800' : 'text-gray-700'
                  }`}
                >
                  RAG Manager
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

// Dashboard Principal
function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Sistema de Tarefas Offline-First</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Funcionalidades Principais</h2>
          <ul className="space-y-3">
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Playbooks (Sessões Claude)</span>
            </li>
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Conversas (Documentos)</span>
            </li>
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>Potenciais Problemas</span>
            </li>
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span>RAG Manager</span>
            </li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Características</h2>
          <ul className="space-y-3">
            <li className="flex items-center">
              <span className="text-blue-600 mr-2">🔒</span>
              <span>Offline-First</span>
            </li>
            <li className="flex items-center">
              <span className="text-blue-600 mr-2">🔄</span>
              <span>Sincronização Automática</span>
            </li>
            <li className="flex items-center">
              <span className="text-blue-600 mr-2">🔍</span>
              <span>Busca Semântica</span>
            </li>
            <li className="flex items-center">
              <span className="text-blue-600 mr-2">🤖</span>
              <span>Integração Claude AI</span>
            </li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Status do Sistema</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Backend</span>
              <span className="text-green-600">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Frontend</span>
              <span className="text-green-600">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Banco Local</span>
              <span className="text-green-600">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <span>RAG</span>
              <span className="text-green-600">Ativo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// App Principal
function AppContent() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      
      <Routes>
        {/* Páginas Principais */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/potential-issues" element={<PotentialIssues />} />
        <Route path="/playbooks" element={<ClaudeSessions />} />
        <Route path="/playbooks/:sessionId" element={<ClaudeSessionDetailSimple />} />
        <Route path="/playbooks/:sessionId/:filter" element={<ClaudeSessionDetailSimple />} />
        <Route path="/claude-sessions" element={<ClaudeSessions />} />
        <Route path="/claude-sessions/:sessionId" element={<ClaudeSessionDetailSimple />} />
        <Route path="/claude-sessions/:sessionId/:filter" element={<ClaudeSessionDetailSimple />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/conversas" element={<Documents />} />
        <Route path="/rag" element={<RAGManagerEnhanced />} />
      </Routes>
    </div>
  )
}

// Componente App com Providers
export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}