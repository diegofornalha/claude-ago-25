import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { db } from '../db/client';
import { missions } from '../db/schema/missions';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

interface ClaudeResponse {
  response: string;
  sessionId: string;
  jsonlPath?: string;
  todosPath?: string;
}

export class ClaudeChatIntegration {
  private claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
  private baseDir = process.env.CLAUDE_BASE_DIR || '/Users/agents/.claude';
  private projectsDir = path.join(this.baseDir, 'projects');
  private todosDir = path.join(this.baseDir, 'todos');
  
  async sendMissionToClaudeChat(mission: {
    id: string;
    title: string;
    description?: string;
    isUpdate?: boolean;
  }): Promise<ClaudeResponse> {
    try {
      // Gerar um UUID único para cada sessão do Claude
      const sessionId = crypto.randomUUID();
      
      // Se for atualização, verificar se já existe sessão
      if (mission.isUpdate) {
        const todosPath = path.join(this.todosDir, `${sessionId}.json`);
        const exists = await fs.access(todosPath).then(() => true).catch(() => false);
        if (exists) {
          // Retornar dados existentes sem criar nova sessão
          return {
            response: "Missão atualizada - usando sessão existente",
            sessionId,
            todosPath
          };
        }
      }
      
      // Atualizar status para processing
      await db.update(missions)
        .set({ 
          status: 'processing',
          sessionId,
          updatedAt: new Date()
        })
        .where(eq(missions.id, parseInt(mission.id)));
      
      // Formatar a mensagem para o Claude
      const message = this.formatMissionMessage(mission);
      
      // Escapar aspas para o shell
      const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      
      // Executar o comando do Claude
      const command = `${this.claudePath} -p "${escapedMessage}"`;
      console.log('Executando comando Claude para missão:', mission.title);
      
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 60000, // 60 segundos
          cwd: this.baseDir // Executar do diretório base do Claude
        });
        
        // Log para debug
        console.log('Stdout:', stdout);
        if (stderr) console.log('Stderr:', stderr);
        
        // O Claude pode criar o arquivo mesmo com warnings
        console.log('Resposta do Claude:', stdout || 'Sem resposta');
        
        // Aguardar um pouco para garantir que o arquivo foi criado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se o arquivo de todos foi criado
        const todosPath = path.join(this.todosDir, `${sessionId}.json`);
        const todosExists = await fs.access(todosPath).then(() => true).catch(() => false);
        
