import { PromptDriver } from './promptmetrics-driver.interface';
import { FilesystemDriver } from './promptmetrics-filesystem-driver';
import { GithubDriver } from './promptmetrics-github-driver';
import { config } from '@config/index';

export function createDriver(): PromptDriver {
  switch (config.driver) {
    case 'filesystem':
      return new FilesystemDriver();
    case 'github':
      return new GithubDriver();
    default:
      throw new Error(`Unknown driver: ${config.driver}`);
  }
}
