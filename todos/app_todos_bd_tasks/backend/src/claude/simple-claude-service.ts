import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface ClaudeResponse {
  success: boolean;
  sessionId?: string;
  output?: string;
  error?: string;
}

export class SimpleClaudeService {
  private claudePath = '/opt/homebrew/bin/claude';
  private todosDir = '/Users/agents/.claude/todos';

  async createMissionTasks(missionId: string, prompt: string): Promise<ClaudeResponse> {
    return new Promise((resolve) => {
      const args = ['-p'];
      const claude = spawn(this.claudePath, args);
      
      let output = '';
      let error = '';

      // Enviar o prompt via stdin
      claude.stdin.write(prompt);
      claude.stdin.end();

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', async (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: error || `Process exited with code ${code}`
          });
          return;
        }

        // Extrair sessionId da saída se houver
        const sessionMatch = output.match(/Conversation:\s+(\S+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : missionId;

        // Verificar se o arquivo de todos foi criado
        const todosPath = path.join(this.todosDir, `${sessionId}.json`);
        try {
          await fs.access(todosPath);
          resolve({
            success: true,
            sessionId,
            output: output.trim()
          });
        } catch {
          // Se não foi criado, criar um arquivo de todos vazio
          await fs.writeFile(todosPath, JSON.stringify([
            {
              id: "1",
              content: "Analisar missão e definir escopo",
              status: "pending",
              priority: "high"
            },
            {
              id: "2",
              content: "Implementar solução proposta",
              status: "pending",
              priority: "high"
            },
            {
              id: "3",
              content: "Testar implementação",
              status: "pending",
              priority: "medium"
            }
          ], null, 2));

          resolve({
            success: true,
            sessionId,
            output: "Tarefas básicas criadas"
          });
        }
      });

      // Timeout de segurança
      setTimeout(() => {
        claude.kill();
        resolve({
          success: false,
          error: 'Timeout após 30 segundos'
        });
      }, 30000);
    });
  }
}

export const simpleClaudeService = new SimpleClaudeService();