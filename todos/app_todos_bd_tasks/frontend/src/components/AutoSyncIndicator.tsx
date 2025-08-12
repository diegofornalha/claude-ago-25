import { useState, useEffect } from 'react';
import { useAutoSync } from '@/hooks/useAutoSync';
import { RefreshCw, Check, AlertCircle, Settings } from 'lucide-react';
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

export function AutoSyncIndicator() {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('auto-sync-enabled') !== 'false';
  });
  
  const [syncInterval, setSyncInterval] = useState(() => {
    return parseInt(localStorage.getItem('sync-interval') || '30000');
  });
  
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  const { syncNow } = useAutoSync({
    enabled: isEnabled,
    interval: syncInterval,
    onSync: () => {
      setLastSync(new Date());
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    },
    onError: () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  });

  const handleToggleAutoSync = (checked: boolean) => {
    setIsEnabled(checked);
    localStorage.setItem('auto-sync-enabled', String(checked));
  };

  const handleIntervalChange = (interval: number) => {
    setSyncInterval(interval);
    localStorage.setItem('sync-interval', String(interval));
    // Recarregar página para aplicar novo intervalo
    window.location.reload();
  };

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    await syncNow();
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes === 1) return 'Há 1 minuto';
    if (minutes < 60) return `Há ${minutes} `;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Há 1 hora';
    return `Há ${hours} horas`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Indicador de Status */}
      <div className="flex items-center gap-2 text-sm">
        {syncStatus === 'syncing' && (
          <>
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-blue-500">Sincronizando...</span>
          </>
        )}
        {syncStatus === 'success' && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-green-500">Sincronizado!</span>
          </>
        )}
        {syncStatus === 'error' && (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-500">Erro na sincronização</span>
          </>
        )}
        {syncStatus === 'idle' && lastSync && (
          <span className="text-muted-foreground">
            Última sync: {formatLastSync()}
          </span>
        )}
      </div>

      {/* Botão de Sync Manual */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleManualSync}
        disabled={syncStatus === 'syncing'}
        title="Sincronizar agora"
      >
        <RefreshCw className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
      </Button>

      {/* Menu de Configurações */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Configurações de Sincronização</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Toggle Auto-Sync */}
          <div className="flex items-center justify-between p-2">
            <span className="text-sm">Auto-sync</span>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleAutoSync}
            />
          </div>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Intervalo de Sincronização
          </DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => handleIntervalChange(1000)}>
            <span className={syncInterval === 1000 ? 'font-bold' : ''}>
              A cada 1 segundo ⚡
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleIntervalChange(10000)}>
            <span className={syncInterval === 10000 ? 'font-bold' : ''}>
              A cada 10 segundos
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleIntervalChange(30000)}>
            <span className={syncInterval === 30000 ? 'font-bold' : ''}>
              A cada 30 segundos
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleIntervalChange(60000)}>
            <span className={syncInterval === 60000 ? 'font-bold' : ''}>
              A cada 1 minuto
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleIntervalChange(300000)}>
            <span className={syncInterval === 300000 ? 'font-bold' : ''}>
              A cada 5 
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <div className="p-2 text-xs text-muted-foreground">
            <p>Status: {isEnabled ? 'Ativo' : 'Inativo'}</p>
            <p>Última sync: {formatLastSync()}</p>
            <p>Cache: ~/.claude/mcp-rag-cache</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}