import type { Issue, User } from '../shared/types';

export interface DataInfo {
  users: {
    count: number;
    size: number;
  };
  issues: {
    count: number;
    size: number;
  };
  totalSize: number;
}

export class LocalStorageReader {
  /**
   * Analyze localStorage data to determine migration requirements
   */
  async analyzeData(): Promise<DataInfo> {
    const usersData = this.getRawData('users');
    const issuesData = this.getRawData('issues');

    const users = this.parseData<User[]>(usersData, []);
    const issues = this.parseData<Issue[]>(issuesData, []);

    return {
      users: {
        count: users.length,
        size: new Blob([usersData || '']).size,
      },
      issues: {
        count: issues.length,
        size: new Blob([issuesData || '']).size,
      },
      totalSize: new Blob([usersData || '', issuesData || '']).size,
    };
  }

  /**
   * Get all users from localStorage
   */
  async getUsers(): Promise<User[]> {
    const data = this.getRawData('users');
    return this.parseData<User[]>(data, []);
  }

  /**
   * Get all issues from localStorage
   */
  async getIssues(): Promise<Issue[]> {
    const data = this.getRawData('issues');
    return this.parseData<Issue[]>(data, []);
  }

  /**
   * Get a batch of users
   */
  async getUsersBatch(offset: number, limit: number): Promise<User[]> {
    const users = await this.getUsers();
    return users.slice(offset, offset + limit);
  }

  /**
   * Get a batch of issues
   */
  async getIssuesBatch(offset: number, limit: number): Promise<Issue[]> {
    const issues = await this.getIssues();
    return issues.slice(offset, offset + limit);
  }

  /**
   * Check if data exists in localStorage
   */
  hasData(): boolean {
    return !!(localStorage.getItem('users') || localStorage.getItem('issues'));
  }

  /**
   * Get all localStorage keys related to the app
   */
  getAllAppKeys(): string[] {
    const appKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isAppKey(key)) {
        appKeys.push(key);
      }
    }
    return appKeys;
  }

  /**
   * Create a backup of all app data
   */
  async createBackup(): Promise<Record<string, any>> {
    const backup: Record<string, any> = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {},
    };

    const keys = this.getAllAppKeys();
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          backup.data[key] = JSON.parse(value);
        } catch {
          backup.data[key] = value; // Store as string if not JSON
        }
      }
    }

    return backup;
  }

  /**
   * Validate data structure before migration
   */
  validateData(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const users = this.parseData<User[]>(this.getRawData('users'), []);
      const issues = this.parseData<Issue[]>(this.getRawData('issues'), []);

      // Validate users
      for (const user of users) {
        if (!user.id || !user.name) {
          errors.push(`Invalid user: missing required fields`);
        }
      }

      // Validate issues
      for (const issue of issues) {
        if (!issue.id || !issue.title) {
          errors.push(`Invalid issue: missing required fields`);
        }
        if (issue.userId && !users.find(u => u.id === issue.userId)) {
          errors.push(`Issue ${issue.id} references non-existent user ${issue.userId}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to parse data: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getRawData(key: string): string | null {
    return localStorage.getItem(key);
  }

  private parseData<T>(data: string | null, defaultValue: T): T {
    if (!data) return defaultValue;
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to parse localStorage data:`, error);
      return defaultValue;
    }
  }

  private isAppKey(key: string): boolean {
    // Define which keys belong to the app
    const appPrefixes = ['users', 'issues', 'tags', 'settings', 'migrated_'];
    return appPrefixes.some(prefix => key.startsWith(prefix));
  }
}