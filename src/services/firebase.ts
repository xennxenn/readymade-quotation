import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  writeBatch,
  onSnapshot,
  Firestore,
  Unsubscribe,
  query,
  where,
} from 'firebase/firestore';
import { Quotation, StaffMember, CompanySettings, PromotionGroup, Product } from '../types';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { DEFAULT_COMPANY_SETTINGS } from '../data/initialData';
import { DEFAULT_FIREBASE_CONFIG } from '../config/firebaseConfig';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const FIREBASE_CONFIG_KEY = 'pasaya_firebase_config';
export const TARGET_DATABASE_ID =
  DEFAULT_FIREBASE_CONFIG.databaseId ||
  firebaseAppletConfig?.firestoreDatabaseId ||
  'ai-studio-pasayaquotation-113564df-7be0-41e4-8484-e1da116527e6';

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  // 1. Check saved custom config in localStorage
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.projectId) {
        // Auto-fix databaseId to ensure it matches the actual project database
        if (!parsed.databaseId || parsed.databaseId === '(default)') {
          parsed.databaseId = TARGET_DATABASE_ID;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse saved Firebase config', e);
  }

  // 2. Check Vite Environment Variables (optional override if provided)
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
  const envDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

  if (envApiKey && envProjectId && envAppId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      databaseId: envDbId || TARGET_DATABASE_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: envAppId,
    };
  }

  // 3. Fallback to firebase-applet-config.json if available
  if (firebaseAppletConfig && firebaseAppletConfig.apiKey && firebaseAppletConfig.projectId) {
    return {
      apiKey: firebaseAppletConfig.apiKey,
      authDomain: firebaseAppletConfig.authDomain || `${firebaseAppletConfig.projectId}.firebaseapp.com`,
      projectId: firebaseAppletConfig.projectId,
      databaseId: TARGET_DATABASE_ID,
      storageBucket: firebaseAppletConfig.storageBucket || `${firebaseAppletConfig.projectId}.firebasestorage.app`,
      messagingSenderId: firebaseAppletConfig.messagingSenderId || '',
      appId: firebaseAppletConfig.appId,
    };
  }

  // 4. Default embedded config: Zero configuration required on Vercel / GitHub
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: FirebaseConfig | null): void {
  if (config) {
    if (!config.databaseId || config.databaseId === '(default)') {
      config.databaseId = TARGET_DATABASE_ID;
    }
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function getCloudFirestore(): Firestore | null {
  if (firestoreDb) return firestoreDb;

  const config = getSavedFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApps()[0];
    }

    const dbId = config.databaseId || TARGET_DATABASE_ID;
    try {
      if (dbId && dbId !== '(default)') {
        firestoreDb = initializeFirestore(firebaseApp, {
          ignoreUndefinedProperties: true,
        }, dbId);
      } else {
        firestoreDb = initializeFirestore(firebaseApp, {
          ignoreUndefinedProperties: true,
        });
      }
    } catch {
      // If already initialized, fallback to getFirestore
      if (dbId && dbId !== '(default)') {
        firestoreDb = getFirestore(firebaseApp, dbId);
      } else {
        firestoreDb = getFirestore(firebaseApp);
      }
    }

    return firestoreDb;
  } catch (err) {
    console.error('Error initializing Firebase Firestore:', err);
    return null;
  }
}

/**
 * Deeply sanitizes any payload destined for Firestore by stripping out
 * all `undefined` fields and cleaning arrays, preventing the notorious
 * "Unsupported field value: undefined" Firestore error.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}

export function isCloudSyncEnabled(): boolean {
  return getCloudFirestore() !== null;
}

// ---------------- REALTIME LISTENERS ----------------

/**
 * Realtime subscription to Quotations collection
 */
export function subscribeToCloudQuotations(
  onUpdate: (quotations: Quotation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getCloudFirestore();
  if (!db) return null;

  try {
    const quotesCol = collection(db, 'quotations');
    return onSnapshot(
      quotesCol,
      (snapshot) => {
        const list: Quotation[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Quotation);
        });
        list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        onUpdate(list);
      },
      (error) => {
        console.error('Realtime Quotations Sync Error:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.error('Failed to subscribe to cloud quotations', e);
    return null;
  }
}

/**
 * Realtime subscription to Staff collection
 */
export function subscribeToCloudStaff(
  onUpdate: (staff: StaffMember[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getCloudFirestore();
  if (!db) return null;

  try {
    const staffCol = collection(db, 'staff');
    return onSnapshot(
      staffCol,
      (snapshot) => {
        const list: StaffMember[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as StaffMember);
        });
        onUpdate(list);
      },
      (error) => {
        console.error('Realtime Staff Sync Error:', error);
        if (onError) onError(error);
      }
    );
  } catch (e) {
    console.error('Failed to subscribe to cloud staff', e);
    return null;
  }
}

/**
 * Realtime subscription to Company Settings
 */
export function subscribeToCloudCompanySettings(
  onUpdate: (settings: CompanySettings) => void
): Unsubscribe | null {
  const db = getCloudFirestore();
  if (!db) return null;

  try {
    const settingsDoc = doc(db, 'settings', 'company');
    return onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as CompanySettings);
      }
    });
  } catch (e) {
    console.error('Failed to subscribe to company settings', e);
    return null;
  }
}

