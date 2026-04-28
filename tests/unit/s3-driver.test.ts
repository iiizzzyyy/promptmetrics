import { S3Driver } from '@drivers/promptmetrics-s3-driver';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);

describe('S3Driver', () => {
  let driver: S3Driver;

  beforeEach(() => {
    s3Mock.reset();
    driver = new S3Driver({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      prefix: 'prompts/',
    });
  });

  afterEach(() => {
    s3Mock.restore();
  });

  it('should list prompts', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [{ Prefix: 'prompts/hello/' }, { Prefix: 'prompts/world/' }],
    });

    const result = await driver.listPrompts();
    expect(result.items).toEqual(['hello', 'world']);
    expect(result.total).toBe(2);
  });

  it('should get a prompt by version', async () => {
    const mockBody = {
      transformToString: async () => JSON.stringify({ name: 'hello', version: '1.0.0', messages: [] }),
    };

    s3Mock.on(GetObjectCommand).resolves({ Body: mockBody as unknown as any });
    s3Mock.on(HeadObjectCommand).resolves({ LastModified: new Date('2024-01-01') });

    const result = await driver.getPrompt('hello', '1.0.0');
    expect(result).toBeDefined();
    expect(result?.content.name).toBe('hello');
    expect(result?.version.version_tag).toBe('1.0.0');
  });

  it('should create a prompt', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const result = await driver.createPrompt({
      name: 'hello',
      version: '1.0.0',
      messages: [{ role: 'system', content: 'hi' }],
    });
    expect(result.name).toBe('hello');
    expect(result.version_tag).toBe('1.0.0');
  });

  it('should list versions', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: 'prompts/hello/1.0.0.json', LastModified: new Date('2024-01-01') },
        { Key: 'prompts/hello/2.0.0.json', LastModified: new Date('2024-02-01') },
      ],
    });

    const result = await driver.listVersions('hello');
    expect(result.items.length).toBe(2);
    expect(result.items[0].version_tag).toBe('1.0.0');
    expect(result.items[1].version_tag).toBe('2.0.0');
  });

  it('should search prompts', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [{ Prefix: 'prompts/hello/' }, { Prefix: 'prompts/world/' }],
    });

    const result = await driver.search('hel');
    expect(result).toEqual(['hello']);
  });

  describe('path traversal protection', () => {
    it('should reject createPrompt with malicious name containing ..', async () => {
      await expect(
        driver.createPrompt({
          name: '../../../etc/passwd',
          version: '1.0.0',
          messages: [{ role: 'user', content: 'x' }],
        }),
      ).rejects.toThrow('Invalid prompt name: path traversal detected');

      // Ensure no S3 call was made
      expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(0);
    });

    it('should reject createPrompt with malicious name containing /', async () => {
      await expect(
        driver.createPrompt({
          name: 'foo/../../../bar',
          version: '1.0.0',
          messages: [{ role: 'user', content: 'x' }],
        }),
      ).rejects.toThrow('Invalid prompt name: path traversal detected');

      expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(0);
    });

    it('should reject getPrompt with malicious name', async () => {
      await expect(driver.getPrompt('../../../etc/passwd', '1.0.0')).rejects.toThrow(
        'Invalid prompt name: path traversal detected',
      );
      expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    });

    it('should reject listVersions with malicious name', async () => {
      await expect(driver.listVersions('foo\\bar')).rejects.toThrow('Invalid prompt name: path traversal detected');
      expect(s3Mock.commandCalls(ListObjectsV2Command).length).toBe(0);
    });
  });
});
