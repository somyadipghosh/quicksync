// Service Worker for QuickSync application
const CACHE_NAME = 'quicksync-cache-v1';
const CHANNELS = new Map(); // Store active broadcast channels
const ROOMS = new Map();    // Store room data
const USERS = new Map();    // Store connected users by client ID
let messageCounter = 0;     // To ensure unique message IDs

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker', new Date().toISOString());
  
  // Force the waiting Service Worker to become the active Service Worker
  self.skipWaiting(); // Force activation
  
  // Cache essential files
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll([
        '/',
        '/index.html',
        '/main.js',
        '/assets/index.css'
        // Add other assets to cache as needed
      ]);
    }).catch(err => {
      console.error('[Service Worker] Cache failed:', err);
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  
  // Claim any clients that loaded prior to the service worker being ready
  // This ensures the SW controls all clients immediately
  console.log('[Service Worker] Claiming all clients');
  return self.clients.claim();
});

// Helper function to broadcast a message to all clients in a room
const broadcastToRoom = async (roomId, eventName, data) => {
  const roomClients = ROOMS.get(roomId) || [];
  const clients = await self.clients.matchAll();
  
  console.log(`[SW] Broadcasting ${eventName} to room ${roomId}, clients: ${roomClients.length}`);
  
  let broadcastCount = 0;
  clients.forEach(client => {
    if (roomClients.includes(client.id)) {
      const message = {
        type: eventName,
        data: data,
        roomId: roomId,
        messageId: `msg_${Date.now()}_${messageCounter++}`
      };
      
      client.postMessage(message);
      broadcastCount++;
      console.log(`[SW] Sent ${eventName} to client ${client.id}`);
    }
  });
  
  console.log(`[SW] Broadcast complete. Sent to ${broadcastCount} clients`);
};

// Store room messages
const ROOM_MESSAGES = new Map(); // Store messages by room ID

// Process messages from clients
self.addEventListener('message', async (event) => {
  const { type, data, roomId, userId } = event.data;
  const clientId = event.source.id;
  
  switch (type) {
    case 'joinRoom':
      // Add client to room
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
        // Initialize message storage for this room if it doesn't exist
        if (!ROOM_MESSAGES.has(roomId)) {
          ROOM_MESSAGES.set(roomId, []);
        }
      }
      
      const roomClients = ROOMS.get(roomId);
      if (!roomClients.includes(clientId)) {
        roomClients.push(clientId);
        ROOMS.set(roomId, roomClients);
      }
      
      // Store user data
      USERS.set(clientId, {
        userId: data.user.id,
        name: data.user.name,
        roomId: roomId,
        joinedAt: Date.now()
      });
      
      console.log(`[SW] User ${data.user.name} joined room ${roomId}`);
        // Notify all clients in the room about updated user list
      const roomUsers = [...USERS.values()]
        .filter(user => user.roomId === roomId)
        .map(({ userId, name }) => ({ id: userId, name }));
      
      console.log(`[SW] Broadcasting updated user list for room ${roomId}:`, roomUsers);
      broadcastToRoom(roomId, 'roomUsers', roomUsers);
      
      // Also send directly to the newly joined client for immediate UI update
      event.source.postMessage({
        type: 'roomUsers',
        data: roomUsers,
        roomId: roomId
      });
      
      // Send previously stored messages to the newly joined client
      const previousMessages = ROOM_MESSAGES.get(roomId) || [];
      console.log(`[SW] Sending ${previousMessages.length} previous messages to new client`);
      event.source.postMessage({
        type: 'previousMessages',
        data: previousMessages,
        roomId: roomId
      });
      break;
      
    case 'leaveRoom':
      if (ROOMS.has(roomId)) {
        const updatedClients = ROOMS.get(roomId).filter(id => id !== clientId);
        
        if (updatedClients.length > 0) {
          ROOMS.set(roomId, updatedClients);
        } else {
          ROOMS.delete(roomId);
        }
      }
      
      // Remove user data
      const userData = USERS.get(clientId);
      if (userData) {
        USERS.delete(clientId);
      }
        // Notify remaining clients about updated user list
      if (ROOMS.has(roomId)) {
        const roomUsers = [...USERS.values()]
          .filter(user => user.roomId === roomId)
          .map(({ userId, name }) => ({ id: userId, name }));
        
        console.log(`[SW] User left room ${roomId}, broadcasting updated user list:`, roomUsers);
        broadcastToRoom(roomId, 'roomUsers', roomUsers);
      } else {
        console.log(`[SW] Last user left room ${roomId}, room has been removed`);
      }
      break;
    case 'message':
      // Add timestamp if not provided
      const message = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      console.log(`[SW] Received message: ${JSON.stringify(message)}`);
      
      // Store message in room history 
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
      }
      
      // Initialize message storage for this room if needed
      if (!ROOM_MESSAGES.has(roomId)) {
        ROOM_MESSAGES.set(roomId, []);
      }
      
      // Store the message in the room history (limit to last 100 messages)
      const roomMessages = ROOM_MESSAGES.get(roomId);
      roomMessages.push(message);
      if (roomMessages.length > 100) {
        roomMessages.shift(); // Remove oldest message if more than 100
      }
      ROOM_MESSAGES.set(roomId, roomMessages);
      
      console.log(`[SW] Storing message in room ${roomId}, total: ${roomMessages.length}`);
        // Broadcast message to all clients in the room
      broadcastToRoom(roomId, 'message', message);
      
      // For debugging, also send directly to the sender to confirm receipt
      event.source.postMessage({
        type: 'message',
        data: message,
        roomId: roomId,
        messageId: `msg_${Date.now()}_${messageCounter++}`
      });
      break;
      
    case 'shareDocument':
      broadcastToRoom(roomId, 'documentShared', data);
      break;
      
    case 'endRoom':
      if (ROOMS.has(roomId)) {
        broadcastToRoom(roomId, 'roomEnded', { roomId });
        
        // Clear user data for this room
        for (const [clientId, userData] of USERS.entries()) {
          if (userData.roomId === roomId) {
            USERS.delete(clientId);
          }
        }
        
        // Remove room
        ROOMS.delete(roomId);
      }
      break;
        case 'ping':
      // Send pong directly to the client that sent the ping
      event.source.postMessage({
        type: 'pong',
        timestamp: Date.now()
      });
      break;
        case 'requestRoomUsers':
      if (roomId) {
        const roomUsers = [...USERS.values()]
          .filter(user => user.roomId === roomId)
          .map(({ userId, name }) => ({ id: userId, name }));
        
        console.log(`[SW] Responding to request for room ${roomId} users:`, roomUsers);
        event.source.postMessage({
          type: 'roomUsers',
          data: roomUsers,
          roomId: roomId
        });
      }
      break;
      
    case 'CLAIM_CLIENTS':
      // Force claim all clients
      console.log('[SW] Claiming all clients');
      self.clients.claim().then(() => {
        console.log('[SW] All clients claimed');
      });
      break;
  }
});

// Handle fetch events - network first with cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response to store in cache
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          // Only cache same-origin resources
          if (event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, responseToCache);
          }
        });
        
        return response;
      })
      .catch(() => {
        // If network fails, try to return from cache
        return caches.match(event.request);
      })
  );
});