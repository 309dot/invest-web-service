import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  DocumentData,
  setDoc,
  runTransaction,
  type Transaction,
} from 'firebase/firestore';
import { db } from './firebase';

// Generic add document
export async function addDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw error;
  }
}

// Generic set document with custom ID
export async function setDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string,
  data: Omit<T, 'id'>
): Promise<void> {
  try {
    await setDoc(doc(db, collectionName, documentId), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error setting document in ${collectionName}:`, error);
    throw error;
  }
}

// Generic get document
export async function getDocument<T>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

// Generic update document
export async function updateDocument<T extends Partial<DocumentData>>(
  collectionName: string,
  documentId: string,
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

// Generic delete document
export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, documentId));
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
}

// Generic query collection
export async function queryCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  } catch (error) {
    console.error(`Error querying collection ${collectionName}:`, error);
    throw error;
  }
}

// Generic subscribe to collection (real-time)
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  constraints: QueryConstraint[] = []
): () => void {
  const q = query(collection(db, collectionName), ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      callback(data);
    },
    (error) => {
      console.error(`Error subscribing to ${collectionName}:`, error);
    }
  );

  return unsubscribe;
}

// Subscribe to single document (real-time)
export function subscribeToDocument<T>(
  collectionName: string,
  documentId: string,
  callback: (data: T | null) => void
): () => void {
  const docRef = doc(db, collectionName, documentId);

  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`Error subscribing to document in ${collectionName}:`, error);
    }
  );

  return unsubscribe;
}

// Get all documents from a collection
export async function getAllDocuments<T>(
  collectionName: string
): Promise<T[]> {
  return queryCollection<T>(collectionName);
}

// Get documents with limit
export async function getDocumentsWithLimit<T>(
  collectionName: string,
  limitCount: number,
  orderByField?: string,
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const constraints: QueryConstraint[] = [];

  if (orderByField) {
    constraints.push(orderBy(orderByField, orderDirection));
  }

  constraints.push(limit(limitCount));

  return queryCollection<T>(collectionName, constraints);
}

// Get documents by date range
export async function getDocumentsByDateRange<T>(
  collectionName: string,
  dateField: string,
  startDate: string,
  endDate: string
): Promise<T[]> {
  const constraints: QueryConstraint[] = [
    where(dateField, '>=', startDate),
    where(dateField, '<=', endDate),
    orderBy(dateField, 'asc'),
  ];

  return queryCollection<T>(collectionName, constraints);
}

export async function getDocumentsSince<T>(
  collectionName: string,
  timestampField: string,
  startDate: Date,
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const constraints: QueryConstraint[] = [
    where(timestampField, '>=', Timestamp.fromDate(startDate)),
    orderBy(timestampField, orderDirection),
  ];

  return queryCollection<T>(collectionName, constraints);
}

// Count documents in collection
export async function countDocuments(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<number> {
  const docs = await queryCollection(collectionName, constraints);
  return docs.length;
}

// Transaction helper
export async function runFirestoreTransaction<T>(
  updater: (transaction: Transaction) => Promise<T>
): Promise<T> {
  try {
    return await runTransaction(db, async (transaction) => updater(transaction));
  } catch (error) {
    console.error('Firestore transaction error:', error);
    throw error;
  }
}
