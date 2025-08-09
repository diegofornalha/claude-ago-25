import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../db/pglite-instance';
import { sql } from 'drizzle-orm';
import { issues, users, syncQueue } from '../shared/schema';

export const Dashboard: React.FC = () => {
  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [issueCount] = await db.select({ count: sql`count(*)` }).from(issues);
      const [userCount] = await db.select({ count: sql`count(*)` }).from(users);
      const [syncPending] = await db.select({ count: sql`count(*)` }).from(syncQueue).where(sql`status = 'pending'`);
      
      const [openIssues] = await db.select({ count: sql`count(*)` }).from(issues).where(sql`status = 'open'`);
      const [closedIssues] = await db.select({ count: sql`count(*)` }).from(issues).where(sql`status = 'closed'`);
      
      return {
        totalIssues: Number(issueCount.count) || 0,
        totalUsers: Number(userCount.count) || 0,
        pendingSync: Number(syncPending.count) || 0,
        openIssues: Number(openIssues.count) || 0,
        closedIssues: Number(closedIssues.count) || 0
      };
    },
    refetchInterval: 30000 // Atualizar a cada 30s
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard - Todo RAG System</h1>
      
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total de Tarefas</h3>
          <p className="text-3xl font-bold text-gray-900">{stats?.totalIssues || 0}</p>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-600 mr-2">{stats?.openIssues || 0} abertas</span>
            <span className="text-gray-500">{stats?.closedIssues || 0} fechadas</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Usuários</h3>
          <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
          <p className="mt-2 text-sm text-gray-500">Ativos no sistema</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Sincronização</h3>
          <p className="text-3xl font-bold text-gray-900">{stats?.pendingSync || 0}</p>
          <p className="mt-2 text-sm text-gray-500">Itens pendentes</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Status</h3>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${navigator.onLine ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <p className="text-lg font-semibold">{navigator.onLine ? 'Online' : 'Offline'}</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {navigator.onLine ? 'Conectado' : 'Modo local ativo'}
          </p>
        </div>
      </div>

      {/* Links Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/issues/new" className="bg-blue-500 text-white rounded-lg shadow p-6 hover:bg-blue-600 transition">
          <h3 className="text-lg font-semibold mb-2">Nova Tarefa</h3>
          <p className="text-sm opacity-90">Criar uma nova tarefa no sistema</p>
        </Link>

        <Link to="/backup" className="bg-green-500 text-white rounded-lg shadow p-6 hover:bg-green-600 transition">
          <h3 className="text-lg font-semibold mb-2">Backup</h3>
          <p className="text-sm opacity-90">Gerenciar backups do sistema</p>
        </Link>

        <Link to="/settings" className="bg-gray-600 text-white rounded-lg shadow p-6 hover:bg-gray-700 transition">
          <h3 className="text-lg font-semibold mb-2">Configurações</h3>
          <p className="text-sm opacity-90">Ajustar preferências do sistema</p>
        </Link>
      </div>

      {/* Informações do Sistema */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Sistema RAG Offline-First</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 mb-1">Capacidades:</p>
            <ul className="list-disc list-inside text-gray-700">
              <li>Busca semântica local com pgvector</li>
              <li>Knowledge base 100% offline</li>
              <li>Sincronização automática quando online</li>
              <li>Backup incremental automático</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Performance:</p>
            <ul className="list-disc list-inside text-gray-700">
              <li>Busca semântica &lt;50ms</li>
              <li>Sem limites de rate/quota</li>
              <li>Funciona em modo avião</li>
              <li>Cache inteligente multi-camadas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};