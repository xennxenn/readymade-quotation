import { Product, PromotionGroup, Quotation, StaffMember, CompanySettings } from '../types';
import {
  isCloudSyncEnabled,
  uploadQuotationToCloud,
  deleteQuotationFromCloud,
  uploadStaffToCloud,
  deleteStaffFromCloud,
  uploadCompanySettingsToCloud,
  uploadPromotionGroupToCloud,
  deletePromotionGroupFromCloud,
  uploadProductToCloud,
  batchUploadProductsToCloud,
  deleteProductFromCloud,
  clearAllProductsFromCloud,
  fetchCloudStaffByEmployeeId,
  fetchCloudVisibleCollections,
  uploadVisibleCollectionsToCloud,
} from './firebase';

const DB_NAME = 'BeddingQuotationDB';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false });
        productStore.createIndex('collection', 'collection', { unique: false });
        productStore.createIndex('description', 'description', { unique: false });
        productStore.createIndex('color', 'color', { unique: false });
      }

      // Promotion groups store
      if (!db.objectStoreNames.contains('promotionGroups')) {
        db.createObjectStore('promotionGroups', { keyPath: 'id' });
      }

      // Quotations store
      if (!db.objectStoreNames.contains('quotations')) {
        const quoteStore = db.createObjectStore('quotations', { keyPath: 'id' });
        quoteStore.createIndex('quotationNumber', 'quotationNumber', { unique: false });
        quoteStore.createIndex('date', 'date', { unique: false });
      }

      // Staff store
      if (!db.objectStoreNames.contains('staff')) {
        db.createObjectStore('staff', { keyPath: 'id' });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      await purgeLegacyMockData(dbInstance);
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Purges any legacy mock/initial sample data from local IndexedDB.
 * Never inserts mock data — only user data and central cloud data are stored.
 */
async function purgeLegacyMockData(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(['products', 'promotionGroups', 'staff', 'quotations'], 'readwrite');
      const productStore = tx.objectStore('products');
      const promoStore = tx.objectStore('promotionGroups');
      const staffStore = tx.objectStore('staff');
      const quoteStore = tx.objectStore('quotations');

      // Purge mock dummy products p-1 to p-40
      for (let i = 1; i <= 40; i++) {
        productStore.delete(`p-${i}`);
      }

      // Purge mock promotion groups promo-1 to promo-10
      for (let i = 1; i <= 10; i++) {
        promoStore.delete(`promo-${i}`);
      }

      // Purge mock staff st-1 to st-6
      for (let i = 1; i <= 6; i++) {
        staffStore.delete(`st-${i}`);
      }

      // Purge sample quotation
      quoteStore.delete('quote-sample-001');

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------- Product Queries ----------------

export async function getProductCount(): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const req = tx.objectStore('products').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  if (!barcode || !barcode.trim()) return null;
  const db = await getDB();
  const trimmed = barcode.trim();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const index = tx.objectStore('products').index('barcode');
    const req = index.get(trimmed);

    req.onsuccess = () => {
      resolve(req.result || null);
    };
    req.onerror = () => reject(req.error);
  });
}

const VISIBLE_COLLECTIONS_KEY = 'pasaya_visible_collections';

export async function getVisibleCollections(): Promise<string[] | null> {
  try {
    const raw = localStorage.getItem(VISIBLE_COLLECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading visible collections from localStorage', e);
  }

  if (isCloudSyncEnabled()) {
    try {
      const cloudList = await fetchCloudVisibleCollections();
      if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
        localStorage.setItem(VISIBLE_COLLECTIONS_KEY, JSON.stringify(cloudList));
        return cloudList;
      }
    } catch (e) {
      console.warn('Error fetching visible collections from cloud', e);
    }
  }

  return null;
}

