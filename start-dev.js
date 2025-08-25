#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

console.log('🚀 Starting Telkom HSI BrightAI Application...');
console.log('================================================');

// Function to check if port is in use
function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => {
                resolve(false); // Port is free
            });
            server.close();
        });
        server.on('error', () => {
            resolve(true); // Port is in use
        });
    });
}

// Function to start a service
function startService(name, directory, command, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Starting ${name}...`);
        
        const child = spawn(command, args, {
            cwd: path.join(__dirname, directory),
            stdio: ['inherit', 'inherit', 'inherit'],
            shell: process.platform === 'win32'
        });

        child.on('error', (error) => {
            console.error(`❌ Error starting ${name}:`, error);
            reject(error);
        });

        // Give it a moment to start
        setTimeout(() => {
            if (!child.killed) {
                console.log(`✅ ${name} started successfully`);
                resolve(child);
            }
        }, 3000);
    });
}

async function main() {
    try {
        // Check and start backend
        console.log('🔍 Checking Backend (Port 3001)...');
        const backendInUse = await checkPort(3001);
        let backendProcess = null;
        
        if (!backendInUse) {
            backendProcess = await startService('Backend', 'backend', 'npm', ['start']);
        } else {
            console.log('✅ Backend is already running on port 3001');
        }

        // Wait a bit for backend to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check and start frontend
        console.log('🔍 Checking Frontend (Port 3000)...');
        const frontendInUse = await checkPort(3000);
        let frontendProcess = null;
        
        if (!frontendInUse) {
            frontendProcess = await startService('Frontend', 'frontend', 'npm', ['start']);
        } else {
            console.log('✅ Frontend is already running on port 3000');
        }

        console.log('================================================');
        console.log('🎉 Application Status:');
        console.log('Backend:  http://localhost:3001');
        console.log('Frontend: http://localhost:3000');
        console.log('================================================');
        console.log('📋 Login Credentials:');
        console.log('Email: admin123@gmail.com');
        console.log('Password: Admin123');
        console.log('================================================');
        console.log('⚠️  To stop the application, press Ctrl+C');
        console.log('================================================');

        // Handle cleanup on exit
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down services...');
            if (backendProcess) backendProcess.kill();
            if (frontendProcess) frontendProcess.kill();
            process.exit(0);
        });

        // Keep the process alive
        process.stdin.resume();
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

main();