import express from 'express';
// import { createServer as createViteServer } from 'vite'; // Moved to lazy import
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { put } from '@vercel/blob';
// Removed heavy top-level requires to improve cold start
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { db } from './src/db/index.js';
import { orders, printSettings, orderFiles, admins } from './src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'cetakin-secret-key-123';

export const app = express();
const PORT = 3000;

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

// Ensure uploads directory exists - handle Vercel read-only filesystem
const isVercel = !!process.env.VERCEL;
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// API Routes
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

    const isDefaultPassword = password === 'adminpassword123';
    const token = jwt.sign({ 
      id: admin.id, 
      email: admin.email, 
      name: admin.name,
      shouldChangePassword: isDefaultPassword 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ 
      user: { id: admin.id, email: admin.email, name: admin.name, shouldChangePassword: isDefaultPassword },
      shouldChangePassword: isDefaultPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/update-password', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not available' });
  const { newPassword } = req.body;
  const adminId = (req as any).admin.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(admins).set({ password: hashedPassword }).where(eq(admins.id, adminId));

    const [admin] = await db.select().from(admins).where(eq(admins.id, adminId));
    const token = jwt.sign({ 
      id: admin.id, 
      email: admin.email, 
      name: admin.name,
      shouldChangePassword: false
    }, JWT_SECRET, { expiresIn: '24h' });

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
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

app.post('/api/auth/setup', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not available' });
  const { name, email, password, setupKey } = req.body;
  if (setupKey !== (process.env.SETUP_KEY || 'setup123')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const existingAdmins = await db.select().from(admins);
    if (existingAdmins.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.insert(admins).values({ name, email, password: hashedPassword });
    res.json({ success: true, message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

app.post('/api/upload', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded or files too large' });
    }
    
    const fileInfos = [];
    
    for (const f of files) {
      // Upload to Vercel Blob
      const blob = await put(`uploads/${Date.now()}-${f.originalname}`, f.buffer, {
        access: 'public',
        contentType: f.mimetype,
      });

      let pages = 1;
      const isPDF = f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf');
      if (isPDF) {
        try {
          const dataBuffer = f.buffer;
          if (dataBuffer.length > 4 && dataBuffer.slice(0, 4).toString() === '%PDF') {
            let detected = false;
            try {
              const { PDFDocument } = await import('pdf-lib');
              const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true, updateMetadata: false });
              const count = pdfDoc.getPageCount();
              if (count > 0) { pages = count; detected = true; }
            } catch (e) {}
            
            if (!detected) {
              try {
                const { createRequire } = await import('module');
                const requireModule = createRequire(import.meta.url);
                const pdfParse = requireModule('pdf-parse');
                const data = await pdfParse(dataBuffer);
                if (data && data.numpages > 0) { pages = data.numpages; detected = true; }
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
      
      fileInfos.push({
        filename: blob.url,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        pages: pages || 1,
      });
    }
    res.json({ files: fileInfos });
  } catch (err: any) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Internal server error during upload', details: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { personalInfo, settings, files, submissionId } = req.body;
  if (!db) {
    return res.json({ id: 'mock-id-' + Date.now(), message: 'Order received (Mock mode)' });
  }

  try {
    if (submissionId) {
      const existingOrders = await db.select().from(orders).where(eq(orders.submissionId, submissionId));
      if (existingOrders.length > 0) {
        return res.json({ id: existingOrders[0].id, message: 'Order previously submitted successfully' });
      }
    }

    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx.insert(orders).values({
        submissionId: submissionId || null,
        name: personalInfo.name,
        phone: personalInfo.phone,
        address: personalInfo.address,
        deliveryTime: personalInfo.deliveryTime,
      }).returning();

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
    res.status(500).json({ error: 'Failed to create order', details: error.message || 'Unknown error' });
  }
});

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

app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  if (!db) return res.json({ id, status: 'pending', name: 'Student Name', createdAt: new Date() });
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, id as any));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export async function createServer() {
  console.log('Initializing server...');
  
  // Global error handler for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  });

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('Failed to initialize Vite middleware:', err);
    }
  } else if (!process.env.VERCEL) {
    // Only serve static files via Express if NOT on Vercel
    // Vercel handles static routing via vercel.json rewrites
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }
}

// Start server block
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  createServer().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}
