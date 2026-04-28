import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { simpleGit } from 'simple-git';
import CircuitBreaker from 'opossum';
import { PromptDriver, PromptFile, PromptVersion } from './promptmetrics-driver.interface';
import { config } from '@config/index';
import { getDb, withTransaction } from '@models/promptmetrics-sqlite';
import { createCircuitBreaker } from '@services/circuit-breaker.service';
import { parseCountRow } from '@utils/pagination';

export class GithubDriver implements PromptDriver {
  private readonly clonePath: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly apiBase = 'https://api.github.com';
  private readonly createContentBreaker: CircuitBreaker;

  constructor() {
    if (!config.githubRepo || !config.githubToken) {
      throw new Error('GITHUB_REPO and GITHUB_TOKEN are required for github driver');
    }
    this.repo = config.githubRepo;
    this.token = config.githubToken;
    this.clonePath = path.resolve('./data/github-clone');
    this.createContentBreaker = createCircuitBreaker(this.createGithubContent.bind(this), {
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 5,
    });
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async ensureCloned(): Promise<void> {
    if (!fs.existsSync(this.clonePath)) {
      fs.mkdirSync(path.dirname(this.clonePath), { recursive: true });
      const askPassScript = path.join(path.dirname(this.clonePath), `.git-askpass-${Date.now()}`);
      fs.writeFileSync(askPassScript, `#!/bin/sh\necho "${this.token}"\n`, { mode: 0o700 });
      try {
        const git = simpleGit();
        await git
          .env({
            GIT_ASKPASS: askPassScript,
            GIT_USERNAME: 'x-access-token',
          })
          .clone(`https://github.com/${this.repo}.git`, this.clonePath);
      } finally {
        if (fs.existsSync(askPassScript)) {
          fs.unlinkSync(askPassScript);
        }
      }
    }
  }

  async sync(): Promise<void> {
    await this.ensureCloned();
    const git = simpleGit(this.clonePath);
    await git.pull();
  }

  async listPrompts(page: number = 1, limit: number = 50): Promise<{ items: string[]; total: number }> {
    await this.ensureCloned();
    const promptsDir = path.join(this.clonePath, 'prompts');
    if (!fs.existsSync(promptsDir)) return { items: [], total: 0 };

    const entries = fs.readdirSync(promptsDir, { withFileTypes: true });
    const promptNames = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const total = promptNames.length;
    const start = (page - 1) * limit;
    return { items: promptNames.slice(start, start + limit), total };
  }

  private validateName(name: string): void {
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error('Invalid prompt name: path traversal detected');
    }
    const resolved = path.resolve(this.clonePath, 'prompts', name);
    const promptsDir = path.resolve(this.clonePath, 'prompts');
    if (!resolved.startsWith(promptsDir + path.sep)) {
      throw new Error('Invalid prompt name: path traversal detected');
    }
  }