export async function saveVisibleCollections(collections: string[]): Promise<void> {
  try {
    localStorage.setItem(VISIBLE_COLLECTIONS_KEY, JSON.stringify(collections));
  } catch (e) {
    console.warn('Error writing visible collections to localStorage', e);
  }

  if (isCloudSyncEnabled()) {
    uploadVisibleCollectionsToCloud(collections).catch((e) => {
      console.warn('Error uploading visible collections to cloud', e);
    });
  }
}

export async function getAllDistinctCollections(): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const collections = new Set<string>();

    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.value.collection && cursor.value.collection.trim()) {
          collections.add(cursor.value.collection.trim());
        }
        cursor.continue();
      } else {
        resolve(Array.from(collections).sort());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCollectionProductCounts(): Promise<Record<string, number>> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const counts: Record<string, number> = {};

    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const col = cursor.value.collection?.trim();
        if (col) {
          counts[col] = (counts[col] || 0) + 1;
        }
        cursor.continue();
      } else {
        resolve(counts);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDistinctCollections(onlyVisible: boolean = true): Promise<string[]> {
  const allCols = await getAllDistinctCollections();
  if (!onlyVisible) {
    return allCols;
  }
  const visible = await getVisibleCollections();
  if (!visible || visible.length === 0) {
    return allCols;
  }
  const visibleSet = new Set(visible.map((c) => c.toUpperCase()));
  const filtered = allCols.filter((c) => visibleSet.has(c.toUpperCase()));
  return filtered.length > 0 ? filtered : allCols;
}

export async function getDistinctDescriptions(collection?: string): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const descriptions = new Set<string>();

    if (collection) {
      const index = store.index('collection');
      const req = index.openCursor(IDBKeyRange.only(collection));
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.description) {
            descriptions.add(cursor.value.description);
          }
          cursor.continue();
        } else {
          resolve(Array.from(descriptions).sort());
        }
      };
      req.onerror = () => reject(req.error);
    } else {
      const req = store.openCursor();
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.description) {
            descriptions.add(cursor.value.description);
          }
          cursor.continue();
        } else {
          resolve(Array.from(descriptions).sort());
        }
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function getDistinctSizes(collection: string, description: string): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const index = tx.objectStore('products').index('collection');
    const sizes = new Set<string>();

    const req = index.openCursor(IDBKeyRange.only(collection));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.value.description === description && cursor.value.size) {
          sizes.add(cursor.value.size);
        }
        cursor.continue();
      } else {
        resolve(Array.from(sizes).sort());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDistinctColors(
  collection: string,
  description?: string,
  size?: string
): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const index = tx.objectStore('products').index('collection');
    const colors = new Set<string>();

    const req = index.openCursor(IDBKeyRange.only(collection));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const item = cursor.value;
        const matchDesc = !description || item.description === description;
        const matchSize = !size || item.size === size;
        if (matchDesc && matchSize && item.color) {
          colors.add(item.color);
        }
        cursor.continue();
      } else {
        resolve(Array.from(colors).sort());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function findProduct(
  collection: string,
  description: string,
  size: string,
  color: string
): Promise<Product | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const index = tx.objectStore('products').index('collection');

    const req = index.openCursor(IDBKeyRange.only(collection));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const item = cursor.value;
        if (item.description === description && item.size === size && item.color === color) {
          resolve(item);
          return;
        }
        cursor.continue();
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function searchProducts(
  searchTerm: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ items: Product[]; total: number }> {
  const db = await getDB();
  const term = searchTerm.trim().toLowerCase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const matched: Product[] = [];
    let totalMatches = 0;

    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const item = cursor.value as Product;
        const matches =
          !term ||
          item.barcode?.toLowerCase().includes(term) ||
          item.collection?.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.color?.toLowerCase().includes(term) ||
          item.size?.toLowerCase().includes(term) ||
          item.itemName?.toLowerCase().includes(term);

        if (matches) {
          if (totalMatches >= offset && matched.length < limit) {
            matched.push(item);
          }
          totalMatches++;
        }
        cursor.continue();
      } else {
        resolve({ items: matched, total: totalMatches });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Product CRUD ----------------

export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const db = await getDB();
  const newProduct: Product = {
    ...product,
    id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').add(newProduct);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    uploadProductToCloud(newProduct).catch((err) => {
      console.warn('Could not sync product to cloud:', err);
    });
  }

  return newProduct;
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').put(product);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    uploadProductToCloud(product).catch((err) => {
      console.warn('Could not sync product update to cloud:', err);
    });
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').delete(productId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    deleteProductFromCloud(productId).catch((err) => {
      console.warn('Could not delete product from cloud:', err);
    });
  }
}

