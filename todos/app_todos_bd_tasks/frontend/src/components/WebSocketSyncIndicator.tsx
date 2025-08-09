import { useState } from 'react';
import { useWebSocketSync } from '@/hooks/useWebSocketSync';
import { Wifi, WifiOff, RefreshCw, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function WebSocketSyncIndicator() {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('websocket-sync-enabled') !== 'false';
  });

  const {
    isConnected,
    lastSync,
    syncCount,
    error,
    requestSync,
    disconnect,
    reconnect
  } = useWebSocketSync({
    enabled: isEnabled,
    onSync: () => {
      console.log('📥 Sincronização via WebSocket concluída');
    },
    onError: (err) => {
      console.error('❌ Erro no WebSocket:', err);
    }
  });

  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
    localStorage.setItem('websocket-sync-enabled', String(checked));
    
    if (!checked) {
      disconnect();
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 10) return 'Agora mesmo';
    if (seconds < 60) return `Há ${seconds} segundos`;
    if (minutes === 1) return 'Há 1 minuto';
    if (minutes < 60) return `Há ${minutes} minutos`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Há 1 hora';
    return `Há ${hours} horas`;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Indicador de Conexão */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <Badge variant="outline" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Tempo Real
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <p>WebSocket conectado</p>
                    <p>Última sync: {formatLastSync()}</p>
                    <p>Total de syncs: {syncCount}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          ) : isEnabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse" />
                  <span className="text-xs text-yellow-500">Reconectando...</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Tentando conectar ao servidor WebSocket</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Desativado</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Sincronização em tempo real desativada</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Botão de Sync Manual */}
        {isConnected && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={requestSync}
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Forçar sincronização agora</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Menu de Configurações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              Sincronização em Tempo Real
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Toggle WebSocket */}
            <div className="flex items-center justify-between p-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">WebSocket Sync</p>
                <p className="text-xs text-muted-foreground">
                  Detecta mudanças instantaneamente
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
              />
            </div>
            
            <DropdownMenuSeparator />
            
            {/* Status */}
            <div className="p-2 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={isConnected ? 'text-green-500' : 'text-yellow-500'}>
                  {isConnected ? 'Conectado' : isEnabled ? 'Conectando...' : 'Desativado'}
                </span>
              </div>
              
              {lastSync && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última sync:</span>
                  <span>{formatLastSync()}</span>
                </div>
              )}
              
              {syncCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de syncs:</span>
                  <span>{syncCount}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Servidor:</span>
                <span className="font-mono">ws://localhost:8766</span>
              </div>
            </div>
            
            {error && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <p className="text-xs text-red-500">
                    Erro: {error.message}
                  </p>
                </div>
              </>
            )}
            
            {/* Ações */}
            {!isConnected && isEnabled && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={reconnect}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Reconectar
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            
            {/* Informações */}
            <div className="p-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Como funciona:</p>
              <p>• Monitora ~/.claude/mcp-rag-cache em tempo real</p>
              <p>• Sincroniza automaticamente quando detecta mudanças</p>
              <p>• Usa WebSocket para comunicação instantânea</p>
              <p>• Fallback para polling se WebSocket falhar</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}