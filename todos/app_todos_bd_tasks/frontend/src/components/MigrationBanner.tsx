import React from 'react';
import { useMigration } from '../hooks/useMigration';
import { LocalStorageReader } from '../migration/localStorage-reader';

export function MigrationBanner() {
  const {
    isComplete,
    isRunning,
    isPaused,
    progress,
    error,
    startMigration,
    pauseMigration,
    resumeMigration,
    cancelMigration,
    retryMigration,
  } = useMigration();

  const reader = new LocalStorageReader();
  const hasData = reader.hasData();

  // Don't show banner if migration is complete or no data to migrate
  if (isComplete || !hasData) {
    return null;
  }

  // Don't show banner if migration is running (progress modal is shown instead)
  if (isRunning) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 max-w-md z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              Migração de dados disponível
            </h3>
            <div className="mt-2 text-sm text-gray-700">
              <p>
                Detectamos dados no formato antigo. Migre para o novo sistema
                para melhor performance e funcionamento offline.
              </p>
            </div>
            <div className="mt-4">
              {error ? (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error.message}</p>
                </div>
              ) : null}
              <div className="flex gap-3">
                <button
                  onClick={startMigration}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Iniciar migração
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('migration_dismissed_until', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                    window.location.reload();
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Lembrar amanhã
                </button>
              </div>
            </div>
          </div>
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={() => {
                  localStorage.setItem('migration_dismissed', 'true');
                  window.location.reload();
                }}
                className="inline-flex bg-white rounded-md p-1.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}