export async function clearAllProducts(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const req = tx.objectStore('products').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    await clearAllProductsFromCloud();
  }
}

// ---------------- High-Speed Batch Import for Millions of Rows ----------------

export async function batchInsertProducts(
  products: Product[],
  onProgress?: (inserted: number, total: number) => void
): Promise<number> {
  const db = await getDB();
  const BATCH_SIZE = 5000;
  let inserted = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');

      for (const p of chunk) {
        store.put(p);
      }

      tx.oncomplete = () => {
        inserted += chunk.length;
        if (onProgress) {
          onProgress(inserted, products.length);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Upload to Cloud Firestore as well so all deployed instances share the exact same products
  if (isCloudSyncEnabled()) {
    batchUploadProductsToCloud(products).catch((err) => {
      console.warn('Could not batch upload products to cloud:', err);
    });
  }

  return inserted;
}

// ---------------- Promotion Groups ----------------

export async function getPromotionGroups(): Promise<PromotionGroup[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('promotionGroups', 'readonly');
    const req = tx.objectStore('promotionGroups').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function savePromotionGroup(group: PromotionGroup): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('promotionGroups', 'readwrite');
    const req = tx.objectStore('promotionGroups').put(group);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    uploadPromotionGroupToCloud(group).catch((err) => {
      console.warn('Could not sync promotion group to cloud:', err);
    });
  }
}

export async function deletePromotionGroup(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('promotionGroups', 'readwrite');
    const req = tx.objectStore('promotionGroups').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    deletePromotionGroupFromCloud(id).catch((err) => {
      console.warn('Could not delete promotion group from cloud:', err);
    });
  }
}

export function isPromotionActive(promo: PromotionGroup, dateStr?: string): boolean {
  if (!dateStr) return true;
  const targetDate = dateStr.slice(0, 10);
  if (promo.startDate && promo.startDate.trim() !== '') {
    if (targetDate < promo.startDate.trim()) {
      return false;
    }
  }
  if (promo.endDate && promo.endDate.trim() !== '') {
    if (targetDate > promo.endDate.trim()) {
      return false;
    }
  }
  return true;
}

export function doesPromotionApplyToItem(
  promo: PromotionGroup,
  collection: string,
  color: string,
  quoteDate?: string
): boolean {
  if (!collection) return false;
  if (!isPromotionActive(promo, quoteDate)) return false;

  const colUpper = collection.trim().toUpperCase();
  const colorUpper = (color || '').trim().toUpperCase();

  // 1. Check new multi-collection rules if defined
  if (promo.collectionRules && promo.collectionRules.length > 0) {
    for (const rule of promo.collectionRules) {
      if (rule.collection.trim().toUpperCase() === colUpper) {
        if (rule.applyToAllColors) {
          return true;
        }
        if (rule.selectedColors && rule.selectedColors.some((c) => c.trim().toUpperCase() === colorUpper)) {
          return true;
        }
      }
    }
    return false;
  }

  // 2. Check legacy single-collection fields
  if (promo.collection && promo.collection.trim().toUpperCase() === colUpper) {
    if (promo.applyToAllColors) {
      return true;
    }
    if (promo.selectedColors && promo.selectedColors.some((c) => c.trim().toUpperCase() === colorUpper)) {
      return true;
    }
  }

  return false;
}

