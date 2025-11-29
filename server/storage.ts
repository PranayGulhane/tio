import {
  users,
  stores,
  clothingItems,
  qrSessions,
  customerSessions,
  tryOnHistory,
  usageLogs,
  type User,
  type InsertUser,
  type Store,
  type InsertStore,
  type ClothingItem,
  type InsertClothingItem,
  type QrSession,
  type InsertQrSession,
  type CustomerSession,
  type InsertCustomerSession,
  type TryOnHistory,
  type InsertTryOnHistory,
  type UsageLog,
  type InsertUsageLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, gt, desc, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Stores
  getStore(id: string): Promise<Store | undefined>;
  getAllStores(): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, data: Partial<Store>): Promise<Store | undefined>;
  getStoreWithStats(storeId: string): Promise<{
    store: Store;
    stats: { clothingCount: number; tryOnCount: number; sessionCount: number };
  } | undefined>;

  // Clothing Items
  getClothingItem(id: string): Promise<ClothingItem | undefined>;
  getClothingItemsByStore(storeId: string, category?: string): Promise<ClothingItem[]>;
  getClothingItemByBarcode(storeId: string, barcode: string): Promise<ClothingItem | undefined>;
  createClothingItem(item: InsertClothingItem): Promise<ClothingItem>;
  updateClothingItem(id: string, data: Partial<ClothingItem>): Promise<ClothingItem | undefined>;
  deleteClothingItem(id: string): Promise<void>;
  incrementTryOnCount(id: string): Promise<void>;

  // QR Sessions
  getQrSession(id: string): Promise<QrSession | undefined>;
  getQrSessionByToken(token: string): Promise<QrSession | undefined>;
  createQrSession(session: InsertQrSession): Promise<QrSession>;

  // Customer Sessions
  getCustomerSession(id: string): Promise<CustomerSession | undefined>;
  createCustomerSession(session: InsertCustomerSession): Promise<CustomerSession>;
  updateCustomerSession(id: string, data: Partial<CustomerSession>): Promise<CustomerSession | undefined>;

  // Try-on History
  createTryOnHistory(history: InsertTryOnHistory): Promise<TryOnHistory>;
  getTryOnHistoryBySession(sessionId: string): Promise<TryOnHistory[]>;

  // Usage Logs
  createUsageLog(log: InsertUsageLog): Promise<UsageLog>;
  getUsageLogs(storeId: string): Promise<UsageLog[]>;

  // Analytics
  getGlobalStats(): Promise<{
    totalStores: number;
    totalApiCalls: number;
    totalSessions: number;
    totalClothingItems: number;
  }>;
  getStoreStats(storeId: string): Promise<{
    clothingCount: number;
    tryOnCount: number;
    sessionCount: number;
    availableCount: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // Stores
  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async getAllStores(): Promise<Store[]> {
    return db.select().from(stores).orderBy(desc(stores.createdAt));
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async updateStore(id: string, data: Partial<Store>): Promise<Store | undefined> {
    const [store] = await db.update(stores).set(data).where(eq(stores.id, id)).returning();
    return store || undefined;
  }

  async getStoreWithStats(storeId: string) {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    if (!store) return undefined;

    const [clothingResult] = await db
      .select({ count: count() })
      .from(clothingItems)
      .where(eq(clothingItems.storeId, storeId));

    const [tryOnResult] = await db
      .select({ count: sql<number>`COALESCE(SUM(${clothingItems.tryOnCount}), 0)::int` })
      .from(clothingItems)
      .where(eq(clothingItems.storeId, storeId));

    const [sessionResult] = await db
      .select({ count: count() })
      .from(customerSessions)
      .where(eq(customerSessions.storeId, storeId));

    return {
      store,
      stats: {
        clothingCount: clothingResult?.count ?? 0,
        tryOnCount: tryOnResult?.count ?? 0,
        sessionCount: sessionResult?.count ?? 0,
      },
    };
  }

  // Clothing Items
  async getClothingItem(id: string): Promise<ClothingItem | undefined> {
    const [item] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    return item || undefined;
  }

  async getClothingItemsByStore(storeId: string, category?: string): Promise<ClothingItem[]> {
    if (category) {
      return db
        .select()
        .from(clothingItems)
        .where(and(eq(clothingItems.storeId, storeId), eq(clothingItems.category, category as any)))
        .orderBy(desc(clothingItems.createdAt));
    }
    return db
      .select()
      .from(clothingItems)
      .where(eq(clothingItems.storeId, storeId))
      .orderBy(desc(clothingItems.createdAt));
  }

  async getClothingItemByBarcode(storeId: string, barcode: string): Promise<ClothingItem | undefined> {
    const [item] = await db
      .select()
      .from(clothingItems)
      .where(and(eq(clothingItems.storeId, storeId), eq(clothingItems.barcode, barcode)));
    return item || undefined;
  }

  async createClothingItem(insertItem: InsertClothingItem): Promise<ClothingItem> {
    const [item] = await db.insert(clothingItems).values(insertItem).returning();
    return item;
  }

  async updateClothingItem(id: string, data: Partial<ClothingItem>): Promise<ClothingItem | undefined> {
    const [item] = await db
      .update(clothingItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clothingItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteClothingItem(id: string): Promise<void> {
    await db.delete(clothingItems).where(eq(clothingItems.id, id));
  }

  async incrementTryOnCount(id: string): Promise<void> {
    await db
      .update(clothingItems)
      .set({ tryOnCount: sql`${clothingItems.tryOnCount} + 1` })
      .where(eq(clothingItems.id, id));
  }

  // QR Sessions
  async getQrSession(id: string): Promise<QrSession | undefined> {
    const [session] = await db.select().from(qrSessions).where(eq(qrSessions.id, id));
    return session || undefined;
  }

  async getQrSessionByToken(token: string): Promise<QrSession | undefined> {
    const [session] = await db
      .select()
      .from(qrSessions)
      .where(and(eq(qrSessions.token, token), gt(qrSessions.expiresAt, new Date())));
    return session || undefined;
  }

  async createQrSession(insertSession: InsertQrSession): Promise<QrSession> {
    const [session] = await db.insert(qrSessions).values(insertSession).returning();
    return session;
  }

  // Customer Sessions
  async getCustomerSession(id: string): Promise<CustomerSession | undefined> {
    const [session] = await db.select().from(customerSessions).where(eq(customerSessions.id, id));
    return session || undefined;
  }

  async createCustomerSession(insertSession: InsertCustomerSession): Promise<CustomerSession> {
    const [session] = await db.insert(customerSessions).values(insertSession).returning();
    return session;
  }

  async updateCustomerSession(id: string, data: Partial<CustomerSession>): Promise<CustomerSession | undefined> {
    const [session] = await db
      .update(customerSessions)
      .set(data)
      .where(eq(customerSessions.id, id))
      .returning();
    return session || undefined;
  }

  // Try-on History
  async createTryOnHistory(insertHistory: InsertTryOnHistory): Promise<TryOnHistory> {
    const [history] = await db.insert(tryOnHistory).values(insertHistory).returning();
    return history;
  }

  async getTryOnHistoryBySession(sessionId: string): Promise<TryOnHistory[]> {
    return db
      .select()
      .from(tryOnHistory)
      .where(eq(tryOnHistory.customerSessionId, sessionId))
      .orderBy(desc(tryOnHistory.createdAt));
  }

  // Usage Logs
  async createUsageLog(insertLog: InsertUsageLog): Promise<UsageLog> {
    const [log] = await db.insert(usageLogs).values(insertLog).returning();
    return log;
  }

  async getUsageLogs(storeId: string): Promise<UsageLog[]> {
    return db
      .select()
      .from(usageLogs)
      .where(eq(usageLogs.storeId, storeId))
      .orderBy(desc(usageLogs.createdAt));
  }

  // Analytics
  async getGlobalStats() {
    const [storesResult] = await db.select({ count: count() }).from(stores);
    const [clothingResult] = await db.select({ count: count() }).from(clothingItems);
    const [sessionsResult] = await db.select({ count: count() }).from(customerSessions);
    const [tryOnResult] = await db
      .select({ count: count() })
      .from(usageLogs)
      .where(eq(usageLogs.action, "try_on"));

    return {
      totalStores: storesResult?.count ?? 0,
      totalApiCalls: tryOnResult?.count ?? 0,
      totalSessions: sessionsResult?.count ?? 0,
      totalClothingItems: clothingResult?.count ?? 0,
    };
  }

  async getStoreStats(storeId: string) {
    const [clothingResult] = await db
      .select({ count: count() })
      .from(clothingItems)
      .where(eq(clothingItems.storeId, storeId));

    const [availableResult] = await db
      .select({ count: count() })
      .from(clothingItems)
      .where(and(eq(clothingItems.storeId, storeId), eq(clothingItems.isAvailable, true)));

    const [tryOnResult] = await db
      .select({ count: sql<number>`COALESCE(SUM(${clothingItems.tryOnCount}), 0)::int` })
      .from(clothingItems)
      .where(eq(clothingItems.storeId, storeId));

    const [sessionResult] = await db
      .select({ count: count() })
      .from(customerSessions)
      .where(eq(customerSessions.storeId, storeId));

    return {
      clothingCount: clothingResult?.count ?? 0,
      availableCount: availableResult?.count ?? 0,
      tryOnCount: tryOnResult?.count ?? 0,
      sessionCount: sessionResult?.count ?? 0,
    };
  }
}

export const storage = new DatabaseStorage();
