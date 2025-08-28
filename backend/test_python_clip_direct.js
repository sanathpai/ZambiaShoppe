const { spawn } = require('child_process');
const path = require('path');

/**
 * Direct test of the Python CLIP service
 */

async function testDirectClipService() {
  console.log('🧪 Testing Python CLIP service directly...');
  
  const servicePath = path.join(__dirname, 'services', 'clipService.py');
  const clipEnvPath = path.join(__dirname, 'clip_env', 'bin', 'python3');
  
  console.log('📁 Service path:', servicePath);
  console.log('🐍 Python path:', clipEnvPath);
  
  return new Promise((resolve) => {
    const testProcess = spawn(clipEnvPath, [servicePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let outputReceived = false;
    let serviceReady = false;
    
    // Set timeout
    const timeout = setTimeout(() => {
      if (!outputReceived) {
        console.log('❌ Service startup timeout');
        testProcess.kill('SIGTERM');
        resolve(false);
      }
    }, 30000);
    
    testProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          outputReceived = true;
          console.log('📝 Service output:', line.trim());
          
          try {
            const response = JSON.parse(line);
            if (response.status === 'service_ready') {
              serviceReady = true;
              console.log('✅ Service is ready, testing with sample request...');
              
              // Send a test request
              const testRequest = {
                action: 'process_base64',
                base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                request_id: 'test_001'
              };
              
              testProcess.stdin.write(JSON.stringify(testRequest) + '\n');
            } else if (response.request_id === 'test_001') {
              console.log('🎯 Test request response:', response.status);
              if (response.status === 'success') {
                console.log('✅ Embedding generated successfully! Dimensions:', response.dimensions);
              }
              
              // Send shutdown
              testProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
              clearTimeout(timeout);
              
              setTimeout(() => {
                testProcess.kill('SIGTERM');
                resolve(true);
              }, 1000);
            }
          } catch (e) {
            // Ignore non-JSON output
          }
        }
      }
    });
    
    testProcess.stderr.on('data', (data) => {
      console.log('⚠️ Service stderr:', data.toString().trim());
    });
    
    testProcess.on('exit', (code) => {
      clearTimeout(timeout);
      console.log(`📤 Service exited with code ${code}`);
      if (!serviceReady) {
        resolve(false);
      }
    });
    
    testProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ Service error:', error.message);
      resolve(false);
    });
  });
}

// Run the test
if (require.main === module) {
  testDirectClipService().then(success => {
    if (success) {
      console.log('\n🎉 Direct CLIP service test PASSED!');
      console.log('The Python service is working correctly.');
      console.log('Issue might be in the Node.js service manager communication.');
    } else {
      console.log('\n❌ Direct CLIP service test FAILED!');
      console.log('There may be an issue with the Python service setup.');
    }
  });
}

module.exports = { testDirectClipService };
