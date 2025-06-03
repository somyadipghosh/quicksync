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
      
      // First check if there's a controller already (page was loaded with SW active)
      if (navigator.serviceWorker.controller) {
        console.log('Using existing service worker controller');
        this._sw = navigator.serviceWorker.controller;
        this._isRegistered = true;
        this._setupMessageListener();
        this._processQueuedMessages();
        return registration;
      }
      
      // Get the active service worker
      if (registration.active) {
        this._sw = registration.active;
        this._isRegistered = true;
        this._setupMessageListener();
        this._processQueuedMessages();
        
        // Force clients to use this SW right now
        // Note: this will cause a refresh in some browsers
        registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
      } else {
        // Wait for the service worker to become active
        return new Promise((resolve) => {
          const onStateChange = () => {
            console.log('Controller change detected');
            this._sw = navigator.serviceWorker.controller;
            if (this._sw) {
              this._isRegistered = true;
              this._setupMessageListener();
              this._processQueuedMessages();
              navigator.serviceWorker.removeEventListener('controllerchange', onStateChange);
              resolve(registration);
            }
          };
          
          navigator.serviceWorker.addEventListener('controllerchange', onStateChange);
        });
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
  }  // Handle incoming messages from the Service Worker
  _onMessage(event) {
    try {
      if (!event || !event.data) {
        console.warn('[SWMessenger] Received empty or invalid message event');
        return;
      }
      
      const { type, data } = event.data;
      
      if (!type) {
        console.warn('[SWMessenger] Received message with no type');
        return;
      }
      
      console.log(`[SWMessenger] Received message of type: ${type}`);
      
      if (this._messageHandlers.has(type)) {
        const handlers = this._messageHandlers.get(type);
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (handlerError) {
            console.error(`[SWMessenger] Error in handler for ${type}:`, handlerError);
          }
        });
      } else {
        console.warn(`[SWMessenger] No handler for message type: ${type}`);
      }
    } catch (error) {
      console.error('[SWMessenger] Error processing message:', error);
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
  }  // Send a message to the Service Worker
  sendMessage(type, data = {}, roomId = null) {
    if (!this._isRegistered || !this._sw) {
      console.warn(`[SWMessenger] Tried to send message of type ${type} before SW is ready`);
      // Queue message for when SW is registered
      this._messageQueue.push({ type, data, roomId });
      return Promise.reject(new Error('Service Worker not registered yet'));
    }
    
    try {
      // Make sure we have a valid controller
      if (!navigator.serviceWorker.controller) {
        console.warn('[SWMessenger] ServiceWorker controller is missing, attempting to recover');
        
        // Try to re-establish connection
        if (this._sw) {
          // Use the SW instance we already have
        } else if (navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(registration => {
            this._sw = registration.active;
            // Queue this message for retry
            this._messageQueue.push({ type, data, roomId });
          });
        }
        
        return Promise.reject(new Error('ServiceWorker controller not available'));
      }
      
      // Construct the message
      const message = {
        type,
        data: data || {}, // Ensure data is at least an empty object
        roomId,
        clientId: this._clientId,
        timestamp: Date.now()
      };
      
      console.log(`[SWMessenger] Sending message of type: ${type}`);
      this._sw.postMessage(message);
      return Promise.resolve();
    } catch (error) {
      console.error(`[SWMessenger] Error sending message of type ${type}:`, error);
      return Promise.reject(error);
    }
  }

  // Check if the Service Worker is active
  isActive() {
    return this._isRegistered && !!this._sw;
  }
}

// Create a singleton instance
const swMessenger = new ServiceWorkerMessenger();

export default swMessenger;
