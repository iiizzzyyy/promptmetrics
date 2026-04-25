import { PromptDriver } from './promptmetrics-driver.interface';
import { FilesystemDriver } from './promptmetrics-filesystem-driver';
import { GithubDriver } from './promptmetrics-github-driver';
import { S3Driver } from './promptmetrics-s3-driver';
import { config } from '@config/index';

export function createDriver(): PromptDriver {
  switch (config.driver) {
    case 'filesystem':
      return new FilesystemDriver();
    case 'github':
      return new GithubDriver();
    case 's3':
      return new S3Driver();
    default:
      throw new Error(`Unknown driver: ${config.driver}`);
  }
}
