#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');

// Get network interfaces
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // Skip over internal (localhost) and non-IPv4 addresses
      if (!interface.internal && interface.family === 'IPv4') {
        addresses.push(interface.address);
      }
    }
  }
  
  return addresses;
}

console.log('🚀 Starting Telkom HSI BrightAI Development Environment...\n');

// Start backend
console.log('📡 Starting Backend Server...');
const backend = spawn('npm', ['start'], { 
  cwd: './backend',
  stdio: 'inherit',
  shell: true 
});

// Wait a bit for backend to start
setTimeout(() => {
  console.log('\n🎨 Starting Frontend Server...');
  
  // Start frontend
  const frontend = spawn('npm', ['start'], { 
    cwd: './frontend',
    stdio: 'inherit',
    shell: true 
  });

  // Display access URLs
  setTimeout(() => {
    const networkIPs = getNetworkInterfaces();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 BrightAI Development Servers are Running!');
    console.log('='.repeat(60));
    
    console.log('\n📱 Frontend Access URLs:');
    console.log('   Local:    http://localhost:3000');
    console.log('   Local:    http://127.0.0.1:3000');
    if (networkIPs.length > 0) {
      networkIPs.forEach(ip => {
        console.log(`   Network:  http://${ip}:3000`);
      });
    }
    
    console.log('\n🔧 Backend API URLs:');
    console.log('   Local:    http://localhost:3001');
    console.log('   Health:   http://localhost:3001/api/telkom/health');
    if (networkIPs.length > 0) {
      networkIPs.forEach(ip => {
        console.log(`   Network:  http://${ip}:3001`);
      });
    }
    
    console.log('\n📋 Available Credentials:');
    console.log('   Admin:  admin / admin123');
    console.log('   User:   user / user123');
    
    console.log('\n💡 Tips:');
    console.log('   - Use Ctrl+C to stop both servers');
    console.log('   - Check browser console for any issues');
    console.log('   - Backend must be running for frontend to work');
    
    console.log('\n' + '='.repeat(60));
  }, 3000);

  frontend.on('exit', () => {
    console.log('\n🔴 Frontend server stopped');
    process.exit();
  });

}, 2000);

backend.on('exit', () => {
  console.log('\n🔴 Backend server stopped');
  process.exit();
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down servers...');
  backend.kill();
  process.exit();
});