export function findApplicablePromotions(
  promotionGroups: PromotionGroup[],
  collection: string,
  color: string,
  quoteDate?: string
): PromotionGroup[] {
  if (!collection || !promotionGroups || promotionGroups.length === 0) return [];
  return promotionGroups.filter((p) => doesPromotionApplyToItem(p, collection, color, quoteDate));
}

export function findApplicableDiscount(
  promotionGroups: PromotionGroup[],
  collection: string,
  color: string,
  quoteDate?: string
): number {
  const matching = findApplicablePromotions(promotionGroups, collection, color, quoteDate);
  if (matching.length === 0) return 0;
  // If multiple promotions overlap, default to the highest discount (UI lets user select)
  return Math.max(...matching.map((m) => m.discountPercent));
}

// ---------------- Quotations ----------------

export async function getQuotations(): Promise<Quotation[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quotations', 'readonly');
    const req = tx.objectStore('quotations').getAll();
    req.onsuccess = () => {
      const list = (req.result || []) as Quotation[];
      list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quotations', 'readonly');
    const req = tx.objectStore('quotations').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveQuotation(quote: Quotation): Promise<void> {
  const db = await getDB();
  const updated: Quotation = {
    ...quote,
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('quotations', 'readwrite');
    const req = tx.objectStore('quotations').put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // If Cloud Realtime Sync is active, upload to Firestore
  if (isCloudSyncEnabled()) {
    uploadQuotationToCloud(updated).catch((err) => {
      console.warn('Could not sync quotation to cloud:', err);
    });
  }
}

export async function deleteQuotation(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('quotations', 'readwrite');
    const req = tx.objectStore('quotations').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // If Cloud Realtime Sync is active, delete from Firestore
  if (isCloudSyncEnabled()) {
    deleteQuotationFromCloud(id).catch((err) => {
      console.warn('Could not delete quotation from cloud:', err);
    });
  }
}

// ---------------- Staff ----------------

export async function ensureAdminAccount(): Promise<void> {
  try {
    const db = await getDB();
    const staffList = await getStaffList();

    // Migrate any legacy staff records that lack employeeId or password
    for (const s of staffList) {
      let changed = false;
      if (!s.employeeId || !s.employeeId.trim()) {
        s.employeeId = `EMP-${s.id?.replace(/[^0-9]/g, '') || Math.floor(Math.random() * 9000 + 1000)}`;
        changed = true;
      }
      if (!s.password) {
        s.password = 'password';
        changed = true;
      }
      if (changed) {
        await updateStaffMember(s);
      }
    }

    const existingAdmin = staffList.find(
      (s) => (s?.employeeId || '').trim().toUpperCase() === 'T58121'
    );

    if (!existingAdmin) {
      const defaultAdmin: StaffMember = {
        id: 'st-admin-t58121',
        name: 'ผู้ดูแลระบบ (Admin)',
        employeeId: 'T58121',
        password: 'Admin',
        role: 'admin',
        phone: '02-440-0955',
        createdAt: Date.now(),
      };
      await addStaffMember(defaultAdmin);
    }
  } catch (err) {
    console.error('Error ensuring admin account:', err);
  }
}

export async function authenticateStaff(username: string, password: string): Promise<StaffMember | null> {
  if (!username || !password) return null;
  const trimmedUser = (username || '').trim().toUpperCase();
  const trimmedPass = (password || '').trim();

  // 1. Check local IndexedDB staff list
  const staffList = await getStaffList();
  let member = staffList.find(
    (s) => (s?.employeeId || '').trim().toUpperCase() === trimmedUser
  );

  // 2. If not found locally and cloud sync is available, query Firestore directly!
  // This guarantees that any real staff in Firestore (e.g. T62023, T46160) can log in on ANY device immediately!
  if (!member && isCloudSyncEnabled()) {
    try {
      const cloudMember = await fetchCloudStaffByEmployeeId(trimmedUser);
      if (cloudMember) {
        member = cloudMember;
        // Cache to local IndexedDB
        await addStaffMember(cloudMember);
      }
    } catch (err) {
      console.warn('Cloud staff lookup fallback error:', err);
    }
  }

  // 3. If still not found and username is T58121, check default admin
  if (!member && trimmedUser === 'T58121') {
    await ensureAdminAccount();
    const refreshed = await getStaffList();
    member = refreshed.find(
      (s) => (s?.employeeId || '').trim().toUpperCase() === 'T58121'
    );
  }

  if (!member) {
    return null;
  }

  // Check password strictly
  const staffPass = (member.password || '').trim();
  if (staffPass === trimmedPass) {
    return member;
  }

  return null;
}

export async function getStaffList(): Promise<StaffMember[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('staff', 'readonly');
    const req = tx.objectStore('staff').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function addStaffMember(staff: StaffMember): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('staff', 'readwrite');
    const req = tx.objectStore('staff').put(staff);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    uploadStaffToCloud(staff).catch((err) => {
      console.warn('Could not sync staff to cloud:', err);
    });
  }
}

export async function updateStaffMember(staff: StaffMember): Promise<void> {
  return addStaffMember(staff);
}

export async function deleteStaffMember(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('staff', 'readwrite');
    const req = tx.objectStore('staff').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (isCloudSyncEnabled()) {
    deleteStaffFromCloud(id).catch((err) => {
      console.warn('Could not delete staff from cloud:', err);
    });
  }
}

// ---------------- Company Profile & Logo Settings ----------------

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  logoUrl: '/pasaya-logo.svg',
  companyName: 'บริษัท เท็กซ์ไทล์ แกลลอรี่ จำกัด',
  branchName: '(สำนักงานใหญ่)',
  address: '77/191-192 อาคารสินสาธรทาวเวอร์ ชั้น 42 ถนนกรุงธนบุรี แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ 10600',
  taxId: '0105546015615',
  phone: '0-2440-0955',
  fax: '0-2440-0933-4',
  email: 'info@pasaya.com',
  website: 'www.pasaya.com',
  logoHeight: 96,
};

const COMPANY_SETTINGS_STORAGE_KEY = 'bedding_quotation_company_settings';

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const cached = localStorage.getItem(COMPANY_SETTINGS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...DEFAULT_COMPANY_SETTINGS,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Error reading company settings from localStorage', err);
  }
  return DEFAULT_COMPANY_SETTINGS;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  try {
    localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (isCloudSyncEnabled()) {
      uploadCompanySettingsToCloud(settings).catch((err) => {
        console.warn('Could not sync company settings to cloud:', err);
      });
    }
  } catch (err) {
    console.error('Error writing company settings to localStorage', err);
  }
}

