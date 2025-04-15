// Simple script to test login functionality directly via API
import fetch from 'node-fetch';

// Test credentials (reader account)
const testCredentials = {
  username: 'emilynn992',
  password: 'JayJas1423!'
};

async function testLogin() {
  console.log('Testing login with credentials:', { 
    username: testCredentials.username,
    passwordLength: testCredentials.password.length
  });
  
  try {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    const res = await fetch(`http://localhost:5000/api/login?_=${timestamp}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(testCredentials)
    });
    
    if (!res.ok) {
      const errorData = await res.text();
      console.error(`Login failed with status ${res.status}:`, errorData);
      return;
    }
    
    const userData = await res.json();
    console.log('Login successful! User data received:');
    console.log(JSON.stringify(userData, null, 2));
    
    // Highlight important fields
    console.log('\nCritical login fields:');
    console.log('- isVerified:', userData.isVerified);
    console.log('- isAuthenticated:', userData.isAuthenticated);
    console.log('- sessionID:', userData.sessionID);
    
  } catch (error) {
    console.error('Login test failed with error:', error);
  }
}

testLogin();