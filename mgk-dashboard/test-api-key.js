/**
 * Alpha Vantage API 키 테스트 스크립트
 * 
 * 실행 방법:
 * cd mgk-dashboard
 * node test-api-key.js
 */

const https = require('https');

// .env.local 파일에서 API 키 읽기
const fs = require('fs');
const path = require('path');

let API_KEY = '';

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=(.+)/);
    if (match) {
      API_KEY = match[1].trim();
    }
  }
} catch (error) {
  console.error('❌ .env.local 파일을 읽을 수 없습니다:', error.message);
}

if (!API_KEY) {
  console.log('⚠️ API 키가 설정되지 않았습니다.');
  console.log('📝 mgk-dashboard/.env.local 파일에 다음을 추가하세요:');
  console.log('   NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_api_key_here');
  console.log('');
  console.log('🔑 API 키 발급: https://www.alphavantage.co/support/#api-key');
  process.exit(1);
}

console.log('🔑 API Key:', API_KEY.substring(0, 8) + '...');
console.log('');
console.log('📡 Testing Alpha Vantage API...');
console.log('');

// 테스트 1: 일일 데이터 조회
const testSymbol = 'AAPL';
const testDate = '2024-01-15';
const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${testSymbol}&outputsize=compact&apikey=${API_KEY}`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      console.log('📊 API Response Status:', res.statusCode);
      console.log('');

      if (json.Note) {
        console.log('⚠️ API 호출 제한 초과:');
        console.log(json.Note);
        console.log('');
        console.log('💡 Alpha Vantage 무료 플랜:');
        console.log('   - 5 requests / minute');
        console.log('   - 500 requests / day');
        console.log('');
        console.log('⏰ 1분 후 다시 시도하거나 유료 플랜으로 업그레이드하세요.');
      } else if (json['Error Message']) {
        console.log('❌ API 에러:');
        console.log(json['Error Message']);
      } else if (json['Time Series (Daily)']) {
        const timeSeries = json['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).slice(0, 3);
        
        console.log('✅ API 정상 작동!');
        console.log('');
        console.log(`📈 ${testSymbol} 최근 가격 데이터:`);
        dates.forEach(date => {
          const priceData = timeSeries[date];
          console.log(`   ${date}: Open=$${priceData['1. open']}, Close=$${priceData['4. close']}`);
        });
        console.log('');
        
        // 특정 날짜 확인
        if (timeSeries[testDate]) {
          const priceData = timeSeries[testDate];
          console.log(`🎯 ${testDate} 가격:`);
          console.log(`   Open: $${priceData['1. open']}`);
          console.log(`   Close: $${priceData['4. close']}`);
          console.log(`   → Manual purchase: $${priceData['4. close']}`);
          console.log(`   → Auto purchase: $${((parseFloat(priceData['1. open']) + parseFloat(priceData['4. close'])) / 2).toFixed(2)}`);
        } else {
          console.log(`⚠️ ${testDate} 데이터가 없습니다 (휴장일 또는 오래된 데이터)`);
        }
        
        console.log('');
        console.log('✅ 매수 가격 자동 입력 시스템이 정상 작동합니다!');
      } else {
        console.log('❌ 예상치 못한 응답:');
        console.log(JSON.stringify(json, null, 2));
      }
    } catch (error) {
      console.error('❌ JSON 파싱 에러:', error.message);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
}).on('error', (error) => {
  console.error('❌ API 호출 실패:', error.message);
});

