import request from 'supertest';
import { createApp } from '@app';
import { getDb, closeDb, initSchema } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';
import { FilesystemDriver } from '@drivers/promptmetrics-filesystem-driver';

const testDbPath = require('path').resolve(__dirname, '../../data/test-evaluations.db');

describe('Evaluations API', () => {
  let app: ReturnType<typeof createApp>;
  let apiKey: string;

  beforeAll(async () => {
    process.env.SQLITE_PATH = testDbPath;
    process.env.DRIVER = 'filesystem';
    process.env.API_KEY_SALT = 'test-eval-salt';
    await closeDb();
    await initSchema();
    const db = getDb();
    const keyHash = hashApiKey('pm_test_eval_key');
    db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      keyHash,
      'eval-test',
      'read,write',
    );
    apiKey = 'pm_test_eval_key';

    // Read-only key for scope tests
    db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
      hashApiKey('pm_readonly_eval_key'),
      'eval-readonly',
      'read',
    );

    const driver = new FilesystemDriver(require('path').resolve(__dirname, '../../data/test-evaluations-prompts'));
    app = createApp(driver);
  });

  afterAll(async () => {
    await closeDb();
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should create an evaluation', async () => {
    const res = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', apiKey)
      .send({
        name: 'accuracy-check',
        description: 'Check output accuracy',
        prompt_name: 'hello',
        version_tag: '1.0.0',
        criteria: { min_score: 0.8 },
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('accuracy-check');
    expect(res.body.prompt_name).toBe('hello');
  });

  it('should list evaluations', async () => {
    const res = await request(app).get('/v1/evaluations').set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('should get an evaluation by id', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'latency-check',
      prompt_name: 'hello',
    });
    const id = createRes.body.id;

    const res = await request(app).get(`/v1/evaluations/${id}`).set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('latency-check');
  });

  it('should create and list evaluation results', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'score-check',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const resultRes = await request(app)
      .post(`/v1/evaluations/${evalId}/results`)
      .set('X-API-Key', apiKey)
      .send({
        run_id: 'run-1',
        score: 0.95,
        metadata: { judge: 'gpt-4' },
      });
    expect(resultRes.status).toBe(201);
    expect(resultRes.body.score).toBe(0.95);

    const listRes = await request(app).get(`/v1/evaluations/${evalId}/results`).set('X-API-Key', apiKey);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBe(1);
  });

  it('should reject invalid evaluation payload with 422', async () => {
    const res = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      description: 'missing name and prompt_name',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('should reject invalid result payload with 422', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'validation-test',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const res = await request(app).post(`/v1/evaluations/${evalId}/results`).set('X-API-Key', apiKey).send({
      score: 'not-a-number',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('should return 403 when creating evaluation with read-only scope', async () => {
    const res = await request(app)
      .post('/v1/evaluations')
      .set('X-API-Key', 'pm_readonly_eval_key')
      .send({ name: 'readonly-test', prompt_name: 'hello' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 when deleting evaluation with read-only scope', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'delete-scope-test',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const res = await request(app).delete(`/v1/evaluations/${evalId}`).set('X-API-Key', 'pm_readonly_eval_key');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 when adding result with read-only scope', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'result-scope-test',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const res = await request(app)
      .post(`/v1/evaluations/${evalId}/results`)
      .set('X-API-Key', 'pm_readonly_eval_key')
      .send({ score: 0.9 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 when running evaluation with read-only scope', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'run-scope-test',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const res = await request(app)
      .post(`/v1/evaluations/${evalId}/run`)
      .set('X-API-Key', 'pm_readonly_eval_key')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should delete an evaluation and cascade results', async () => {
    const createRes = await request(app).post('/v1/evaluations').set('X-API-Key', apiKey).send({
      name: 'temp-check',
      prompt_name: 'hello',
    });
    const evalId = createRes.body.id;

    const delRes = await request(app).delete(`/v1/evaluations/${evalId}`).set('X-API-Key', apiKey);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/v1/evaluations/${evalId}`).set('X-API-Key', apiKey);
    expect(getRes.status).toBe(404);
  });
});
