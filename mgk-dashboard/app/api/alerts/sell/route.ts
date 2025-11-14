import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const portfolioId = searchParams.get('portfolioId');

    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    const alertsRef = collection(db, `users/${userId}/sellAlerts`);
    let alertsQuery = query(alertsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5));

    if (portfolioId && portfolioId !== 'all') {
      alertsQuery = query(
        alertsRef,
        where('status', '==', 'pending'),
        where('portfolioId', '==', portfolioId),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    }

    const snapshot = await getDocs(alertsQuery);
    const alerts = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    }));

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[alerts/sell] 목록 조회 실패', error);
    return NextResponse.json(
      { error: '매도 알림을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, alertId, action } = body as {
      userId?: string;
      alertId?: string;
      action?: 'dismiss' | 'complete';
    };

    if (!userId || !alertId) {
      return NextResponse.json({ error: 'userId와 alertId가 필요합니다.' }, { status: 400 });
    }

    const alertRef = doc(db, `users/${userId}/sellAlerts`, alertId);
    await updateDoc(alertRef, {
      status: action === 'complete' ? 'completed' : 'dismissed',
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[alerts/sell] 상태 업데이트 실패', error);
    return NextResponse.json(
      { error: '알림 상태를 업데이트하지 못했습니다.' },
      { status: 500 }
    );
  }
}


