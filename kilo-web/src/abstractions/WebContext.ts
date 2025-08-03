/**
 * Web-compatible abstraction layer for VS Code ExtensionContext
 * Provides file-based storage and configuration management
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface WebSecrets {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface WebGlobalState {
  get<T>(key: string): T | undefined;
  update(key: string, value: any): Promise<void>;
  keys(): readonly string[];
}

export interface WebWorkspaceState {
  get<T>(key: string): T | undefined;
  update(key: string, value: any): Promise<void>;
  keys(): readonly string[];
}

export class WebContext {
  private secretsPath: string;
  private globalStatePath: string;
  private workspaceStatePath: string;
  private _secrets: Map<string, string> = new Map();
  private _globalState: Map<string, any> = new Map();
  private _workspaceState: Map<string, any> = new Map();

  constructor(private _storagePath: string, private workspacePath?: string) {
    this.secretsPath = path.join(this._storagePath, 'secrets.json');
    this.globalStatePath = path.join(this._storagePath, 'globalState.json');
    this.workspaceStatePath = workspacePath
      ? path.join(workspacePath, '.kilo-web', 'workspaceState.json')
      : path.join(this._storagePath, 'workspaceState.json');
  }

  async initialize(): Promise<void> {
    // Ensure storage directories exist
    await fs.mkdir(this._storagePath, { recursive: true });
    if (this.workspacePath) {
      await fs.mkdir(path.join(this.workspacePath, '.kilo-web'), { recursive: true });
    }

    // Load existing data
    await this.loadSecrets();
    await this.loadGlobalState();
    await this.loadWorkspaceState();
  }

  private async loadSecrets(): Promise<void> {
    try {
      const data = await fs.readFile(this.secretsPath, 'utf-8');
      const secrets = JSON.parse(data);
      this._secrets = new Map(Object.entries(secrets));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty secrets
      this._secrets = new Map();
    }
  }

  private async saveSecrets(): Promise<void> {
    const secrets = Object.fromEntries(this._secrets);
    await fs.writeFile(this.secretsPath, JSON.stringify(secrets, null, 2));
  }

  private async loadGlobalState(): Promise<void> {
    try {
      const data = await fs.readFile(this.globalStatePath, 'utf-8');
      const state = JSON.parse(data);
      this._globalState = new Map(Object.entries(state));
    } catch (error) {
      this._globalState = new Map();
    }
  }

  private async saveGlobalState(): Promise<void> {
    const state = Object.fromEntries(this._globalState);
    await fs.writeFile(this.globalStatePath, JSON.stringify(state, null, 2));
  }

  private async loadWorkspaceState(): Promise<void> {
    try {
      const data = await fs.readFile(this.workspaceStatePath, 'utf-8');
      const state = JSON.parse(data);
      this._workspaceState = new Map(Object.entries(state));
    } catch (error) {
      this._workspaceState = new Map();
    }
  }

  private async saveWorkspaceState(): Promise<void> {
    const state = Object.fromEntries(this._workspaceState);
    await fs.writeFile(this.workspaceStatePath, JSON.stringify(state, null, 2));
  }

  get secrets(): WebSecrets {
    return {
      get: async (key: string) => this._secrets.get(key),
      store: async (key: string, value: string) => {
        this._secrets.set(key, value);
        await this.saveSecrets();
      },
      delete: async (key: string) => {
        this._secrets.delete(key);
        await this.saveSecrets();
      }
    };
  }

  get globalState(): WebGlobalState {
    return {
      get: <T>(key: string) => this._globalState.get(key) as T,
      update: async (key: string, value: any) => {
        this._globalState.set(key, value);
        await this.saveGlobalState();
      },
      keys: () => Array.from(this._globalState.keys())
    };
  }

  get workspaceState(): WebWorkspaceState {
    return {
      get: <T>(key: string) => this._workspaceState.get(key) as T,
      update: async (key: string, value: any) => {
        this._workspaceState.set(key, value);
        await this.saveWorkspaceState();
      },
      keys: () => Array.from(this._workspaceState.keys())
    };
  }

  // Extension-specific properties
  get extensionPath(): string {
    return path.join(__dirname, '..');
  }

  get extensionStoragePath(): string {
    return this._storagePath;
  }

  get globalStoragePath(): string {
    return this._storagePath;
  }

  get logPath(): string {
    return path.join(this._storagePath, 'logs');
  }
}