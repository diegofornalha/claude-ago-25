import React, { useState } from 'react';

interface InstallPromptProps {
  onClose: () => void;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ onClose }) => {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    
    if (!deferredPrompt) {
      alert('Instalação não disponível. Tente novamente mais tarde.');
      return;
    }

    setIsInstalling(true);

    try {
      // Mostrar prompt de instalação
      deferredPrompt.prompt();
      
      // Aguardar resposta do usuário
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA instalado com sucesso');
        // Limpar prompt
        (window as any).deferredPrompt = null;
        onClose();
      } else {
        console.log('Instalação cancelada pelo usuário');
      }
    } catch (error) {
      console.error('Erro ao instalar PWA:', error);
      alert('Erro ao instalar o aplicativo');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 z-50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Instalar Todo RAG</h3>
            <p className="text-sm text-gray-600">Acesso rápido e offline</p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ul className="space-y-2 mb-6 text-sm text-gray-600">
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Funciona 100% offline
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Busca semântica local (RAG)
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Sincronização automática
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Notificações em tempo real
        </li>
      </ul>

      <div className="flex gap-3">
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isInstalling ? 'Instalando...' : 'Instalar Agora'}
        </button>
        
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Mais Tarde
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Você pode instalar a qualquer momento pelo menu do navegador
      </p>
    </div>
  );
};