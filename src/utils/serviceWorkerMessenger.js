// Service Worker communication helper
class ServiceWorkerMessenger {
  constructor() {
    this._sw = null;
    this._isRegistered = false;
    this._messageHandlers = new Map();
    this._clientId = null;
    this._messageQueue = [];
    
    // Bind methods
    this.sendMessage = this.sendMessage.bind(this);
    this._onMessage = this._onMessage.bind(this);
  }

  // Register the service worker
  async register() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported in this browser');
    }

    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registration successful with scope:', registration.scope);
      
      // Get the active service worker
      if (registration.active) {
        this._sw = registration.active;
        this._isRegistered = true;
        this._setupMessageListener();
        this._processQueuedMessages();
      } else {
        // Wait for the service worker to become active
        const onStateChange = () => {
          if (registration.active) {
            this._sw = registration.active;
            this._isRegistered = true;
            this._setupMessageListener();
            this._processQueuedMessages();
            navigator.serviceWorker.removeEventListener('controllerchange', onStateChange);
          }
        };
        
        navigator.serviceWorker.addEventListener('controllerchange', onStateChange);
      }
      
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      throw error;
    }
  }

  // Set up the message listener
  _setupMessageListener() {
    navigator.serviceWorker.addEventListener('message', this._onMessage);
    
    // Generate a client ID to identify this browser tab
    this._clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Process any queued messages once the SW is ready
  _processQueuedMessages() {
    if (this._messageQueue.length > 0 && this._isRegistered) {
      this._messageQueue.forEach(msg => {
        this.sendMessage(msg.type, msg.data, msg.roomId);
      });
      this._messageQueue = [];
    }
  }

  // Handle incoming messages from the Service Worker
  _onMessage(event) {
    const { type, data } = event.data;
    
    if (this._messageHandlers.has(type)) {
      const handlers = this._messageHandlers.get(type);
      handlers.forEach(handler => handler(data));
    }
  }

  // Register a handler for a specific message type
  on(messageType, callback) {
    if (!this._messageHandlers.has(messageType)) {
      this._messageHandlers.set(messageType, []);
    }
    
    this._messageHandlers.get(messageType).push(callback);
    return this;
  }

  // Remove a handler for a specific message type
  off(messageType, callback) {
    if (this._messageHandlers.has(messageType)) {
      const handlers = this._messageHandlers.get(messageType);
      const index = handlers.indexOf(callback);
      
      if (index !== -1) {
        handlers.splice(index, 1);
      }
      
      if (handlers.length === 0) {
        this._messageHandlers.delete(messageType);
      }
    }
    
    return this;
  }

  // Send a message to the Service Worker
  sendMessage(type, data = {}, roomId = null) {
    if (!this._isRegistered) {
      // Queue message for when SW is registered
      this._messageQueue.push({ type, data, roomId });
      return Promise.reject(new Error('Service Worker not registered yet'));
    }
    
    const message = {
      type,
      data,
      roomId,
      clientId: this._clientId,
      timestamp: Date.now()
    };
    
    return this._sw.postMessage(message);
  }

  // Check if the Service Worker is active
  isActive() {
    return this._isRegistered && !!this._sw;
  }
}

// Create a singleton instance
const swMessenger = new ServiceWorkerMessenger();

export default swMessenger;
