const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * Manages a persistent Python CLIP service for fast embedding generation
 * Eliminates the overhead of spawning new processes for each request
 */
class CLIPServiceManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isReady = false;
    this.requestQueue = [];
    this.currentRequestId = 0;
    this.pendingRequests = new Map();
    this.serviceStarting = false;
    
    // Start the service immediately
    this.startService();
  }
  
  async startService() {
    if (this.serviceStarting || this.isReady) {
      return;
    }
    
    this.serviceStarting = true;
    console.log('🚀 Starting persistent CLIP service...');
    
    try {
      const servicePath = path.join(__dirname, 'clipService.py');
      
      // Spawn the Python service using the clip_env environment
      const pythonPath = path.join(__dirname, '..', 'clip_env', 'bin', 'python3');
      this.process = spawn(pythonPath, [servicePath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle stdout (responses from Python service)
      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            this.handleServiceResponse(response);
          } catch (e) {
            console.error('❌ Failed to parse CLIP service response:', line);
          }
        }
      });
      
      // Handle stderr
      this.process.stderr.on('data', (data) => {
        console.error('🔍 CLIP service stderr:', data.toString());
      });
      
      // Handle process exit
      this.process.on('exit', (code) => {
        console.log(`📤 CLIP service exited with code ${code}`);
        this.isReady = false;
        this.serviceStarting = false;
        
        // Reject all pending requests
        for (const [requestId, { reject }] of this.pendingRequests) {
          reject(new Error('CLIP service exited unexpectedly'));
        }
        this.pendingRequests.clear();
        
        // Emit event for potential restart logic
        this.emit('serviceExit', code);
      });
      
      // Handle process error
      this.process.on('error', (error) => {
        console.error('❌ CLIP service error:', error);
        this.isReady = false;
        this.serviceStarting = false;
        this.emit('serviceError', error);
      });
      
    } catch (error) {
      console.error('❌ Failed to start CLIP service:', error);
      this.serviceStarting = false;
      throw error;
    }
  }
  
  handleServiceResponse(response) {
    const { status, message, request_id } = response;
    
    switch (status) {
      case 'initializing':
        console.log(`🔄 CLIP service: ${message}`);
        break;
        
      case 'ready':
        console.log(`✅ CLIP service: ${message}`);
        break;
        
      case 'service_ready':
        console.log(`🎯 ${message}`);
        this.isReady = true;
        this.serviceStarting = false;
        this.emit('serviceReady');
        this.processRequestQueue();
        break;
        
      case 'success':
      case 'error':
        // Handle request responses
        if (request_id && this.pendingRequests.has(request_id)) {
          const { resolve, reject } = this.pendingRequests.get(request_id);
          this.pendingRequests.delete(request_id);
          
          if (status === 'success') {
            resolve(response);
          } else {
            reject(new Error(response.message || 'CLIP processing failed'));
          }
        }
        break;
        
      case 'pong':
        // Health check response
        if (request_id && this.pendingRequests.has(request_id)) {
          const { resolve } = this.pendingRequests.get(request_id);
          this.pendingRequests.delete(request_id);
          resolve(response);
        }
        break;
        
      default:
        console.log(`🔍 CLIP service response:`, response);
    }
  }
  
  processRequestQueue() {
    while (this.requestQueue.length > 0 && this.isReady) {
      const queuedRequest = this.requestQueue.shift();
      this.sendRequest(queuedRequest);
    }
  }
  
  sendRequest(request) {
    if (!this.process || !this.isReady) {
      this.requestQueue.push(request);
      return;
    }
    
    try {
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);
    } catch (error) {
      console.error('❌ Failed to send request to CLIP service:', error);
      
      // Reject the pending request if it exists
      if (request.request_id && this.pendingRequests.has(request.request_id)) {
        const { reject } = this.pendingRequests.get(request.request_id);
        this.pendingRequests.delete(request.request_id);
        reject(error);
      }
    }
  }
  
  /**
   * Process an image file and get CLIP embedding
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Array>} - CLIP embedding array
   */
  async processImage(imagePath) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.currentRequestId}`;
      
      const request = {
        action: 'process_image',
        image_path: imagePath,
        request_id: requestId
      };
      
      // Store the promise resolvers
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Send the request
      this.sendRequest(request);
      
      // Set timeout for request (longer for first requests while model loads)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('CLIP processing timeout'));
        }
      }, 10000); // 10 second timeout (reduce from 60s)
    });
  }
  
  /**
   * Process a base64 image and get CLIP embedding
   * @param {string} base64Data - Base64 encoded image data
   * @returns {Promise<Array>} - CLIP embedding array
   */
  async processBase64Image(base64Data) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.currentRequestId}`;
      
      const request = {
        action: 'process_base64',
        base64_data: base64Data,
        request_id: requestId
      };
      
      // Store the promise resolvers
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Send the request
      this.sendRequest(request);
      
      // Set timeout for request (longer for first requests while model loads)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('CLIP processing timeout'));
        }
      }, 10000); // 10 second timeout (reduce from 60s)
    });
  }
  
  /**
   * Health check for the service
   * @returns {Promise<boolean>} - True if service is responsive
   */
  async ping() {
    return new Promise((resolve, reject) => {
      const requestId = `ping_${++this.currentRequestId}`;
      
      const request = {
        action: 'ping',
        request_id: requestId
      };
      
      this.pendingRequests.set(requestId, { 
        resolve: () => resolve(true), 
        reject: () => resolve(false) 
      });
      
      this.sendRequest(request);
      
      // Short timeout for ping
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve(false);
        }
      }, 5000);
    });
  }
  
  /**
   * Gracefully shutdown the service
   */
  async shutdown() {
    if (this.process) {
      console.log('🛑 Shutting down CLIP service...');
      
      // Send shutdown command
      try {
        this.process.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
      } catch (e) {
        // Ignore write errors during shutdown
      }
      
      // Give it a moment to shutdown gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force kill if still running
      if (!this.process.killed) {
        this.process.kill('SIGTERM');
      }
      
      this.process = null;
      this.isReady = false;
    }
  }
  
  /**
   * Check if service is ready to accept requests
   * @returns {boolean}
   */
  isServiceReady() {
    return this.isReady;
  }
  
  /**
   * Wait for service to be ready
   * @param {number} timeout - Timeout in milliseconds (default: 30000)
   * @returns {Promise<boolean>} - True if service becomes ready
   */
  async waitForReady(timeout = 30000) {
    if (this.isReady) {
      return true;
    }
    
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.removeListener('serviceReady', onReady);
        resolve(false);
      }, timeout);
      
      const onReady = () => {
        clearTimeout(timeoutHandle);
        resolve(true);
      };
      
      this.once('serviceReady', onReady);
    });
  }
}

// Create a singleton instance
const clipServiceManager = new CLIPServiceManager();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down CLIP service...');
  await clipServiceManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down CLIP service...');
  await clipServiceManager.shutdown();
  process.exit(0);
});

module.exports = clipServiceManager;