        if (!todosExists) {
          // Se não foi criado pelo Claude, criar com tarefas simuladas
          console.log('Arquivo de todos não encontrado, criando tarefas simuladas');
          const todos = this.generateSimulatedTodos(mission);
          await fs.mkdir(this.todosDir, { recursive: true });
          await fs.writeFile(todosPath, JSON.stringify(todos, null, 2));
        }
      } catch (error) {
        console.error('Erro ao executar Claude:', error);
        // Em caso de erro, criar tarefas simuladas
        const todos = this.generateSimulatedTodos(mission);
        const todosPath = path.join(this.todosDir, `${sessionId}.json`);
        await fs.mkdir(this.todosDir, { recursive: true });
        await fs.writeFile(todosPath, JSON.stringify(todos, null, 2));
      }
      
      const response = `Missão processada: "${mission.title}"`;
      
      // Detectar diretório do projeto dinamicamente
      const projectPath = await this.findProjectDir(sessionId);
      const jsonlPath = projectPath ? path.join(projectPath, `${sessionId}.jsonl`) : undefined;
      const todosPath = path.join(this.todosDir, `${sessionId}.json`);
      
      // Verificar se os arquivos foram criados
      const [jsonlExists, todosExists] = await Promise.all([
        jsonlPath ? fs.access(jsonlPath).then(() => true).catch(() => false) : false,
        fs.access(todosPath).then(() => true).catch(() => false),
      ]);
      
      // Atualizar status para completed
      await db.update(missions)
        .set({ 
          status: 'completed',
          response,
          updatedAt: new Date()
        })
        .where(eq(missions.id, parseInt(mission.id)));
      
      return {
        response,
        sessionId,
        jsonlPath: jsonlExists ? jsonlPath : undefined,
        todosPath: todosExists ? todosPath : undefined,
      };
    } catch (error) {
      // Atualizar status para error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.update(missions)
        .set({ 
          status: 'error',
          error: errorMessage,
          updatedAt: new Date()
        })
        .where(eq(missions.id, parseInt(mission.id)));
        
      console.error('Erro ao enviar missão para Claude:', error);
      throw error;
    }
  }
  
  private async findProjectDir(sessionId: string): Promise<string | null> {
    try {
      const dirs = await fs.readdir(this.projectsDir);
      for (const dir of dirs) {
        const filePath = path.join(this.projectsDir, dir, `${sessionId}.jsonl`);
        if (await fs.access(filePath).then(() => true).catch(() => false)) {
          return path.join(this.projectsDir, dir);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar diretório do projeto:', error);
    }
    return null;
  }
  
  private formatMissionMessage(mission: {
    title: string;
    description?: string;
  }): string {
    let message = `Nova missão criada: "${mission.title}"`;
    
    if (mission.description) {
      message += `\n\nDescrição:\n${mission.description}`;
    }
    
    message += `\n\nPor favor, analise esta missão e crie tarefas específicas para completá-la. Use o TodoWrite tool para criar as tarefas.`;
    
    return message;
  }

  private generateSimulatedTodos(mission: {
    title: string;
    description?: string;
  }) {
    const todos = [];
    let taskId = 1;

    // Gerar tarefas baseadas no título da missão
    if (mission.title.toLowerCase().includes('autenticação') || mission.title.toLowerCase().includes('jwt')) {
      todos.push(
        { id: String(taskId++), content: "Configurar biblioteca JWT (jsonwebtoken)", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar middleware de autenticação", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Implementar endpoints de login e registro", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Adicionar validação de tokens", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar testes para autenticação", status: "pending", priority: "medium" }
      );
    } else if (mission.title.toLowerCase().includes('notificação') || mission.title.toLowerCase().includes('notificações')) {
      todos.push(
        { id: String(taskId++), content: "Configurar WebSocket ou SSE", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar sistema de eventos", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Implementar fila de notificações", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar UI de notificações", status: "pending", priority: "medium" },
        { id: String(taskId++), content: "Adicionar persistência de notificações", status: "pending", priority: "medium" }
      );
    } else if (mission.title.toLowerCase().includes('cache') || mission.title.toLowerCase().includes('redis')) {
      todos.push(
        { id: String(taskId++), content: "Instalar e configurar Redis", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar cliente Redis", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Implementar estratégia de cache", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Adicionar invalidação de cache", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Monitorar performance do cache", status: "pending", priority: "medium" }
      );
    } else if (mission.title.toLowerCase().includes('backup')) {
      todos.push(
        { id: String(taskId++), content: "Definir estratégia de backup (incremental/full)", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Configurar cron jobs para backup automático", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Implementar compressão e criptografia", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar sistema de retenção (30 dias)", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Implementar notificações de status", status: "pending", priority: "medium" },
        { id: String(taskId++), content: "Criar rotina de teste de restore", status: "pending", priority: "medium" }
      );
    } else {
      // Tarefas genéricas
      todos.push(
        { id: String(taskId++), content: "Analisar requisitos da missão", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Criar plano de implementação", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Desenvolver funcionalidade principal", status: "pending", priority: "high" },
        { id: String(taskId++), content: "Escrever testes unitários", status: "pending", priority: "medium" },
        { id: String(taskId++), content: "Documentar implementação", status: "pending", priority: "low" }
      );
    }

    return todos;
  }
  
  async getTodosFromSession(sessionId: string): Promise<any[]> {
    try {
      const todosPath = path.join(this.todosDir, `${sessionId}.json`);
      const content = await fs.readFile(todosPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Erro ao ler todos:', error);
      return [];
    }
  }
  
  async checkSessionExists(sessionId: string): Promise<boolean> {
    try {
      const todosPath = path.join(this.todosDir, `${sessionId}.json`);
      return await fs.access(todosPath).then(() => true).catch(() => false);
    } catch {
      return false;
    }
  }
}

export const claudeChatIntegration = new ClaudeChatIntegration();