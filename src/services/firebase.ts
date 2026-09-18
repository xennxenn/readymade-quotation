import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { Quotation, StaffMember, CompanySettings, PromotionGroup } from '../types';
import firebaseAppletConfig from '../../firebase-applet-config.json';

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

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse saved Firebase config', e);
  }

  // 1. Check Vite Environment Variables (e.g. from .env or Vercel dashboard)
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
  const envDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

  if (envApiKey && envProjectId && envAppId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      databaseId: envDbId || undefined,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: envAppId,
    };
  }

  // 2. Automatic Fallback to provisioned firebase-applet-config.json
  if (firebaseAppletConfig && firebaseAppletConfig.apiKey && firebaseAppletConfig.projectId) {
    return {
      apiKey: firebaseAppletConfig.apiKey,
      authDomain: firebaseAppletConfig.authDomain || `${firebaseAppletConfig.projectId}.firebaseapp.com`,
      projectId: firebaseAppletConfig.projectId,
      databaseId: firebaseAppletConfig.firestoreDatabaseId || undefined,
      storageBucket: firebaseAppletConfig.storageBucket || `${firebaseAppletConfig.projectId}.firebasestorage.app`,
      messagingSenderId: firebaseAppletConfig.messagingSenderId || '',
      appId: firebaseAppletConfig.appId,
    };
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig | null): void {
  if (config) {
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

    const dbId = config.databaseId;
    if (dbId && dbId !== '(default)') {
      firestoreDb = getFirestore(firebaseApp, dbId);
    } else {
      firestoreDb = getFirestore(firebaseApp);
    }

    return firestoreDb;
  } catch (err) {
    console.error('Error initializing Firebase Firestore:', err);
    return null;
  }
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

// ---------------- CLOUD MUTATIONS ----------------

export async function uploadQuotationToCloud(quote: Quotation): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const quoteRef = doc(db, 'quotations', quote.id);
    await setDoc(quoteRef, {
      ...quote,
      updatedAt: Date.now(),
    });
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
    await setDoc(staffRef, staff);
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

export async function uploadCompanySettingsToCloud(settings: CompanySettings): Promise<boolean> {
  const db = getCloudFirestore();
  if (!db) return false;

  try {
    const settingsRef = doc(db, 'settings', 'company');
    await setDoc(settingsRef, settings);
    return true;
  } catch (err) {
    console.error('Error writing company settings to Firestore:', err);
    return false;
  }
}
