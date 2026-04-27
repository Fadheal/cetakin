import { app, createServer } from '../server';

let isReady = false;

export default async function handler(req: any, res: any) {
  if (!isReady) {
    await createServer();
    isReady = true;
  }
  return app(req, res);
}