/**
 * Realtime subscription to Promotion Groups
 */
export function subscribeToCloudPromotionGroups(
  onUpdate: (promos: PromotionGroup[]) => void
): Unsubscribe | null {
  const db = getCloudFirestore();
  if (!db) return null;

  try {
    const promoCol = collection(db, 'promotionGroups');
    return onSnapshot(promoCol, (snapshot) => {
      const list: PromotionGroup[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as PromotionGroup);
      });
      onUpdate(list);
    });
  } catch (e) {
    console.error('Failed to subscribe to promotion groups', e);
    return null;
  }
}

// ---------------- CLOUD FETCH DIRECT QUERIES ----------------

export async function fetchCloudStaff(): Promise<StaffMember[] | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'staff'));
    const list: StaffMember[] = [];
    snap.forEach((d) => list.push(d.data() as StaffMember));
    return list;
  } catch (err) {
    console.error('Error fetching cloud staff:', err);
    return null;
  }
}

export async function fetchCloudStaffByEmployeeId(empId: string): Promise<StaffMember | null> {
  const db = getCloudFirestore();
  if (!db || !empId) return null;
  try {
    const trimmed = empId.trim().toUpperCase();
    const staffCol = collection(db, 'staff');
    const q = query(staffCol, where('employeeId', '==', trimmed));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as StaffMember;
    }
    // Fallback search through all docs in case casing or formatting differs
    const all = await getDocs(staffCol);
    for (const d of all.docs) {
      const data = d.data() as StaffMember;
      if ((data.employeeId || '').trim().toUpperCase() === trimmed) {
        return data;
      }
    }
    return null;
  } catch (err) {
    console.error('Error querying cloud staff by employeeId:', err);
    return null;
  }
}

export async function fetchCloudQuotations(): Promise<Quotation[] | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'quotations'));
    const list: Quotation[] = [];
    snap.forEach((d) => list.push(d.data() as Quotation));
    list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    return list;
  } catch (err) {
    console.error('Error fetching cloud quotations:', err);
    return null;
  }
}

export async function fetchCloudPromotionGroups(): Promise<PromotionGroup[] | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'promotionGroups'));
    const list: PromotionGroup[] = [];
    snap.forEach((d) => list.push(d.data() as PromotionGroup));
    return list;
  } catch (err) {
    console.error('Error fetching cloud promotion groups:', err);
    return null;
  }
}

export async function fetchCloudCompanySettings(): Promise<CompanySettings | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', 'company'));
    if (snap.exists()) {
      return snap.data() as CompanySettings;
    }
    return null;
  } catch (err) {
    console.error('Error fetching cloud company settings:', err);
    return null;
  }
}

export async function fetchCloudVisibleCollections(): Promise<string[] | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', 'visibleCollections'));
    if (snap.exists()) {
      const data = snap.data();
      return (data?.collections as string[]) || null;
    }
    return null;
  } catch (err) {
    console.error('Error fetching visible collections from Firestore:', err);
    return null;
  }
}

export async function uploadVisibleCollectionsToCloud(collections: string[]): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;
  try {
    const ref = doc(db, 'settings', 'visibleCollections');
    await setDoc(ref, { collections, updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving visible collections to Firestore:', err);
    return false;
  }
}

export async function fetchCloudProducts(): Promise<Product[] | null> {
  const db = getCloudFirestore();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'products'));
    if (snap.empty) return [];
    const list: Product[] = [];
    snap.forEach((d) => list.push(d.data() as Product));
    return list;
  } catch (err) {
    console.error('Error fetching cloud products:', err);
    return null;
  }
}

// ---------------- CLOUD MUTATIONS ----------------

export async function uploadQuotationToCloud(quote: Quotation): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const quoteRef = doc(db, 'quotations', quote.id);
    const sanitizedData = sanitizeForFirestore({
      ...quote,
      updatedAt: Date.now(),
    });
    await setDoc(quoteRef, sanitizedData);
    return true;
  } catch (err) {
    console.error('Error writing quotation to Firestore:', err);
    return false;
  }
}

export async function deleteQuotationFromCloud(id: string): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const quoteRef = doc(db, 'quotations', id);
    await deleteDoc(quoteRef);
    return true;
  } catch (err) {
    console.error('Error deleting quotation from Firestore:', err);
    return false;
  }
}

export async function uploadStaffToCloud(staff: StaffMember): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const staffRef = doc(db, 'staff', staff.id);
    await setDoc(staffRef, sanitizeForFirestore(staff), { merge: true });
    return true;
  } catch (err) {
    console.error('Error writing staff to Firestore:', err);
    return false;
  }
}

export async function deleteStaffFromCloud(id: string): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const staffRef = doc(db, 'staff', id);
    await deleteDoc(staffRef);
    return true;
  } catch (err) {
    console.error('Error deleting staff from Firestore:', err);
    return false;
  }
}

