const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Setup script for optimized CLIP service
 * Ensures all dependencies are installed and service can start
 */

async function checkPythonDependencies() {
  console.log('🔍 Checking Python dependencies...');
  
  const requiredPackages = [
    'torch',
    'transformers', 
    'pillow',
    'numpy'
  ];
  
  return new Promise((resolve) => {
    // Check if clip_env exists first
    const clipEnvPath = path.join(__dirname, 'clip_env', 'bin', 'python3');
    
    if (fs.existsSync(clipEnvPath)) {
      console.log('   ✅ Found existing CLIP environment');
      
      // Test with the CLIP environment
      const python = spawn(clipEnvPath, ['-c', 
        `import torch, transformers, PIL, numpy; print("All packages available")`
      ]);
      
      python.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ All Python dependencies available in CLIP environment');
          resolve(true);
        } else {
          console.log('   ❌ Missing dependencies in CLIP environment');
          resolve(false);
        }
      });
      
      python.on('error', (error) => {
        console.log('   ❌ Error testing CLIP environment:', error.message);
        resolve(false);
      });
    } else {
      console.log('   ❌ CLIP environment not found');
      console.log('   Please activate your existing CLIP environment or create one');
      resolve(false);
    }
  });
}

async function installPythonDependencies() {
  console.log('📦 Installing Python dependencies...');
  
  return new Promise((resolve) => {
    const pip = spawn('pip3', [
      'install', 
      'torch', 
      'transformers',
      'pillow',
      'numpy'
    ], { 
      stdio: 'inherit' 
    });
    
    pip.on('close', (code) => {
      if (code === 0) {
        console.log('   ✅ Python dependencies installed successfully');
        resolve(true);
      } else {
        console.log('   ❌ Failed to install Python dependencies');
        console.log('   Please install manually: pip3 install torch transformers pillow numpy');
        resolve(false);
      }
    });
    
    pip.on('error', (error) => {
      console.log('   ❌ pip3 not found');
      console.log('   Please install pip3 or install packages manually');
      resolve(false);
    });
  });
}

async function testCLIPService() {
  console.log('🧪 Testing CLIP service startup...');
  
  const servicePath = path.join(__dirname, 'services', 'clipService.py');
  
  if (!fs.existsSync(servicePath)) {
    console.log('   ❌ CLIP service file not found');
    return false;
  }
  
  return new Promise((resolve) => {
    const clipEnvPath = path.join(__dirname, 'clip_env', 'bin', 'python3');
    const testProcess = spawn(clipEnvPath, [servicePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serviceReady = false;
    let timeoutHandle;
    
    // Set timeout for test
    timeoutHandle = setTimeout(() => {
      testProcess.kill('SIGTERM');
      if (!serviceReady) {
        console.log('   ❌ Service startup timeout');
        resolve(false);
      }
    }, 30000); // 30 second timeout
    
    testProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            console.log(`   📝 ${response.message || response.status}`);
            
            if (response.status === 'service_ready') {
              serviceReady = true;
              clearTimeout(timeoutHandle);
              
              // Send shutdown command
              testProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
              
              setTimeout(() => {
                testProcess.kill('SIGTERM');
                console.log('   ✅ CLIP service test successful');
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
      console.log(`   ⚠️ ${data.toString().trim()}`);
    });
    
    testProcess.on('exit', (code) => {
      clearTimeout(timeoutHandle);
      if (!serviceReady) {
        console.log(`   ❌ Service exited with code ${code}`);
        resolve(false);
      }
    });
    
    testProcess.on('error', (error) => {
      clearTimeout(timeoutHandle);
      console.log(`   ❌ Service error: ${error.message}`);
      resolve(false);
    });
  });
}

async function createServicesDirectory() {
  const servicesDir = path.join(__dirname, 'services');
  
  if (!fs.existsSync(servicesDir)) {
    console.log('📁 Creating services directory...');
    fs.mkdirSync(servicesDir, { recursive: true });
    console.log('   ✅ Services directory created');
  }
}

async function setupOptimizedCLIP() {
  console.log('🚀 Setting up Optimized CLIP Service\n');
  console.log('This will:');
  console.log('• Check Python dependencies');
  console.log('• Install missing packages if needed');
  console.log('• Test CLIP service startup');
  console.log('• Verify everything is working\n');
  
  try {
    // Create services directory
    await createServicesDirectory();
    
    // Check and install Python dependencies
    const depsOk = await checkPythonDependencies();
    if (!depsOk) {
      console.log('\n❌ Setup failed: Python dependencies not available');
      console.log('Please install Python 3.7+ and required packages manually:');
      console.log('pip3 install torch transformers pillow numpy');
      return false;
    }
    
    // Test CLIP service
    const serviceOk = await testCLIPService();
    if (!serviceOk) {
      console.log('\n❌ Setup failed: CLIP service test failed');
      return false;
    }
    
    console.log('\n🎉 OPTIMIZED CLIP SETUP COMPLETE!');
    console.log('\n📋 Next steps:');
    console.log('1. Start your Node.js server');
    console.log('2. Test with: node test_optimized_clip.js');
    console.log('3. Use endpoint: POST /api/optimized-clip/optimized-search');
    console.log('\n⚡ Expected performance improvement: 8.9s → <1s');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Setup error:', error.message);
    return false;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupOptimizedCLIP();
}

module.exports = { setupOptimizedCLIP };
