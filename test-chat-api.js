// Test script to check chat API functionality
// Using native fetch API (Node.js 18+)

const baseURL = 'http://localhost:3001';

// Test 1: Check if server is running
async function testServerHealth() {
  try {
    const response = await fetch(`${baseURL}/health`);
    const data = await response.json();
    console.log('✅ Server health:', data);
    return true;
  } catch (error) {
    console.log('❌ Server health failed:', error.message);
    return false;
  }
}

// Test 2: Try to authenticate
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
      console.log('✅ Authentication successful:', data.data.user.username);
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

// Test 3: Try to create a chat
async function testCreateChat(token) {
  try {
    const response = await fetch(`${baseURL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: `test_${Date.now()}`,
        title: 'Test Chat',
        lastMessage: 'Test message'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ Chat creation successful:', data.data.id);
      return data.data;
    } else {
      console.log('❌ Chat creation failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Chat creation error:', error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting API tests...\n');
  
  const serverOk = await testServerHealth();
  if (!serverOk) return;
  
  const token = await testAuthentication();
  if (!token) return;
  
  const chat = await testCreateChat(token);
  if (!chat) return;
  
  console.log('\n🎉 All tests passed!');
}

runTests();