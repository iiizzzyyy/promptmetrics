import fs from 'fs';
import path from 'path';
import { PromptDriver, PromptFile, PromptVersion } from './promptmetrics-driver.interface';
import { withTransaction } from '@models/promptmetrics-sqlite';

export class FilesystemDriver implements PromptDriver {
  private readonly basePath: string;

  constructor(basePath: string = './prompts') {
    this.basePath = path.resolve(basePath);
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async listPrompts(page: number = 1, limit: number = 50): Promise<{ items: string[]; total: number }> {
    if (!fs.existsSync(this.basePath)) return { items: [], total: 0 };

    const entries = fs.readdirSync(this.basePath, { withFileTypes: true });
    const promptNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const total = promptNames.length;
    const start = (page - 1) * limit;
    const paginated = promptNames.slice(start, start + limit);

    return { items: paginated, total };
  }

  async getPrompt(name: string, version?: string): Promise<{ content: PromptFile; version: PromptVersion } | undefined> {
    const promptDir = path.join(this.basePath, name);
    if (!fs.existsSync(promptDir)) return undefined;

    let filePath: string;
    let versionTag: string;

    if (version) {
      filePath = path.join(promptDir, `${version}.json`);
      versionTag = version;
    } else {
      const versions = this.getVersionFiles(name);
      if (versions.length === 0) return undefined;
      versions.sort();
      filePath = path.join(promptDir, versions[versions.length - 1]);
      versionTag = path.basename(versions[versions.length - 1], '.json');
    }

    if (!fs.existsSync(filePath)) return undefined;

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PromptFile;
    const stats = fs.statSync(filePath);

    const promptVersion: PromptVersion = {
      name,
      version_tag: versionTag,
      fs_path: filePath,
      created_at: Math.floor(stats.mtime.getTime() / 1000),
    };

    return { content, version: promptVersion };
  }

  async createPrompt(prompt: PromptFile): Promise<PromptVersion> {
    const promptDir = path.join(this.basePath, prompt.name);
    if (!fs.existsSync(promptDir)) {
      fs.mkdirSync(promptDir, { recursive: true });
    }

    const filePath = path.join(promptDir, `${prompt.version}.json`);
    fs.writeFileSync(filePath, JSON.stringify(prompt, null, 2), 'utf-8');

    const stats = fs.statSync(filePath);
    const version: PromptVersion = {
      name: prompt.name,
      version_tag: prompt.version,
      fs_path: filePath,
      created_at: Math.floor(stats.mtime.getTime() / 1000),
    };

    withTransaction((db) => {
      db.prepare(
        'INSERT OR REPLACE INTO prompts (name, version_tag, fs_path, driver, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(prompt.name, prompt.version, filePath, 'filesystem', version.created_at);
    });

    return version;
  }

  async listVersions(name: string, page: number = 1, limit: number = 50): Promise<{ items: PromptVersion[]; total: number }> {
    const versions = this.getVersionFiles(name);
    const total = versions.length;

    const start = (page - 1) * limit;
    const paginated = versions.slice(start, start + limit);

    const items: PromptVersion[] = paginated.map((file) => {
      const filePath = path.join(this.basePath, name, file);
      const stats = fs.statSync(filePath);
      return {
        name,
        version_tag: path.basename(file, '.json'),
        fs_path: filePath,
        created_at: Math.floor(stats.mtime.getTime() / 1000),
      };
    });

    return { items, total };
  }

  async sync(): Promise<void> {
    // No-op for filesystem driver
    return;
  }

  async search(query: string): Promise<string[]> {
    const allPrompts = await this.listPrompts(1, Number.MAX_SAFE_INTEGER);
    return allPrompts.items.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  }

  private getVersionFiles(name: string): string[] {
    const promptDir = path.join(this.basePath, name);
    if (!fs.existsSync(promptDir)) return [];

    return fs
      .readdirSync(promptDir)
      .filter((file) => file.endsWith('.json'))
      .sort();
  }
}