export async function uploadPromotionGroupToCloud(group: PromotionGroup): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const groupRef = doc(db, 'promotionGroups', group.id);
    await setDoc(groupRef, sanitizeForFirestore(group), { merge: true });
    return true;
  } catch (err) {
    console.error('Error writing promotion group to Firestore:', err);
    return false;
  }
}

export async function deletePromotionGroupFromCloud(id: string): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const groupRef = doc(db, 'promotionGroups', id);
    await deleteDoc(groupRef);
    return true;
  } catch (err) {
    console.error('Error deleting promotion group from Firestore:', err);
    return false;
  }
}

export async function uploadCompanySettingsToCloud(settings: CompanySettings): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const settingsRef = doc(db, 'settings', 'company');
    await setDoc(settingsRef, sanitizeForFirestore(settings), { merge: true });
    return true;
  } catch (err) {
    console.error('Error writing company settings to Firestore:', err);
    return false;
  }
}

export async function uploadProductToCloud(product: Product): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const prodRef = doc(db, 'products', product.id);
    await setDoc(prodRef, sanitizeForFirestore(product), { merge: true });
    return true;
  } catch (err) {
    console.error('Error writing product to Firestore:', err);
    return false;
  }
}

export async function batchUploadProductsToCloud(products: Product[]): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db || products.length === 0) return false;

  try {
    // Firestore batch supports up to 500 writes
    const CHUNK_SIZE = 450;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const p of chunk) {
        const pRef = doc(db, 'products', p.id);
        batch.set(pRef, sanitizeForFirestore(p), { merge: true });
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error batch uploading products to Firestore:', err);
    return false;
  }
}

export async function deleteProductFromCloud(id: string): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const prodRef = doc(db, 'products', id);
    await deleteDoc(prodRef);
    return true;
  } catch (err) {
    console.error('Error deleting product from Firestore:', err);
    return false;
  }
}

export async function clearAllProductsFromCloud(): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const snap = await getDocs(collection(db, 'products'));
    const CHUNK_SIZE = 450;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error clearing products from Firestore:', err);
    return false;
  }
}

/**
 * Purges any initial/mock sample records from Firestore permanently.
 * Guarantees that only user-uploaded or newly created real data exists.
 */
export async function purgeMockDataFromCloud(): Promise<void> {
  const db = getCloudFirestore();
  if (!db) return;

  try {
    // 1. Delete mock dummy products p-1 to p-40
    for (let i = 1; i <= 40; i++) {
      try {
        const ref = doc(db, 'products', `p-${i}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await deleteDoc(ref);
        }
      } catch (e) {
        // ignore individual delete failure
      }
    }

    // 2. Delete mock promotion groups
    for (let i = 1; i <= 10; i++) {
      try {
        const ref = doc(db, 'promotionGroups', `promo-${i}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await deleteDoc(ref);
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Delete mock sample quotations
    try {
      const qRef = doc(db, 'quotations', 'quote-sample-001');
      const qSnap = await getDoc(qRef);
      if (qSnap.exists()) {
        await deleteDoc(qRef);
      }
    } catch (e) {
      // ignore
    }

    // 4. Delete mock staff st-1 to st-6
    for (let i = 1; i <= 6; i++) {
      try {
        const ref = doc(db, 'staff', `st-${i}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await deleteDoc(ref);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.warn('Error purging mock data from cloud:', err);
  }
}

// ---------------- AUTOMATIC CLOUD SEEDER ----------------

/**
 * Initializes default shared data on Cloud Firestore.
 * Strictly adheres to USER INTENT:
 * - NO initial mock products (only real imported products)
 * - NO initial mock promotions
 * - NO sample quotations
 * - Only ensures Admin Account (T58121) exists if missing
 * - Purges any legacy mock data from the central Firestore
 */
export async function initializeCloudDatabaseSeed(): Promise<{
  seededStaff: boolean;
  seededPromos: boolean;
  seededSettings: boolean;
  seededProducts: boolean;
}> {
  const db = getCloudFirestore();
  const result = {
    seededStaff: false,
    seededPromos: false,
    seededSettings: false,
    seededProducts: false,
  };

  if (!db) return result;

  try {
    // 0. Purge any legacy mock records from Firestore
    await purgeMockDataFromCloud();

    // 1. Ensure Admin Account (T58121) exists in Firestore if no admin is present
    const adminRef = doc(db, 'staff', 'st-admin-t58121');
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, sanitizeForFirestore({
        id: 'st-admin-t58121',
        name: 'ผู้ดูแลระบบ (Admin)',
        employeeId: 'T58121',
        password: 'Admin',
        role: 'admin',
        phone: '02-440-0955',
        createdAt: Date.now(),
      }));
      result.seededStaff = true;
    }

    // 2. Check Company Settings in Firestore
    const settingsDoc = doc(db, 'settings', 'company');
    const settingsSnap = await getDoc(settingsDoc);
    if (!settingsSnap.exists()) {
      await setDoc(settingsDoc, sanitizeForFirestore(DEFAULT_COMPANY_SETTINGS));
      result.seededSettings = true;
    }
  } catch (err) {
    console.error('Error during cloud database initialization:', err);
  }

  return result;
}
