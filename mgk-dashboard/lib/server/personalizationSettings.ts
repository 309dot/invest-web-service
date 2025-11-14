import { Timestamp } from 'firebase-admin/firestore';

import { getFirestoreAdmin } from '@/lib/server/firebaseAdmin';
import type { PersonalizationSettings, RiskProfile, InvestmentGoal } from '@/types';

const defaultFocusAreas: Record<RiskProfile, string[]> = {
  conservative: ['risk', 'income', 'diversification'],
  balanced: ['return', 'risk', 'diversification'],
  aggressive: ['growth', 'momentum', 'allocation'],
};

const DEFAULT_SETTINGS: PersonalizationSettings = {
  riskProfile: 'balanced',
  investmentGoal: 'balanced',
  focusAreas: defaultFocusAreas.balanced,
  lastUpdated: new Date().toISOString(),
};

function resolveFocusAreas(riskProfile: RiskProfile, focusAreas?: string[]): string[] {
  if (Array.isArray(focusAreas) && focusAreas.length > 0) {
    return focusAreas;
  }
  return defaultFocusAreas[riskProfile] ?? defaultFocusAreas.balanced;
}

export async function getPersonalizationSettings(userId: string): Promise<PersonalizationSettings> {
  const db = getFirestoreAdmin();
  const docRef = db.collection('users').doc(userId).collection('settings').doc('personalization');
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return { ...DEFAULT_SETTINGS };
  }

  const data = snapshot.data() as Partial<PersonalizationSettings> & {
    riskProfile?: RiskProfile;
    investmentGoal?: InvestmentGoal;
    focusAreas?: string[];
    lastUpdated?: string;
  };

  const riskProfile = data.riskProfile ?? DEFAULT_SETTINGS.riskProfile;
  const investmentGoal = data.investmentGoal ?? DEFAULT_SETTINGS.investmentGoal;

  return {
    riskProfile,
    investmentGoal,
    focusAreas: resolveFocusAreas(riskProfile, data.focusAreas),
    lastUpdated: data.lastUpdated ?? DEFAULT_SETTINGS.lastUpdated,
  };
}

export async function updatePersonalizationSettings(
  userId: string,
  updates: Partial<Pick<PersonalizationSettings, 'riskProfile' | 'investmentGoal' | 'focusAreas'>>
): Promise<PersonalizationSettings> {
  const db = getFirestoreAdmin();
  const docRef = db.collection('users').doc(userId).collection('settings').doc('personalization');

  const current = await getPersonalizationSettings(userId);

  const nextRiskProfile = updates.riskProfile ?? current.riskProfile;
  const nextInvestmentGoal = updates.investmentGoal ?? current.investmentGoal;
  const nextFocusAreas = resolveFocusAreas(nextRiskProfile, updates.focusAreas ?? current.focusAreas);
  const lastUpdated = new Date().toISOString();

  await docRef.set(
    {
      riskProfile: nextRiskProfile,
      investmentGoal: nextInvestmentGoal,
      focusAreas: nextFocusAreas,
      lastUpdated,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  return {
    riskProfile: nextRiskProfile,
    investmentGoal: nextInvestmentGoal,
    focusAreas: nextFocusAreas,
    lastUpdated,
  };
}