export async function resetCompanySettings(): Promise<CompanySettings> {
  try {
    localStorage.removeItem(COMPANY_SETTINGS_STORAGE_KEY);
  } catch (err) {
    console.error('Error removing company settings', err);
  }
  return DEFAULT_COMPANY_SETTINGS;
}

// ---------------- Bi-directional Cloud Cache Sync Helpers ----------------

export async function syncStaffListToIndexedDB(staffList: StaffMember[]): Promise<void> {
  if (!staffList) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('staff', 'readwrite');
    const store = tx.objectStore('staff');
    store.clear();
    for (const s of staffList) {
      store.put(s);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncQuotationsToIndexedDB(quoteList: Quotation[]): Promise<void> {
  if (!quoteList) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quotations', 'readwrite');
    const store = tx.objectStore('quotations');
    store.clear();
    for (const q of quoteList) {
      store.put(q);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPromotionsToIndexedDB(promoList: PromotionGroup[]): Promise<void> {
  if (!promoList) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('promotionGroups', 'readwrite');
    const store = tx.objectStore('promotionGroups');
    store.clear();
    for (const pg of promoList) {
      store.put(pg);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncProductsToIndexedDB(productList: Product[]): Promise<void> {
  if (!productList) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    store.clear();
    for (const p of productList) {
      store.put(p);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

