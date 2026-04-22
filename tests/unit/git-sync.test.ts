import { GitSyncJob } from '@jobs/promptmetrics-git-sync.job';
import { PromptDriver } from '@drivers/promptmetrics-driver.interface';

describe('GitSyncJob', () => {
  let driver: PromptDriver;
  let job: GitSyncJob;

  beforeEach(() => {
    driver = {
      sync: jest.fn().mockResolvedValue(undefined),
      listPrompts: jest.fn(),
      getPrompt: jest.fn(),
      createPrompt: jest.fn(),
      listVersions: jest.fn(),
      search: jest.fn(),
    } as unknown as PromptDriver;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call sync on start', () => {
    job = new GitSyncJob(driver, 60000);
    job.start();
    expect(driver.sync).toHaveBeenCalledTimes(1);
    job.stop();
  });

  it('should call sync repeatedly on interval', () => {
    job = new GitSyncJob(driver, 1000);
    job.start();
    expect(driver.sync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(driver.sync).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(2000);
    expect(driver.sync).toHaveBeenCalledTimes(4);

    job.stop();
  });

  it('should stop calling sync after stop', () => {
    job = new GitSyncJob(driver, 1000);
    job.start();
    job.stop();

    jest.advanceTimersByTime(5000);
    expect(driver.sync).toHaveBeenCalledTimes(1);
  });

  it('should handle sync errors gracefully', () => {
    (driver.sync as jest.Mock).mockRejectedValue(new Error('Network error'));
    job = new GitSyncJob(driver, 1000);
    job.start();
    expect(driver.sync).toHaveBeenCalledTimes(1);
    job.stop();
  });
});
