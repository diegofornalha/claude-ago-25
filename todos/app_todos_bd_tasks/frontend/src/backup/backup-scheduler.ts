import { BackupManager } from './backup-manager';

export interface BackupSchedule {
  type: 'full' | 'incremental';
  interval: number; // em ms
  time?: string; // HH:MM para backups diários
  dayOfWeek?: number; // 0-6 para backups semanais
  enabled: boolean;
}

export class BackupScheduler {
  private schedules: Map<string, BackupSchedule> = new Map();
  private timers: Map<string, number> = new Map();
  
  constructor(private backupManager: BackupManager) {
    // Configurações padrão
    this.addSchedule('hourly-incremental', {
      type: 'incremental',
      interval: 3600000, // 1 hora
      enabled: true
    });
    
    this.addSchedule('daily-full', {
      type: 'full',
      interval: 86400000, // 24 horas
      time: '03:00', // 3 AM
      enabled: true
    });
    
    this.addSchedule('weekly-full', {
      type: 'full',
      interval: 604800000, // 7 dias
      dayOfWeek: 0, // Domingo
      time: '02:00',
      enabled: false
    });
  }

  addSchedule(id: string, schedule: BackupSchedule): void {
    this.schedules.set(id, schedule);
    
    if (schedule.enabled) {
      this.startSchedule(id);
    }
  }

  removeSchedule(id: string): void {
    this.stopSchedule(id);
    this.schedules.delete(id);
  }

  enableSchedule(id: string): void {
    const schedule = this.schedules.get(id);
    if (schedule) {
      schedule.enabled = true;
      this.startSchedule(id);
    }
  }

  disableSchedule(id: string): void {
    const schedule = this.schedules.get(id);
    if (schedule) {
      schedule.enabled = false;
      this.stopSchedule(id);
    }
  }

  private startSchedule(id: string): void {
    const schedule = this.schedules.get(id);
    if (!schedule || !schedule.enabled) return;

    // Parar timer existente
    this.stopSchedule(id);

    // Calcular próxima execução
    const nextRun = this.calculateNextRun(schedule);
    const delay = nextRun - Date.now();

    // Agendar execução
    const timerId = window.setTimeout(() => {
      this.executeBackup(id, schedule);
      
      // Re-agendar se ainda estiver habilitado
      if (schedule.enabled) {
        this.startSchedule(id);
      }
    }, delay);

    this.timers.set(id, timerId);
  }

  private stopSchedule(id: string): void {
    const timerId = this.timers.get(id);
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(id);
    }
  }

  private calculateNextRun(schedule: BackupSchedule): number {
    const now = new Date();
    
    if (schedule.time) {
      // Backup com horário específico
      const [hours, minutes] = schedule.time.split(':').map(Number);
      const scheduledTime = new Date(now);
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // Se já passou hoje, agendar para amanhã
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      // Se for semanal, ajustar para o dia correto
      if (schedule.dayOfWeek !== undefined) {
        const daysUntilTarget = (schedule.dayOfWeek - scheduledTime.getDay() + 7) % 7 || 7;
        scheduledTime.setDate(scheduledTime.getDate() + daysUntilTarget);
      }
      
      return scheduledTime.getTime();
    } else {
      // Backup com intervalo simples
      return now.getTime() + schedule.interval;
    }
  }

  private async executeBackup(id: string, schedule: BackupSchedule): Promise<void> {
    try {
      console.log(`Executing scheduled backup: ${id}`);
      await this.backupManager.performBackup(schedule.type);
      
      // Notificar sucesso
      this.notifyBackupComplete(id, true);
    } catch (error) {
      console.error(`Scheduled backup failed: ${id}`, error);
      
      // Notificar falha
      this.notifyBackupComplete(id, false, error);
    }
  }

  private notifyBackupComplete(id: string, success: boolean, error?: any): void {
    // Enviar evento personalizado
    const event = new CustomEvent('backup-complete', {
      detail: {
        scheduleId: id,
        success,
        error: error?.message,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }

  getSchedules(): Map<string, BackupSchedule> {
    return new Map(this.schedules);
  }

  getNextRunTimes(): Map<string, number> {
    const nextRuns = new Map<string, number>();
    
    this.schedules.forEach((schedule, id) => {
      if (schedule.enabled) {
        nextRuns.set(id, this.calculateNextRun(schedule));
      }
    });
    
    return nextRuns;
  }

  destroy(): void {
    // Parar todos os timers
    this.timers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    
    this.timers.clear();
    this.schedules.clear();
  }
}

// Hook para usar o scheduler
export function useBackupScheduler(backupManager: BackupManager) {
  const [scheduler] = useState(() => new BackupScheduler(backupManager));
  const [schedules, setSchedules] = useState<Map<string, BackupSchedule>>(new Map());
  const [nextRuns, setNextRuns] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const updateSchedules = () => {
      setSchedules(scheduler.getSchedules());
      setNextRuns(scheduler.getNextRunTimes());
    };

    updateSchedules();
    
    // Atualizar a cada minuto
    const interval = setInterval(updateSchedules, 60000);

    // Ouvir eventos de backup
    const handleBackupComplete = (event: CustomEvent) => {
      console.log('Backup completed:', event.detail);
      updateSchedules();
    };

    window.addEventListener('backup-complete', handleBackupComplete as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('backup-complete', handleBackupComplete as EventListener);
      scheduler.destroy();
    };
  }, [scheduler]);

  return {
    schedules,
    nextRuns,
    addSchedule: (id: string, schedule: BackupSchedule) => {
      scheduler.addSchedule(id, schedule);
      setSchedules(scheduler.getSchedules());
    },
    removeSchedule: (id: string) => {
      scheduler.removeSchedule(id);
      setSchedules(scheduler.getSchedules());
    },
    enableSchedule: (id: string) => {
      scheduler.enableSchedule(id);
      setSchedules(scheduler.getSchedules());
    },
    disableSchedule: (id: string) => {
      scheduler.disableSchedule(id);
      setSchedules(scheduler.getSchedules());
    }
  };
}