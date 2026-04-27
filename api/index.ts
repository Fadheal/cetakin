let isReady = false;
let app: any;

export default async function handler(req: any, res: any) {
  if (req.url === '/api/health') {
    return res.status(200).json({ status: 'ok', runtime: 'vercel' });
  }
  try {
    if (!isReady) {
      console.log('Vercel handler: importing server...');
      const serverModule = await import('../server.js');
      app = serverModule.app;
      console.log('Vercel handler: creating server...');
      await serverModule.createServer();
      isReady = true;
      console.log('Vercel handler: server ready.');
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Handler Fatal Error:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).end(JSON.stringify({ 
        error: 'Function Startup Error', 
        message: err.message,
        stack: err.stack,
        code: err.code
      }));
    }
  }
}
