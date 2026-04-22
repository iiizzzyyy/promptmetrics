import { closeDb } from '@models/promptmetrics-sqlite';

afterAll(() => {
  closeDb();
});
