"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const isE2EMode = process.env.NEXT_PUBLIC_E2E === 'true';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isE2EMode) {
      const mockUser = {
        uid: 'e2e-user',
        email: 'e2e@example.com',
        displayName: 'E2E Test User',
        photoURL: null,
        providerId: 'e2e',
      } as unknown as User;

      setUser(mockUser);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 사용자 프로필 확인/생성
        await ensureUserProfile(user);
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const ensureUserProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // 새 사용자 프로필 생성
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.now(),
          lastLoginAt: Timestamp.now(),
        });

        // 기본 포트폴리오 생성
        await createDefaultPortfolio(user.uid);
      } else {
        // 마지막 로그인 시간 업데이트
        await setDoc(
          userRef,
          { lastLoginAt: Timestamp.now() },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  };

  const createDefaultPortfolio = async (userId: string) => {
    try {
      const portfolioId = `${userId}_default`;
      const portfolioRef = doc(db, `users/${userId}/portfolios`, portfolioId);

      await setDoc(portfolioRef, {
        userId,
        name: '메인 포트폴리오',
        description: '기본 포트폴리오',
        isDefault: true,
        totalInvested: 0,
        totalValue: 0,
        returnRate: 0,
        cashBalance: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // 사용자 문서에 기본 포트폴리오 ID 저장
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        { defaultPortfolioId: portfolioId },
        { merge: true }
      );
    } catch (error) {
      console.error('Error creating default portfolio:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

