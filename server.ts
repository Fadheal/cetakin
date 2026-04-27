import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { db } from './src/db/index';
import { orders, printSettings, orderFiles, admins } from './src/db/schema';
import { eq, desc } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'cetakin-secret-key-123';

export const app = express();
const PORT = 3000;

export async function createServer() {
  // Middlewares
  app.use(express.json());
  app.use(cookieParser());

  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.admin_token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Multer config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    },
  });
  const upload = multer({ 
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
  });

  // API Routes
  
  // Custom Auth Routes
  app.post('/api/auth/login', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const { email, password } = req.body;
    try {
      const [admin] = await db.select().from(admins).where(eq(admins.email, email));
      if (!admin) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name }, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({ user: { id: admin.id, email: admin.email, name: admin.name } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
  });

  app.get('/api/auth/session', async (req, res) => {
    const token = req.cookies.admin_token;
    if (!token) return res.json({ session: null });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.json({ session: { user: decoded } });
    } catch (err) {
      res.json({ session: null });
    }
  });

  // Admin Setup (Temporary/One-time)
  app.post('/api/auth/setup', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const { name, email, password, setupKey } = req.body;
    // Simple protection for setup
    if (setupKey !== (process.env.SETUP_KEY || 'setup123')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const existingAdmins = await db.select().from(admins);
      if (existingAdmins.length > 0) {
        return res.status(400).json({ error: 'Admin already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.insert(admins).values({
        name,
        email,
        password: hashedPassword
      });

      res.json({ success: true, message: 'Admin user created successfully' });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ error: 'Failed to create admin user' });
    }
  });

  // Upload files endpoint
  app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded or files too large' });
      }
      
      const fileInfos = [];
      for (const f of files) {
        let pages = 1;
        if (f.mimetype === 'application/pdf') {
          try {
            console.log(`Processing PDF: ${f.originalname}, path: ${f.path}`);
            const dataBuffer = fs.readFileSync(f.path);
            
            try {
              const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
              pages = pdfDoc.getPageCount();
              console.log(`pdf-lib found ${pages} pages for ${f.originalname}`);
            } catch (libErr) {
              console.warn(`pdf-lib failed for ${f.originalname}, trying pdf-parse fallback:`, libErr);
              try {
                const data = await pdfParse(dataBuffer);
                pages = data.numpages;
                console.log(`pdf-parse fallback found ${pages} pages for ${f.originalname}`);
              } catch (parseErr) {
                console.error(`pdf-parse also failed for ${f.originalname}:`, parseErr);
                pages = 1;
              }
            }
            
            if (!pages || pages < 1) pages = 1;
          } catch (error) {
            console.error(`Error reading file for ${f.originalname}:`, error);
            pages = 1;
          }
        }
        
        fileInfos.push({
          filename: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
          pages: pages,
        });
      }
      
      res.json({ files: fileInfos });
    } catch (err: any) {
      console.error('Upload endpoint error:', err);
      res.status(500).json({ error: 'Internal server error during upload', details: err.message });
    }
  });

  // Submit order endpoint
  app.post('/api/orders', async (req, res) => {
    const { personalInfo, settings, files, submissionId } = req.body;

    if (!db) {
      console.log('Order received (MOCK):', { personalInfo, settings, files });
      return res.json({ id: 'mock-id-' + Date.now(), message: 'Order received (Mock mode)' });
    }

    try {
      // Check for existing order with same submissionId (Idempotency)
      if (submissionId) {
        const existingOrders = await db.select().from(orders).where(eq(orders.submissionId, submissionId));
        if (existingOrders.length > 0) {
          console.log('Duplicate order submission detected, returning existing order');
          return res.json({ id: existingOrders[0].id, message: 'Order previously submitted successfully' });
        }
      }

      const result = await db.transaction(async (tx) => {
        // 1. Create order
        const [newOrder] = await tx.insert(orders).values({
          submissionId: submissionId || null,
          name: personalInfo.name,
          phone: personalInfo.phone,
          address: personalInfo.address,
          deliveryTime: personalInfo.deliveryTime,
        }).returning();

        // 2. Create settings
        await tx.insert(printSettings).values({
          orderId: newOrder.id,
          mode: settings.mode,
          color: settings.color,
          sidedness: settings.sidedness,
          copies: settings.copies,
          quality: settings.quality,
          paperType: settings.paperType,
          paperWeight: settings.paperWeight,
          cutting: settings.cutting,
          layout: settings.layout,
          binding: settings.binding,
          notes: settings.notes,
        });

        // 3. Create files records
        if (files && files.length > 0) {
          await tx.insert(orderFiles).values(files.map((f: any) => ({
            orderId: newOrder.id,
            filename: f.filename,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            pages: f.pages || 1,
          })));
        }
        return newOrder;
      });

      res.json({ id: result.id, message: 'Order submitted successfully' });
    } catch (error: any) {
      console.error('Error creating order:', error);
      res.status(500).json({ 
        error: 'Failed to create order', 
        details: error.message || 'Unknown error'
      });
    }
  });

  // Admin API Routes
  app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not available' });
    try {
      const allOrders = await db!.select().from(orders).orderBy(desc(orders.createdAt));
      const ordersWithDetails = await Promise.all(allOrders.map(async (order) => {
        const [settings] = await db!.select().from(printSettings).where(eq(printSettings.orderId, order.id));
        const files = await db!.select().from(orderFiles).where(eq(orderFiles.orderId, order.id));
        return { ...order, settings, files };
      }));
      res.json(ordersWithDetails);
    } catch (error) {
      console.error('Fetch admin orders error:', error);
      res.status(500).json({ error: 'Failed to fetch admin orders' });
    }
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const { id } = req.params;
    const { status } = req.body;
    try {
      await db!.update(orders).set({ status }).where(eq(orders.id, id as any));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not available' });
    const { id } = req.params;
    try {
      await db!.delete(orders).where(eq(orders.id, id as any));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  app.use('/admin/uploads', requireAdmin, express.static(uploadsDir));

  // Get order status
  app.get('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!db) {
      return res.json({ id, status: 'pending', name: 'Student Name', createdAt: new Date() });
    }

    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, id as any));
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });
}

// Only start the server if this file is run directly (not as a module on Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  createServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}
