// Service Worker for QuickSync application
const CACHE_NAME = 'quicksync-cache-v1';
const CHANNELS = new Map(); // Store active broadcast channels
const ROOMS = new Map();    // Store room data
const USERS = new Map();    // Store connected users by client ID
let messageCounter = 0;     // To ensure unique message IDs

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker');
  self.skipWaiting(); // Force activation
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/main.js',
        '/assets/index.css'
        // Add other assets to cache as needed
      ]);
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
  return self.clients.claim();
});

// Helper function to broadcast a message to all clients in a room
const broadcastToRoom = async (roomId, eventName, data) => {
  const roomClients = ROOMS.get(roomId) || [];
  const clients = await self.clients.matchAll();
  
  clients.forEach(client => {
    if (roomClients.includes(client.id)) {
      client.postMessage({
        type: eventName,
        data: data,
        roomId: roomId,
        messageId: `msg_${Date.now()}_${messageCounter++}`
      });
    }
  });
};

// Process messages from clients
self.addEventListener('message', async (event) => {
  const { type, data, roomId, userId } = event.data;
  const clientId = event.source.id;
  
  switch (type) {
    case 'joinRoom':
      // Add client to room
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
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
      
      broadcastToRoom(roomId, 'roomUsers', roomUsers);
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
        
        broadcastToRoom(roomId, 'roomUsers', roomUsers);
      }
      break;
      
    case 'message':
      // Add timestamp if not provided
      const message = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      // Store message in room history (simplified - in real app, use IndexedDB)
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
      }
      
      // Broadcast message to all clients in the room
      broadcastToRoom(roomId, 'message', message);
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