import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  sessionId?: string;
}

interface TaskGroup {
  title: string;
  description: string;
  tasks: Task[];
  sessionId?: string;
}

export function RAGTaskBoard() {
  // Buscar tarefas de múltiplas sessões
  const { data: taskGroups, isLoading } = useQuery({
    queryKey: ['rag-tasks'],
    queryFn: async () => {
      // Por enquanto, dados mockados - depois conectar com API
      const groups: TaskGroup[] = [
        {
          title: "🔧 Backend Integration",
          description: "Tarefas para integrar servidor MCP com backend",
          sessionId: "53743da6-b140-4d67-9798-7564c43321d4",
          tasks: [
            { id: "4", content: "Sincronizar cache local com PostgreSQL", status: "pending", priority: "high" },
            { id: "7", content: "Unificar sistema de busca vetorial", status: "pending", priority: "medium" },
            { id: "15", content: "Adicionar ferramenta index_session", status: "pending", priority: "high" }
          ]
        },
        {
          title: "🎨 Frontend Development",
          description: "Interface visual para o sistema RAG",
          sessionId: "431f9873-d237-490f-83cc-a3d31c527e98",
          tasks: [
            { id: "21", content: "Conectar com API real", status: "pending", priority: "high" },
            { id: "22", content: "Interface de busca avançada", status: "pending", priority: "high" },
            { id: "23", content: "Real-time updates com WebSocket", status: "pending", priority: "medium" }
          ]
        },
        {
          title: "🚀 Performance & Scale",
          description: "Otimizações para grande volume de dados",
          tasks: [
            { id: "9", content: "Migrar para sentence-transformers", status: "pending", priority: "medium" },
            { id: "16", content: "Worker para processar em background", status: "pending", priority: "medium" },
            { id: "17", content: "Cache + índice invertido", status: "pending", priority: "medium" }
          ]
        }
      ];
      
      return groups;
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🎯 RAG Implementation Board</h1>
        <p className="text-gray-600">
          Acompanhe o progresso da implementação do sistema RAG em tempo real
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">25</div>
          <div className="text-sm text-gray-600">Total de Tarefas</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">8</div>
          <div className="text-sm text-gray-600">Completadas</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">1</div>
          <div className="text-sm text-gray-600">Em Progresso</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-600">16</div>
          <div className="text-sm text-gray-600">Pendentes</div>
        </div>
      </div>

      {/* Task Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {taskGroups?.map((group, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
              <h3 className="text-xl font-bold text-white">{group.title}</h3>
              <p className="text-blue-100 text-sm mt-1">{group.description}</p>
              {group.sessionId && (
                <a 
                  href={`/claude-sessions/${group.sessionId}`}
                  className="text-xs text-blue-200 hover:text-white mt-2 inline-block"
                >
                  📄 Ver sessão completa →
                </a>
              )}
            </div>
            
            <div className="p-4 space-y-3">
              {group.tasks.map((task) => (
                <div 
                  key={task.id}
                  className={`p-3 rounded-lg border ${getPriorityColor(task.priority)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getStatusIcon(task.status)}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs opacity-75">
                          {task.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">📅 Cronograma Estimado</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-600">Semana 1</div>
            <div className="flex-1 bg-blue-100 rounded-full h-8 flex items-center px-4">
              <span className="text-sm text-blue-800">Backend Integration + API Connection</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-600">Semana 2</div>
            <div className="flex-1 bg-green-100 rounded-full h-8 flex items-center px-4">
              <span className="text-sm text-green-800">Search Interface + Real-time Updates</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-600">Semana 3</div>
            <div className="flex-1 bg-purple-100 rounded-full h-8 flex items-center px-4">
              <span className="text-sm text-purple-800">Performance + Advanced Visualizations</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-600">Semana 4</div>
            <div className="flex-1 bg-yellow-100 rounded-full h-8 flex items-center px-4">
              <span className="text-sm text-yellow-800">Testing + Documentation + Polish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-4 justify-center">
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          🚀 Começar Próxima Tarefa
        </button>
        <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
          📊 Ver Analytics Detalhado
        </button>
        <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          ✅ Marcar Tarefa como Completa
        </button>
      </div>
    </div>
  );
}