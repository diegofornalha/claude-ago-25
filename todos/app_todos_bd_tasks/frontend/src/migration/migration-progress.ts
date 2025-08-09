import type { MigrationProgress as MigrationProgressType } from '../shared/types';

export class MigrationProgress {
  private modalElement: HTMLElement | null = null;
  private startTime: number = Date.now();
  private progress: MigrationProgressType = {
    currentStep: '',
    totalRecords: 0,
    processedRecords: 0,
    percentComplete: 0,
    errors: [],
  };

  /**
   * Show the progress modal
   */
  show(): void {
    if (this.modalElement) return;
    
    this.startTime = Date.now();
    this.modalElement = this.createModal();
    document.body.appendChild(this.modalElement);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the progress modal
   */
  hide(): void {
    if (!this.modalElement) return;
    
    this.modalElement.remove();
    this.modalElement = null;
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Update progress
   */
  update(progress: Partial<MigrationProgressType>): void {
    this.progress = { ...this.progress, ...progress };
    
    if (this.modalElement) {
      this.updateUI();
    }
  }

  /**
   * Set paused state
   */
  setPaused(isPaused: boolean): void {
    if (!this.modalElement) return;
    
    const pauseBtn = this.modalElement.querySelector('[data-action="pause"]') as HTMLButtonElement;
    const resumeBtn = this.modalElement.querySelector('[data-action="resume"]') as HTMLButtonElement;
    
    if (pauseBtn && resumeBtn) {
      pauseBtn.style.display = isPaused ? 'none' : 'inline-flex';
      resumeBtn.style.display = isPaused ? 'inline-flex' : 'none';
    }
    
    // Update status text
    const statusElement = this.modalElement.querySelector('.status-indicator');
    if (statusElement) {
      statusElement.textContent = isPaused ? 'Pausado' : 'Em progresso';
      statusElement.className = `status-indicator ${isPaused ? 'paused' : 'active'}`;
    }
  }

  /**
   * Show error state
   */
  showError(message: string): void {
    if (!this.modalElement) return;
    
    const errorContainer = this.modalElement.querySelector('.error-container') as HTMLElement;
    const errorText = this.modalElement.querySelector('.error-text') as HTMLElement;
    
    if (errorContainer && errorText) {
      errorText.textContent = message;
      errorContainer.style.display = 'block';
    }
  }

  /**
   * Add an error to the list
   */
  addError(error: { record: string; error: string }): void {
    this.progress.errors.push(error);
    this.updateErrorCount();
  }

  /**
   * Get current progress
   */
  getProgress(): MigrationProgressType {
    return { ...this.progress };
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'migration-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Migrando seus dados</h2>
          <span class="status-indicator active">Em progresso</span>
        </div>
        
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%">
              <span class="progress-text">0%</span>
            </div>
          </div>
          
          <div class="progress-info">
            <p class="status-text">Preparando migração...</p>
            <p class="time-estimate">Tempo estimado: calculando...</p>
          </div>
        </div>
        
        <div class="stats-section">
          <div class="stat">
            <span class="stat-label">Registros processados:</span>
            <span class="stat-value processed-count">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">Erros:</span>
            <span class="stat-value error-count">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">Tempo decorrido:</span>
            <span class="stat-value elapsed-time">00:00</span>
          </div>
        </div>
        
        <div class="error-container" style="display: none;">
          <div class="error-header">
            <svg class="error-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <p class="error-text"></p>
          </div>
          <button class="retry-button" data-action="retry">Tentar novamente</button>
        </div>
        
        <div class="action-buttons">
          <button class="pause-button" data-action="pause">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Pausar
          </button>
          <button class="resume-button" data-action="resume" style="display: none;">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
            Continuar
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = this.getStyles();
    modal.appendChild(style);
    
    // Attach event listeners
    this.attachEventListeners(modal);
    
    return modal;
  }

  private updateUI(): void {
    if (!this.modalElement) return;
    
    // Update progress bar
    const progressFill = this.modalElement.querySelector('.progress-fill') as HTMLElement;
    const progressText = this.modalElement.querySelector('.progress-text') as HTMLElement;
    if (progressFill && progressText) {
      progressFill.style.width = `${this.progress.percentComplete}%`;
      progressText.textContent = `${Math.round(this.progress.percentComplete)}%`;
    }
    
    // Update status text
    const statusText = this.modalElement.querySelector('.status-text') as HTMLElement;
    if (statusText) {
      statusText.textContent = this.progress.currentStep;
    }
    
    // Update time estimate
    const timeEstimate = this.modalElement.querySelector('.time-estimate') as HTMLElement;
    if (timeEstimate && this.progress.estimatedTime) {
      timeEstimate.textContent = `Tempo estimado: ${this.formatTime(this.progress.estimatedTime)}`;
    }
    
    // Update processed count
    const processedCount = this.modalElement.querySelector('.processed-count') as HTMLElement;
    if (processedCount) {
      processedCount.textContent = String(this.progress.processedRecords);
    }
    
    // Update elapsed time
    this.updateElapsedTime();
  }

  private updateElapsedTime(): void {
    const elapsedElement = this.modalElement?.querySelector('.elapsed-time') as HTMLElement;
    if (elapsedElement) {
      const elapsed = this.getElapsedTime();
      elapsedElement.textContent = this.formatTime(elapsed);
    }
    
    // Schedule next update if still in progress
    if (this.modalElement && this.progress.percentComplete < 100) {
      setTimeout(() => this.updateElapsedTime(), 1000);
    }
  }

  private updateErrorCount(): void {
    const errorCount = this.modalElement?.querySelector('.error-count') as HTMLElement;
    if (errorCount) {
      errorCount.textContent = String(this.progress.errors.length);
      if (this.progress.errors.length > 0) {
        errorCount.classList.add('has-errors');
      }
    }
  }

  private attachEventListeners(modal: HTMLElement): void {
    // Pause button
    const pauseBtn = modal.querySelector('[data-action="pause"]');
    pauseBtn?.addEventListener('click', () => {
      const event = new CustomEvent('migration-pause');
      window.dispatchEvent(event);
    });
    
    // Resume button
    const resumeBtn = modal.querySelector('[data-action="resume"]');
    resumeBtn?.addEventListener('click', () => {
      const event = new CustomEvent('migration-resume');
      window.dispatchEvent(event);
    });
    
    // Retry button
    const retryBtn = modal.querySelector('[data-action="retry"]');
    retryBtn?.addEventListener('click', () => {
      const event = new CustomEvent('migration-retry');
      window.dispatchEvent(event);
    });
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getStyles(): string {
    return `
      .migration-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      
      .modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }
      
      .modal-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #1f2937;
      }
      
      .status-indicator {
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 500;
      }
      
      .status-indicator.active {
        background: #dbeafe;
        color: #1e40af;
      }
      
      .status-indicator.paused {
        background: #fef3c7;
        color: #d97706;
      }
      
      .progress-section {
        margin-bottom: 24px;
      }
      
      .progress-bar {
        height: 20px;
        background: #f3f4f6;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
        margin-bottom: 12px;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(to right, #3b82f6, #2563eb);
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
      }
      
      .progress-text {
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      
      .progress-info p {
        margin: 4px 0;
        font-size: 14px;
        color: #6b7280;
      }
      
      .stats-section {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 24px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
      }
      
      .stat {
        text-align: center;
      }
      
      .stat-label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 4px;
      }
      
      .stat-value {
        display: block;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }
      
      .stat-value.has-errors {
        color: #ef4444;
      }
      
      .error-container {
        background: #fef2f2;
        border: 1px solid #fee2e2;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 24px;
      }
      
      .error-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .error-icon {
        width: 20px;
        height: 20px;
        color: #ef4444;
      }
      
      .error-text {
        margin: 0;
        color: #991b1b;
        font-size: 14px;
      }
      
      .retry-button {
        background: #ef4444;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .retry-button:hover {
        background: #dc2626;
      }
      
      .action-buttons {
        display: flex;
        justify-content: center;
        gap: 12px;
      }
      
      .pause-button,
      .resume-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .pause-button {
        background: #f3f4f6;
        color: #4b5563;
      }
      
      .pause-button:hover {
        background: #e5e7eb;
      }
      
      .resume-button {
        background: #3b82f6;
        color: white;
      }
      
      .resume-button:hover {
        background: #2563eb;
      }
      
      .pause-button svg,
      .resume-button svg {
        width: 20px;
        height: 20px;
      }
    `;
  }
}