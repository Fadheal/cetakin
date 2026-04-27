import { app, createServer } from '../server';

let isReady = false;

export default async function handler(req: any, res: any) {
  try {
    if (!isReady) {
      await createServer();
      isReady = true;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Handler Error:', err);
    res.status(500).json({ 
      error: 'Function Startup Error', 
      message: err.message,
      stack: err.stack 
    });
  }
}
