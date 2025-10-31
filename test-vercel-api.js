/**
 * Vercel 배포 API 테스트 스크립트
 * 
 * 사용법:
 * 1. VERCEL_URL을 실제 배포 URL로 변경
 * 2. node test-vercel-api.js 실행
 */

const VERCEL_URL = 'https://your-project.vercel.app'; // ⚠️ 실제 Vercel URL로 변경 필요!

// 테스트 결과를 저장할 배열
const testResults = [];

/**
 * API 테스트 헬퍼 함수
 */
async function testAPI(name, endpoint, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 테스트: ${name}`);
    console.log(`📍 URL: ${VERCEL_URL}${endpoint}`);
    
    const response = await fetch(`${VERCEL_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const duration = Date.now() - startTime;
    const data = await response.json().catch(() => null);

    const result = {
      name,
      endpoint,
      status: response.status,
      ok: response.ok,
      duration: `${duration}ms`,
      data: data,
      timestamp: new Date().toISOString(),
    };

    testResults.push(result);

    if (response.ok) {
      console.log(`✅ 성공 (${response.status}) - ${duration}ms`);
      console.log(`📦 응답:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
    } else {
      console.log(`❌ 실패 (${response.status}) - ${duration}ms`);
      console.log(`📦 응답:`, data);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const result = {
      name,
      endpoint,
      status: 'ERROR',
      ok: false,
      duration: `${duration}ms`,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    testResults.push(result);

    console.log(`❌ 에러: ${error.message}`);
    return result;
  }
}

/**
 * 메인 테스트 실행
 */
async function runTests() {
  console.log('🚀 Vercel API 테스트 시작');
  console.log(`🌐 배포 URL: ${VERCEL_URL}`);
  console.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log('='.repeat(60));

  // 1. 기본 페이지 접근 테스트
  console.log('\n📋 [카테고리 1] 기본 페이지 접근');
  await testAPI('홈페이지', '/');
  await testAPI('로그인 페이지', '/login');

  // 2. 주식 검색 API
  console.log('\n📋 [카테고리 2] 주식 검색 API');
  await testAPI('주식 검색 - AAPL', '/api/stocks/search?query=AAPL');
  await testAPI('주식 검색 - 삼성전자', '/api/stocks/search?query=삼성전자');
  await testAPI('주식 검색 - 빈 쿼리', '/api/stocks/search?query=');
  
  // 3. 주식 마스터 데이터
  console.log('\n📋 [카테고리 3] 주식 마스터 데이터');
  await testAPI('주식 마스터 조회', '/api/stocks/master');

  // 4. 역사적 가격 조회
  console.log('\n📋 [카테고리 4] 역사적 가격 조회');
  const testDate = new Date();
  testDate.setDate(testDate.getDate() - 7); // 7일 전
  const dateStr = testDate.toISOString().split('T')[0];
  await testAPI('AAPL 역사적 가격', `/api/stocks/historical-price?symbol=AAPL&date=${dateStr}`);

  // 5. 환율 조회
  console.log('\n📋 [카테고리 5] 환율 조회');
  await testAPI('USD/KRW 환율', '/api/exchange-rate?from=USD&to=KRW');

  // 6. 포지션 API (인증 필요할 수 있음)
  console.log('\n📋 [카테고리 6] 포지션 API');
  await testAPI('포지션 목록 조회', '/api/positions');
  
  // 7. 거래 내역 API
  console.log('\n📋 [카테고리 7] 거래 내역 API');
  await testAPI('거래 내역 조회', '/api/transactions');

  // 8. 잔고 API
  console.log('\n📋 [카테고리 8] 잔고 API');
  await testAPI('잔고 조회', '/api/balance');

  // 9. 포트폴리오 분석 API
  console.log('\n📋 [카테고리 9] 포트폴리오 분석 API');
  await testAPI('포트폴리오 분석', '/api/portfolio/analysis');

  // 10. 뉴스 API
  console.log('\n📋 [카테고리 10] 뉴스 API');
  await testAPI('개인화 뉴스', '/api/news/personalized');

  // 11. 통계 API
  console.log('\n📋 [카테고리 11] 통계 API');
  await testAPI('통계 조회', '/api/stats');

  // 12. 워치리스트 API
  console.log('\n📋 [카테고리 12] 워치리스트 API');
  await testAPI('워치리스트 조회', '/api/watchlist');

  // 13. 주간 리포트 API
  console.log('\n📋 [카테고리 13] 주간 리포트 API');
  await testAPI('주간 리포트 조회', '/api/weekly-reports');

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));

  const successCount = testResults.filter(r => r.ok).length;
  const failCount = testResults.filter(r => !r.ok && r.status !== 'ERROR').length;
  const errorCount = testResults.filter(r => r.status === 'ERROR').length;
  const totalCount = testResults.length;

  console.log(`\n✅ 성공: ${successCount}/${totalCount}`);
  console.log(`❌ 실패: ${failCount}/${totalCount}`);
  console.log(`⚠️  에러: ${errorCount}/${totalCount}`);
  console.log(`📈 성공률: ${((successCount / totalCount) * 100).toFixed(1)}%`);

  // 실패/에러 상세
  const failures = testResults.filter(r => !r.ok);
  if (failures.length > 0) {
    console.log('\n⚠️  실패/에러 상세:');
    failures.forEach(f => {
      console.log(`  - ${f.name}: ${f.status} (${f.endpoint})`);
      if (f.error) {
        console.log(`    에러: ${f.error}`);
      }
    });
  }

  // 응답 시간 분석
  const durations = testResults
    .filter(r => r.duration)
    .map(r => parseInt(r.duration));
  
  if (durations.length > 0) {
    const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log('\n⏱️  응답 시간 분석:');
    console.log(`  - 평균: ${avgDuration}ms`);
    console.log(`  - 최대: ${maxDuration}ms`);
    console.log(`  - 최소: ${minDuration}ms`);
  }

  console.log('\n⏰ 종료 시간:', new Date().toLocaleString('ko-KR'));
  console.log('='.repeat(60));

  // JSON 파일로 저장
  const fs = require('fs');
  const path = require('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `test-results-${timestamp}.json`;
  
  fs.writeFileSync(
    path.join(__dirname, filename),
    JSON.stringify({
      testDate: new Date().toISOString(),
      vercelUrl: VERCEL_URL,
      summary: {
        total: totalCount,
        success: successCount,
        fail: failCount,
        error: errorCount,
        successRate: `${((successCount / totalCount) * 100).toFixed(1)}%`,
      },
      performance: {
        avgDuration: durations.length > 0 ? `${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0)}ms` : 'N/A',
        maxDuration: durations.length > 0 ? `${Math.max(...durations)}ms` : 'N/A',
        minDuration: durations.length > 0 ? `${Math.min(...durations)}ms` : 'N/A',
      },
      results: testResults,
    }, null, 2)
  );

  console.log(`\n💾 테스트 결과가 ${filename}에 저장되었습니다.`);
}

// 실행
if (VERCEL_URL === 'https://your-project.vercel.app') {
  console.error('❌ 에러: VERCEL_URL을 실제 배포 URL로 변경해주세요!');
  console.log('\n사용법:');
  console.log('1. 스크립트 상단의 VERCEL_URL을 수정하세요.');
  console.log('2. node test-vercel-api.js 실행');
  process.exit(1);
}

runTests().catch(console.error);

