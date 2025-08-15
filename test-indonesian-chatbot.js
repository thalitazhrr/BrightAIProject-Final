// Test script untuk chatbot bahasa Indonesia
const baseURL = 'http://localhost:3001';

// Test questions in Indonesian
const indonesianQuestions = [
  "Halo, bagaimana performa HSI hari ini?",
  "Analisis regional mana yang terbaik?",
  "Berapa tingkat churn pelanggan?",
  "Bagaimana kinerja sistem HSI?",
  "Paket apa yang paling laris?",
  "Berapa pertumbuhan pelanggan bersih?",
  "Regional mana yang perlu perhatian?",
  "Bagaimana tren penjualan bulan ini?"
];

async function testAuthentication() {
  try {
    const response = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ Authentication successful');
      return data.data.token;
    } else {
      console.log('❌ Authentication failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    return null;
  }
}

async function testIndonesianChatbot(token, question) {
  try {
    const response = await fetch(`${baseURL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: question,
        responseType: 'operational'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`\\n🇮🇩 PERTANYAAN: "${question}"`);
      console.log(`📊 RESPONS: ${data.response.substring(0, 200)}...`);
      console.log(`💡 INSIGHTS: ${data.insights?.length || 0} insights`);
      console.log(`📝 RECOMMENDATIONS: ${data.recommendations?.length || 0} recommendations`);
      console.log(`⚠️ ALERTS: ${data.alerts?.length || 0} alerts`);
      console.log(`🔮 PREDICTIONS: ${data.predictions?.length || 0} predictions`);
      console.log(`🎯 OPPORTUNITIES: ${data.opportunities?.length || 0} opportunities`);
      console.log(`🏷️ BAHASA: ${data.metadata?.language || 'unknown'}`);
      return true;
    } else {
      console.log(`❌ Chat failed for "${question}":`, data.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Chat error for "${question}":`, error.message);
    return false;
  }
}

async function runIndonesianTests() {
  console.log('🇮🇩 Testing BrightAI Chatbot - Bahasa Indonesia Support');
  console.log('=' .repeat(60));
  
  const token = await testAuthentication();
  if (!token) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  console.log(`\\n🧪 Testing ${indonesianQuestions.length} Indonesian questions...`);
  
  let successCount = 0;
  
  for (const question of indonesianQuestions) {
    const success = await testIndonesianChatbot(token, question);
    if (success) successCount++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\\n' + '='.repeat(60));
  console.log(`🎯 TEST SUMMARY:`);
  console.log(`✅ Successful: ${successCount}/${indonesianQuestions.length}`);
  console.log(`❌ Failed: ${indonesianQuestions.length - successCount}/${indonesianQuestions.length}`);
  
  if (successCount === indonesianQuestions.length) {
    console.log('\\n🎉 ALL TESTS PASSED! Chatbot fully supports Indonesian language!');
  } else {
    console.log('\\n⚠️ Some tests failed. Check the implementation.');
  }
}

// Run the tests
runIndonesianTests();