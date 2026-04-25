import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PromptDriver, PromptFile, PromptVersion } from './promptmetrics-driver.interface';
import { withTransaction } from '@models/promptmetrics-sqlite';

export interface S3DriverConfig {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix?: string;
  endpoint?: string;
}

export class S3Driver implements PromptDriver {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(config?: S3DriverConfig) {
    const bucket = config?.bucket || process.env.S3_BUCKET || '';
    const region = config?.region || process.env.S3_REGION || 'us-east-1';
    const accessKeyId = config?.accessKeyId || process.env.S3_ACCESS_KEY || '';
    const secretAccessKey = config?.secretAccessKey || process.env.S3_SECRET_KEY || '';
    const endpoint = config?.endpoint || process.env.S3_ENDPOINT || undefined;
    this.bucket = bucket;
    this.prefix = config?.prefix || process.env.S3_PREFIX || 'prompts/';
    if (!this.prefix.endsWith('/')) this.prefix += '/';

    this.client = new S3Client({
      region,
      endpoint,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      forcePathStyle: !!endpoint,
    });
  }

  private key(name: string, version?: string): string {
    return version
      ? `${this.prefix}${name}/${version}.json`
      : `${this.prefix}${name}/`;
  }

  async listPrompts(page: number = 1, limit: number = 50): Promise<{ items: string[]; total: number }> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.prefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });
    const response = await this.client.send(command);
    const prefixes = response.CommonPrefixes || [];
    const names = prefixes
      .map((p) => p.Prefix?.replace(this.prefix, '').replace('/', '') || '')
      .filter(Boolean)
      .sort();
    const total = names.length;
    const start = (page - 1) * limit;
    return { items: names.slice(start, start + limit), total };
  }

  async getPrompt(
    name: string,
    version?: string,
  ): Promise<{ content: PromptFile; version: PromptVersion } | undefined> {
    let versionTag = version;
    if (!versionTag) {
      const versions = await this.listVersions(name, 1, 1);
      if (versions.items.length === 0) return undefined;
      versionTag = versions.items[0].version_tag;
    }

    const key = this.key(name, versionTag);
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);
      const body = await response.Body?.transformToString();
      if (!body) return undefined;
      const content = JSON.parse(body) as PromptFile;

      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      const promptVersion: PromptVersion = {
        name,
        version_tag: versionTag,
        created_at: Math.floor((head.LastModified?.getTime() || Date.now()) / 1000),
      };
      return { content, version: promptVersion };
    } catch {
      return undefined;
    }
  }

  async createPrompt(prompt: PromptFile): Promise<PromptVersion> {
    const key = this.key(prompt.name, prompt.version);
    const body = JSON.stringify(prompt, null, 2);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: 'application/json' }),
    );

    const version: PromptVersion = {
      name: prompt.name,
      version_tag: prompt.version,
      created_at: Math.floor(Date.now() / 1000),
    };

    await withTransaction(async (db) => {
      await db.prepare(
        'INSERT OR REPLACE INTO prompts (name, version_tag, driver, created_at) VALUES (?, ?, ?, ?)',
      ).run(prompt.name, prompt.version, 's3', version.created_at);
    });

    return version;
  }

  async listVersions(
    name: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ items: PromptVersion[]; total: number }> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.key(name),
      MaxKeys: 1000,
    });
    const response = await this.client.send(command);
    const contents = response.Contents || [];
    const items: PromptVersion[] = contents
      .filter((c) => c.Key?.endsWith('.json'))
      .map((c) => ({
        name,
        version_tag: c.Key?.split('/').pop()?.replace('.json', '') || '',
        created_at: Math.floor((c.LastModified?.getTime() || Date.now()) / 1000),
      }))
      .filter((v) => v.version_tag)
      .sort((a, b) => a.version_tag.localeCompare(b.version_tag));

    const total = items.length;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total };
  }

  async sync(): Promise<void> {
    // No-op for S3 driver (content is already in S3)
    return;
  }

  async search(query: string): Promise<string[]> {
    const all = await this.listPrompts(1, Number.MAX_SAFE_INTEGER);
    return all.items.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  }
}
