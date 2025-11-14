import * as admin from 'firebase-admin';

declare global {
  // eslint-disable-next-line no-var
  var __firebaseAdminApp__: admin.app.App | undefined;
}

export function getFirebaseAdminApp(): admin.app.App {
  if (!global.__firebaseAdminApp__) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin 자격 증명이 설정되지 않았습니다. FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY 환경 변수를 확인하세요.'
      );
    }

    global.__firebaseAdminApp__ = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  return global.__firebaseAdminApp__;
}

export function getFirestoreAdmin() {
  return getFirebaseAdminApp().firestore();
}

export function getAuthAdmin() {
  return getFirebaseAdminApp().auth();
}

