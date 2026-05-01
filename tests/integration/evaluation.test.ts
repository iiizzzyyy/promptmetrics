import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

const testDbPath = require('path').resolve(__dirname, '../../data/test-evaluation-run.db');

describe('Evaluation Runs API', () => {
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-eval-run-salt';
    await closeDb();
    await initSchema();
    const db = getDb();
    const keyHash = hashApiKey('pm_test_eval_run_key');
    await db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'eval-run-test',
      'read,write',
    );
    apiKey = 'pm_test_eval_run_key';
    const driver = new FilesystemDriver(require('path').resolve(__dirname, '../../data/test-evaluation-run-prompts'));
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should create an evaluation run without dataset_id', async () => {
    const evalRes = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', apiKey)
      .send({ name: 'run-test', prompt_name: 'hello' });
    expect(evalRes.status).toBe(201);
    const evalId = evalRes.body.id;

    const runRes = await request(app).post(`/v1/evaluations/${evalId}/run`).set('X-API-Key', apiKey).send({});
    expect(runRes.status).toBe(201);
    expect(runRes.body.evaluation_id).toBe(evalId);
    expect(runRes.body.status).toBe('running');
  });

  it('should create an evaluation run with dataset_id', async () => {
    const dsRes = await request(app)
      .post('/v1/datasets')
      .set('X-API-Key', apiKey)
      .send({ name: 'eval-dataset', rows: [{ input: { q: 'hello' } }] });
    expect(dsRes.status).toBe(201);
    const datasetId = dsRes.body.id;

    const evalRes = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', apiKey)
      .send({ name: 'run-test-2', prompt_name: 'hello' });
    const evalId = evalRes.body.id;

    const runRes = await request(app)
      .post(`/v1/evaluations/${evalId}/run`)
      .set('X-API-Key', apiKey)
      .send({ dataset_id: datasetId });
    expect(runRes.status).toBe(201);
    expect(runRes.body.dataset_id).toBe(datasetId);
    expect(runRes.body.status).toBe('running');
  });

  it('should list evaluation runs', async () => {
    const evalRes = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', apiKey)
      .send({ name: 'run-list-test', prompt_name: 'hello' });
    const evalId = evalRes.body.id;

    await request(app).post(`/v1/evaluations/${evalId}/run`).set('X-API-Key', apiKey).send({});

    const listRes = await request(app).get(`/v1/evaluations/${evalId}/run`).set('X-API-Key', apiKey);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);
  });

  it('should return 422 for invalid dataset_id', async () => {
    const evalRes = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', apiKey)
      .send({ name: 'run-invalid', prompt_name: 'hello' });
    const evalId = evalRes.body.id;

    const runRes = await request(app)
      .post(`/v1/evaluations/${evalId}/run`)
      .set('X-API-Key', apiKey)
      .send({ dataset_id: 'not-a-number' });
    expect(runRes.status).toBe(422);
    expect(runRes.body.code).toBe('VALIDATION_FAILED');
  });
});
