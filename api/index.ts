let isReady = false;
let app: any;

export default async function handler(req: any, res: any) {
  try {
    if (!isReady) {
      const serverModule = await import('../server');
      app = serverModule.app;
      await serverModule.createServer();
      isReady = true;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Handler Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Function Startup Error', 
        message: err.message,
        stack: err.stack 
      });
    }
  }
}
