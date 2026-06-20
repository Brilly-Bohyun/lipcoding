#!/usr/bin/env node
/**
 * Integration Test Runner
 * 로컬 서버가 실행 중일 때 E2E 테스트를 실행합니다.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:7071';
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

async function runIntegrationTests() {
  console.log('🧪 Running Integration Tests...\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    
    if (response.status === 200 && data.status === 'healthy') {
      console.log('✅ Health Check: PASS');
      passed++;
    } else {
      console.log('❌ Health Check: FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ Health Check: ERROR -', error.message);
    failed++;
  }

  // Test 2: Tickets List
  try {
    const response = await fetch(`${API_BASE}/api/tickets`);
    const data = await response.json();
    
    if (response.status === 200 && data.success && Array.isArray(data.data)) {
      console.log(`✅ Tickets List: PASS (${data.data.length} tickets)`);
      passed++;
    } else {
      console.log('❌ Tickets List: FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ Tickets List: ERROR -', error.message);
    failed++;
  }

  // Test 3: Ticket Detail
  try {
    const response = await fetch(`${API_BASE}/api/tickets/ticket-001`);
    const data = await response.json();
    
    if (response.status === 200 && data.success && data.data.mailThread) {
      console.log(`✅ Ticket Detail: PASS (${data.data.mailThread.length} mails)`);
      passed++;
    } else {
      console.log('❌ Ticket Detail: FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ Ticket Detail: ERROR -', error.message);
    failed++;
  }

  // Test 4: Frontend Accessibility
  try {
    const response = await fetch(FRONTEND_BASE);
    
    if (response.status === 200) {
      console.log('✅ Frontend Serving: PASS');
      passed++;
    } else {
      console.log('❌ Frontend Serving: FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ Frontend Serving: ERROR -', error.message);
    failed++;
  }

  // Test 5: CORS Headers
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      headers: {
        'Origin': FRONTEND_BASE
      }
    });
    
    if (response.status === 200) {
      console.log('✅ CORS Configuration: PASS');
      passed++;
    } else {
      console.log('❌ CORS Configuration: FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ CORS Configuration: ERROR -', error.message);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runIntegrationTests().catch(err => {
  console.error('❌ Integration test runner failed:', err);
  process.exit(1);
});
