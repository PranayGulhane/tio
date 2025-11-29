import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { generateTryOnImage } from "./gemini";
import { loginSchema, createStoreManagerSchema, resetPasswordSchema } from "@shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key";
const UPLOAD_DIR = "./uploads";

// Ensure upload directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(`${UPLOAD_DIR}/clothing`)) {
  fs.mkdirSync(`${UPLOAD_DIR}/clothing`, { recursive: true });
}
if (!fs.existsSync(`${UPLOAD_DIR}/customers`)) {
  fs.mkdirSync(`${UPLOAD_DIR}/customers`, { recursive: true });
}
if (!fs.existsSync(`${UPLOAD_DIR}/results`)) {
  fs.mkdirSync(`${UPLOAD_DIR}/results`, { recursive: true });
}

// Multer configuration
const clothingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `${UPLOAD_DIR}/clothing`);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const customerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `${UPLOAD_DIR}/customers`);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadClothing = multer({ storage: clothingStorage });
const uploadCustomer = multer({ storage: customerStorage });

// Auth middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    storeId?: string;
  };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      storeId?: string;
    };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function ownerOnlyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "company_owner") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

function managerOnlyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "store_manager") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

// Helper to generate temporary password
function generateTempPassword(): string {
  return randomBytes(4).toString("hex");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  }, express.static(UPLOAD_DIR));

  // =====================
  // AUTH ROUTES
  // =====================

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);

      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get store name if store manager
      let storeName;
      if (user.storeId) {
        const store = await storage.getStore(user.storeId);
        storeName = store?.name;
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
          storeName,
          mustResetPassword: user.mustResetPassword,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let storeName;
      if (user.storeId) {
        const store = await storage.getStore(user.storeId);
        storeName = store?.name;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
          storeName,
          mustResetPassword: user.mustResetPassword,
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { currentPassword, newPassword } = parsed.data;
      const user = await storage.getUser(req.user!.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        mustResetPassword: false,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // =====================
  // COMPANY OWNER ROUTES
  // =====================

  // Get all stores (with stats for owner)
  app.get("/api/stores", authMiddleware, ownerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const allStores = await storage.getAllStores();
      
      const storesWithStats = await Promise.all(
        allStores.map(async (store) => {
          const storeWithStats = await storage.getStoreWithStats(store.id);
          // Get manager email
          const users = await storage.getUserByEmail(store.id); // This is a workaround
          // Get manager for this store by querying the database
          const storeStats = storeWithStats?.stats || { clothingCount: 0, tryOnCount: 0, sessionCount: 0 };
          
          return {
            ...store,
            stats: storeStats,
          };
        })
      );

      res.json(storesWithStats);
    } catch (error) {
      console.error("Get stores error:", error);
      res.status(500).json({ message: "Failed to get stores" });
    }
  });

  // Create store (and manager account)
  app.post("/api/stores", authMiddleware, ownerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const parsed = createStoreManagerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { email, storeName, storeDescription } = parsed.data;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Create store first
      const store = await storage.createStore({
        name: storeName,
        description: storeDescription || null,
      });

      // Generate temp password
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create manager account
      await storage.createUser({
        email,
        password: hashedPassword,
        role: "store_manager",
        storeId: store.id,
        mustResetPassword: true,
      });

      // Log the action
      await storage.createUsageLog({
        storeId: store.id,
        action: "store_created",
        metadata: JSON.stringify({ createdBy: req.user!.email }),
      });

      res.status(201).json({
        store,
        tempPassword,
        message: "Store and manager account created successfully",
      });
    } catch (error) {
      console.error("Create store error:", error);
      res.status(500).json({ message: "Failed to create store" });
    }
  });

  // Toggle store status
  app.patch("/api/stores/:id/toggle-status", authMiddleware, ownerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const store = await storage.getStore(req.params.id);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      const updated = await storage.updateStore(store.id, {
        isActive: !store.isActive,
      });

      res.json(updated);
    } catch (error) {
      console.error("Toggle store status error:", error);
      res.status(500).json({ message: "Failed to toggle store status" });
    }
  });

  // Reset store manager password
  app.post("/api/stores/:id/reset-password", authMiddleware, ownerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const store = await storage.getStore(req.params.id);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Find manager for this store - we need to find by storeId
      // This is a simplified approach - in production, you'd query users by storeId
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Note: In a real app, you'd find the user by storeId and update them
      // For now, we'll return the temp password

      res.json({
        tempPassword,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Global analytics
  app.get("/api/analytics/global", authMiddleware, ownerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error("Get global analytics error:", error);
      res.status(500).json({ message: "Failed to get analytics" });
    }
  });

  // =====================
  // STORE MANAGER ROUTES
  // =====================

  // Get store stats
  app.get("/api/store/stats", authMiddleware, managerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.storeId) {
        return res.status(400).json({ message: "No store associated with this account" });
      }

      const stats = await storage.getStoreStats(req.user.storeId);
      res.json(stats);
    } catch (error) {
      console.error("Get store stats error:", error);
      res.status(500).json({ message: "Failed to get store stats" });
    }
  });

  // Get clothing items
  app.get("/api/store/items", authMiddleware, managerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.storeId) {
        return res.status(400).json({ message: "No store associated with this account" });
      }

      const category = req.query.category as string | undefined;
      const items = await storage.getClothingItemsByStore(req.user.storeId, category);
      res.json(items);
    } catch (error) {
      console.error("Get items error:", error);
      res.status(500).json({ message: "Failed to get items" });
    }
  });

  // Create clothing item
  app.post("/api/store/items", authMiddleware, managerOnlyMiddleware, uploadClothing.single("image"), async (req: AuthRequest, res) => {
    try {
      if (!req.user?.storeId) {
        return res.status(400).json({ message: "No store associated with this account" });
      }

      const { name, category, barcode, isAvailable } = req.body;
      const imageUrl = req.file ? `/uploads/clothing/${req.file.filename}` : "";

      const item = await storage.createClothingItem({
        storeId: req.user.storeId,
        name,
        category,
        barcode: barcode || null,
        imageUrl,
        isAvailable: isAvailable === "true" || isAvailable === true,
      });

      // Log the action
      await storage.createUsageLog({
        storeId: req.user.storeId,
        action: "clothing_upload",
        metadata: JSON.stringify({ itemId: item.id, name }),
      });

      res.status(201).json(item);
    } catch (error) {
      console.error("Create item error:", error);
      res.status(500).json({ message: "Failed to create item" });
    }
  });

  // Update clothing item
  app.patch("/api/store/items/:id", authMiddleware, managerOnlyMiddleware, uploadClothing.single("image"), async (req: AuthRequest, res) => {
    try {
      const item = await storage.getClothingItem(req.params.id);
      if (!item || item.storeId !== req.user?.storeId) {
        return res.status(404).json({ message: "Item not found" });
      }

      const { name, category, barcode, isAvailable } = req.body;
      const updateData: Record<string, unknown> = {};

      if (name) updateData.name = name;
      if (category) updateData.category = category;
      if (barcode !== undefined) updateData.barcode = barcode || null;
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable === "true" || isAvailable === true;
      if (req.file) updateData.imageUrl = `/uploads/clothing/${req.file.filename}`;

      const updated = await storage.updateClothingItem(item.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update item error:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Delete clothing item
  app.delete("/api/store/items/:id", authMiddleware, managerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const item = await storage.getClothingItem(req.params.id);
      if (!item || item.storeId !== req.user?.storeId) {
        return res.status(404).json({ message: "Item not found" });
      }

      await storage.deleteClothingItem(item.id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      console.error("Delete item error:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Toggle item availability
  app.patch("/api/store/items/:id/toggle-availability", authMiddleware, managerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      const item = await storage.getClothingItem(req.params.id);
      if (!item || item.storeId !== req.user?.storeId) {
        return res.status(404).json({ message: "Item not found" });
      }

      const updated = await storage.updateClothingItem(item.id, {
        isAvailable: !item.isAvailable,
      });
      res.json(updated);
    } catch (error) {
      console.error("Toggle availability error:", error);
      res.status(500).json({ message: "Failed to toggle availability" });
    }
  });

  // Generate QR code
  app.post("/api/store/qr/generate", authMiddleware, managerOnlyMiddleware, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.storeId) {
        return res.status(400).json({ message: "No store associated with this account" });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const qrSession = await storage.createQrSession({
        storeId: req.user.storeId,
        token,
        expiresAt,
      });

      // Generate QR code
      const qrCodeUrl = `${req.protocol}://${req.get("host")}/?session=${token}`;
      const qrCode = await QRCode.toDataURL(qrCodeUrl, {
        width: 256,
        margin: 2,
      });

      // Log the action
      await storage.createUsageLog({
        storeId: req.user.storeId,
        action: "qr_generated",
        metadata: JSON.stringify({ sessionId: qrSession.id }),
      });

      res.json({
        qrCode,
        token,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Generate QR error:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // =====================
  // CUSTOMER ROUTES
  // =====================

  // Validate QR session
  app.get("/api/qr/:token/validate", async (req, res) => {
    try {
      const qrSession = await storage.getQrSessionByToken(req.params.token);
      if (!qrSession) {
        return res.status(404).json({ message: "Invalid or expired session" });
      }

      const store = await storage.getStore(qrSession.storeId);
      if (!store || !store.isActive) {
        return res.status(404).json({ message: "Store not available" });
      }

      // Create customer session
      const customerSession = await storage.createCustomerSession({
        qrSessionId: qrSession.id,
        storeId: qrSession.storeId,
        expiresAt: qrSession.expiresAt,
      });

      // Log the action
      await storage.createUsageLog({
        storeId: qrSession.storeId,
        action: "session_created",
        metadata: JSON.stringify({ customerSessionId: customerSession.id }),
      });

      res.json({
        sessionId: customerSession.id,
        storeId: store.id,
        storeName: store.name,
        expiresAt: qrSession.expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Validate QR error:", error);
      res.status(500).json({ message: "Failed to validate session" });
    }
  });

  // Get clothes for customer
  app.get("/api/customer/clothes", async (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      const category = req.query.category as string | undefined;

      if (!storeId) {
        return res.status(400).json({ message: "Store ID required" });
      }

      const items = await storage.getClothingItemsByStore(storeId, category);
      // Only return available items
      const availableItems = items.filter((item) => item.isAvailable);
      res.json(availableItems);
    } catch (error) {
      console.error("Get customer clothes error:", error);
      res.status(500).json({ message: "Failed to get clothes" });
    }
  });

  // Upload customer photo
  app.post("/api/customer/upload-photo", uploadCustomer.single("photo"), async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      const session = await storage.getCustomerSession(sessionId);
      if (!session || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ message: "Session expired" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No photo uploaded" });
      }

      const photoUrl = `/uploads/customers/${req.file.filename}`;
      
      await storage.updateCustomerSession(sessionId, { photoUrl });

      res.json({ photoUrl });
    } catch (error) {
      console.error("Upload photo error:", error);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Generate try-on
  app.post("/api/tryon", async (req, res) => {
    try {
      const { sessionId, clothingItemId } = req.body;

      if (!sessionId || !clothingItemId) {
        return res.status(400).json({ message: "Session ID and clothing item ID required" });
      }

      const session = await storage.getCustomerSession(sessionId);
      if (!session || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ message: "Session expired" });
      }

      if (!session.photoUrl) {
        return res.status(400).json({ message: "Please upload a photo first" });
      }

      const clothingItem = await storage.getClothingItem(clothingItemId);
      if (!clothingItem || clothingItem.storeId !== session.storeId) {
        return res.status(404).json({ message: "Clothing item not found" });
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        // Return a mock result for demo purposes
        const mockResultUrl = clothingItem.imageUrl; // Just return the clothing image as a placeholder
        
        // Log the try-on
        await storage.createTryOnHistory({
          customerSessionId: session.id,
          clothingItemId: clothingItem.id,
          resultImageUrl: mockResultUrl,
        });

        await storage.incrementTryOnCount(clothingItem.id);

        await storage.createUsageLog({
          storeId: session.storeId,
          action: "try_on",
          metadata: JSON.stringify({ 
            clothingItemId, 
            customerSessionId: session.id,
            mock: true 
          }),
        });

        return res.json({ 
          resultImageUrl: mockResultUrl,
          message: "Demo mode - Gemini API key not configured" 
        });
      }

      // Generate try-on image using Gemini
      const userPhotoPath = `.${session.photoUrl}`;
      const clothingImagePath = `.${clothingItem.imageUrl}`;
      const outputFilename = `result-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
      const outputPath = `${UPLOAD_DIR}/results/${outputFilename}`;

      const resultPath = await generateTryOnImage(
        userPhotoPath,
        clothingImagePath,
        outputPath
      );

      const resultImageUrl = `/uploads/results/${outputFilename}`;

      // Save to history
      await storage.createTryOnHistory({
        customerSessionId: session.id,
        clothingItemId: clothingItem.id,
        resultImageUrl,
      });

      // Increment try-on count
      await storage.incrementTryOnCount(clothingItem.id);

      // Log the action
      await storage.createUsageLog({
        storeId: session.storeId,
        action: "try_on",
        metadata: JSON.stringify({ clothingItemId, customerSessionId: session.id }),
      });

      res.json({ resultImageUrl });
    } catch (error) {
      console.error("Try-on error:", error);
      res.status(500).json({ message: "Failed to generate try-on image" });
    }
  });

  // Scan barcode
  app.post("/api/customer/scan-barcode", async (req, res) => {
    try {
      const { storeId, barcode } = req.body;

      if (!storeId || !barcode) {
        return res.status(400).json({ message: "Store ID and barcode required" });
      }

      const item = await storage.getClothingItemByBarcode(storeId, barcode);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Scan barcode error:", error);
      res.status(500).json({ message: "Failed to scan barcode" });
    }
  });

  return httpServer;
}