  private semverCompare(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  async getPrompt(
    name: string,
    version?: string,
  ): Promise<{ content: PromptFile; version: PromptVersion } | undefined> {
    this.validateName(name);
    await this.ensureCloned();

    const promptDir = path.join(this.clonePath, 'prompts', name);
    if (!fs.existsSync(promptDir)) return undefined;

    let targetVersion = version;
    if (!targetVersion) {
      const files = fs.readdirSync(promptDir).filter((f) => f.endsWith('.json'));
      if (files.length === 0) return undefined;
      const versions = files.map((f) => f.replace('.json', ''));
      versions.sort((a, b) => this.semverCompare(a, b));
      targetVersion = versions[versions.length - 1];
    }

    const filePath = path.join(promptDir, `${targetVersion}.json`);
    if (!fs.existsSync(filePath)) return undefined;

    try {
      const output = fs.readFileSync(filePath, 'utf-8');
      const content = JSON.parse(output) as PromptFile;

      const git = simpleGit(this.clonePath);
      const sha = version
        ? (await git.raw(['rev-list', '-n', '1', `refs/tags/prompt-${name}-v${version}`])).trim()
        : (await git.revparse(['HEAD'])).trim();

      return {
        content,
        version: {
          name,
          version_tag: targetVersion,
          commit_sha: sha,
          created_at: Math.floor(Date.now() / 1000),
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return undefined;
      }
      console.error(`GithubDriver.getPrompt failed for ${name}:`, err);
      return undefined;
    }
  }

  private async createGithubContent(
    filePath: string,
    encodedContent: string,
    existingSha: string | undefined,
    tagName: string,
  ): Promise<string> {
    const url = `${this.apiBase}/repos/${this.repo}/contents/${filePath}`;

    // Exponential backoff retry
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.put(
          url,
          {
            message: `Create/Update prompt: ${filePath}`,
            content: encodedContent,
            ...(existingSha ? { sha: existingSha } : {}),
          },
          { headers: this.getAuthHeaders() },
        );

        const blobSha = (response.data as { content: { sha: string } }).content.sha;

        // Create tag
        await axios.post(
          `${this.apiBase}/repos/${this.repo}/git/refs`,
          {
            ref: `refs/tags/${tagName}`,
            sha: (await this.getLatestSha()) || 'HEAD',
          },
          { headers: this.getAuthHeaders() },
        );

        return blobSha;
      } catch (err) {
        lastError = err as Error;
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 429) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Failed to create GitHub content after retries');
  }

  async createPrompt(prompt: PromptFile): Promise<PromptVersion> {
    const filePath = `prompts/${prompt.name}/${prompt.version}.json`;
    const content = JSON.stringify(prompt, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');
    const tagName = `prompt-${prompt.name}-v${prompt.version}`;

    const url = `${this.apiBase}/repos/${this.repo}/contents/${filePath}`;

    // Check if file already exists to get SHA for update
    let existingSha: string | undefined;
    try {
      const { data } = await axios.get(url, { headers: this.getAuthHeaders() });
      existingSha = (data as { sha: string }).sha;
    } catch {
      // File doesn't exist, which is fine for create
    }

    // Use circuit breaker for GitHub content creation
    const blobSha = (await this.createContentBreaker.fire(filePath, encodedContent, existingSha, tagName)) as string;

    const version: PromptVersion = {
      name: prompt.name,
      version_tag: prompt.version,
      commit_sha: (await this.getLatestSha()) || undefined,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Update SQLite index inside a transaction
    try {
      await withTransaction(async (db) => {
        await db
          .prepare(
            `INSERT INTO prompts (name, version_tag, commit_sha, driver, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(name, version_tag) DO UPDATE SET
            commit_sha = excluded.commit_sha,
            driver = excluded.driver,
            created_at = excluded.created_at`,
          )
          .run(prompt.name, prompt.version, version.commit_sha, 'github', version.created_at);
      });
    } catch (dbError) {
      // Attempt to revert GitHub changes on DB failure
      try {
        await axios.request({
          method: 'DELETE',
          url: `${this.apiBase}/repos/${this.repo}/contents/${filePath}`,
          headers: this.getAuthHeaders(),
          data: {
            message: `Revert prompt: ${prompt.name} v${prompt.version}`,
            sha: blobSha,
          },
        });
      } catch {
        // Best-effort revert; original error is what matters
      }
      throw dbError;
    }

    return version;
  }

  async listVersions(
    name: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ items: PromptVersion[]; total: number }> {
    const db = getDb();
    const rows = (await db
      .prepare('SELECT * FROM prompts WHERE name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(name, limit, (page - 1) * limit)) as PromptVersion[];

    const total = parseCountRow(await db.prepare('SELECT COUNT(*) as count FROM prompts WHERE name = ?').get(name));

    return { items: rows, total };
  }

  async search(query: string): Promise<string[]> {
    const all = await this.listPrompts(1, Number.MAX_SAFE_INTEGER);
    return all.items.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  }

  private async getLatestSha(): Promise<string | null> {
    try {
      const { data } = await axios.get(`${this.apiBase}/repos/${this.repo}/git/refs/heads/main`, {
        headers: this.getAuthHeaders(),
      });
      return (data as { object: { sha: string } }).object.sha;
    } catch {
      return null;
    }
  }
}
