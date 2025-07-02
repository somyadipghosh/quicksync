// Service Worker for QuickSync application
const CACHE_NAME = 'quicksync-cache-v1';
const CHANNELS = new Map(); // Store active broadcast channels
const ROOMS = new Map();    // Store room data
const USERS = new Map();    // Store connected users by client ID
let messageCounter = 0;     // To ensure unique message IDs

// Helper function to generate unique IDs for messages and documents
const generateUniqueId = (prefix = 'msg', userId = null) => {
  return `${prefix}_${userId || 'system'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

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
// excludeClientId parameter allows us to skip sending to the originating client
const broadcastToRoom = async (roomId, eventName, data, excludeClientId = null) => {
  const roomClients = ROOMS.get(roomId) || [];
  const clients = await self.clients.matchAll();
  
  console.log(`[SW] Broadcasting ${eventName} to room ${roomId}`);
  console.log(`[SW] Room clients: [${roomClients.join(', ')}]`);
  console.log(`[SW] All clients: [${clients.map(c => c.id).join(', ')}]`);
  console.log(`[SW] Excluding client: ${excludeClientId || 'none'}`);
  
  let broadcastCount = 0;
  clients.forEach(client => {
    console.log(`[SW] Checking client ${client.id}: inRoom=${roomClients.includes(client.id)}, excluded=${client.id === excludeClientId}`);
    
    // Send to clients that are in the room AND are not the excluded client
    if (roomClients.includes(client.id) && client.id !== excludeClientId) {
      const message = {
        type: eventName,
        data: data,
        roomId: roomId,
        messageId: `msg_${Date.now()}_${messageCounter++}`
      };
      
      try {
        client.postMessage(message);
        broadcastCount++;
        console.log(`[SW] ✅ Sent ${eventName} to client ${client.id}`);
      } catch (error) {
        console.error(`[SW] ❌ Failed to send ${eventName} to client ${client.id}:`, error);
      }
    } else {
      console.log(`[SW] ⏭️  Skipped client ${client.id} (not in room or excluded)`);
    }
  });
  
  console.log(`[SW] Broadcast complete. Sent to ${broadcastCount} clients out of ${clients.length} total clients`);
  
  if (broadcastCount === 0) {
    console.warn(`[SW] ⚠️  No clients received the broadcast! This might indicate an issue.`);
    console.log(`[SW] Room ${roomId} has clients: [${roomClients.join(', ')}]`);
    console.log(`[SW] Available clients: [${clients.map(c => c.id).join(', ')}]`);
  }
};

// Store room messages
const ROOM_MESSAGES = new Map(); // Store messages by room ID

// Heartbeat tracking - maps clientId to last heartbeat time
const CLIENT_HEARTBEATS = new Map(); 

// Periodic check for inactive clients (every 60 seconds)
setInterval(async () => {
  console.log('[SW] Running inactive client check...');
  const now = Date.now();
  const inactiveTimeout = 3 * 60 * 1000; // 3 minutes
  
  // Get all connected clients
  const clients = await self.clients.matchAll();
  const activeClientIds = new Set(clients.map(client => client.id));
  
  // Find clients that haven't sent a heartbeat recently
  const inactiveClients = [];
  for (const [clientId, lastHeartbeat] of CLIENT_HEARTBEATS.entries()) {
    // Client is inactive if: no heartbeat for 3 minutes OR client is not in the active client list
    if ((now - lastHeartbeat > inactiveTimeout) || !activeClientIds.has(clientId)) {
      inactiveClients.push(clientId);
    }
  }
  
  // Clean up inactive clients
  for (const clientId of inactiveClients) {
    console.log(`[SW] Client ${clientId} is inactive, cleaning up...`);
    CLIENT_HEARTBEATS.delete(clientId);
    
    // Get user data before removing
    const userData = USERS.get(clientId);
    if (userData) {
      const { roomId } = userData;
      
      // Remove from rooms
      if (roomId && ROOMS.has(roomId)) {
        ROOMS.set(roomId, ROOMS.get(roomId).filter(id => id !== clientId));
        console.log(`[SW] Removed inactive client ${clientId} from room ${roomId}`);
        
        // Update room users list for remaining clients
        const roomUsers = [...USERS.values()]
          .filter(user => user.roomId === roomId)
          .map(({ userId, name, isCreator }) => ({ id: userId, name, isCreator }));
          
        broadcastToRoom(roomId, 'roomUsers', roomUsers);
      }
      
      // Remove user data
      USERS.delete(clientId);
    }
  }
  
  // Clean up empty rooms
  for (const [roomId, clients] of ROOMS.entries()) {
    if (clients.length === 0) {
      console.log(`[SW] Room ${roomId} is empty, removing...`);
      ROOMS.delete(roomId);
    }
  }
}, 60000); // Every 60 seconds

// Process messages from clients
self.addEventListener('message', async (event) => {
  const { type, data, roomId, userId } = event.data;
  const clientId = event.source.id;
  
  switch (type) {
    case 'joinRoom':
      console.log(`[SW] Join room request: Client ${clientId} wants to join room ${roomId}`);
      console.log(`[SW] User data:`, data.user);
      
      // Add client to room
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
        // Initialize message storage for this room if it doesn't exist
        if (!ROOM_MESSAGES.has(roomId)) {
          ROOM_MESSAGES.set(roomId, []);
        }
        console.log(`[SW] Created new room: ${roomId}`);
      }
      
      const roomClients = ROOMS.get(roomId);
      if (!roomClients.includes(clientId)) {
        roomClients.push(clientId);
        ROOMS.set(roomId, roomClients);
        console.log(`[SW] Added client ${clientId} to room ${roomId}. Room now has clients: [${roomClients.join(', ')}]`);
      } else {
        console.log(`[SW] Client ${clientId} already in room ${roomId}`);
      }
      
      // Check if we already have this user (by userId) in another browser/tab in this room
      const existingUser = [...USERS.entries()]
        .find(([_, userData]) => 
          userData.userId === data.user.id && 
          userData.roomId === roomId
        );
        
      if (existingUser) {
        console.log(`[SW] User ${data.user.name} already in room ${roomId}, updating client ID from ${existingUser[0]} to ${clientId}`);
        // Remove the old entry
        USERS.delete(existingUser[0]);
        
        // Also remove old client from room clients if it exists
        const oldClientIndex = roomClients.indexOf(existingUser[0]);
        if (oldClientIndex > -1) {
          roomClients.splice(oldClientIndex, 1);
          console.log(`[SW] Removed old client ${existingUser[0]} from room clients`);
        }
      }
      
      // Store user data with proper structure
      USERS.set(clientId, {
        userId: data.user.id,
        name: data.user.name,
        roomId: roomId,
        joinedAt: Date.now(),
        isCreator: data.user.isRoomCreator || data.user.isCreator || false
      });
      
      console.log(`[SW] User ${data.user.name} (${data.user.id}) joined room ${roomId}`);
      console.log(`[SW] Current users in system:`, [...USERS.entries()].map(([cId, userData]) => `${cId}: ${userData.name} in ${userData.roomId}`));
        // Notify all clients in the room about updated user list
      const roomUsers = [...USERS.values()]
        .filter(user => user.roomId === roomId)
        .map(({ userId, name, isCreator }) => ({ id: userId, name, isCreator }));
      
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
      const userId = userData?.userId;
      if (userData) {
        USERS.delete(clientId);
      }
      
      // Check if the same user is still in the room from other browsers/tabs
      const userStillInRoom = userId && [...USERS.values()]
        .some(user => user.userId === userId && user.roomId === roomId);
        
      if (userStillInRoom) {
        console.log(`[SW] User ${userId} left with client ${clientId} but still present in room ${roomId} from another client`);
      } else if (userId) {
        console.log(`[SW] User ${userId} completely left room ${roomId}`);
      }
        
      // Notify remaining clients about updated user list
      if (ROOMS.has(roomId)) {
        // Create a set to track unique user IDs we've already processed
        const processedUserIds = new Set();
        const roomUsers = [...USERS.values()]
          .filter(user => {
            if (user.roomId === roomId && !processedUserIds.has(user.userId)) {
              processedUserIds.add(user.userId);
              return true;
            }
            return false;
          })
          .map(({ userId, name, isCreator }) => ({ id: userId, name, isCreator }));
        
        console.log(`[SW] User left room ${roomId}, broadcasting updated user list:`, roomUsers);
        broadcastToRoom(roomId, 'roomUsers', roomUsers);
      } else {
        console.log(`[SW] Last user left room ${roomId}, room has been removed`);
      }
      break;    case 'message':
      console.log(`[SW] ====== MESSAGE HANDLING START ======`);
      console.log(`[SW] Received message from client ${clientId} for room ${roomId}`);
      console.log(`[SW] Message data:`, data);
      
      // Add timestamp if not provided and ensure ID exists
      const message = {
        ...data,
        id: data.id || generateUniqueId('msg', data.userId),
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      console.log(`[SW] Processed message:`, message);
      
      // Store message in room history 
      if (!ROOMS.has(roomId)) {
        ROOMS.set(roomId, []);
        console.log(`[SW] Created room ${roomId} for message storage`);
      }
      
      // Initialize message storage for this room if needed
      if (!ROOM_MESSAGES.has(roomId)) {
        ROOM_MESSAGES.set(roomId, []);
        console.log(`[SW] Initialized message storage for room ${roomId}`);
      }
      
      // Store the message in the room history (limit to last 100 messages)
      const roomMessages = ROOM_MESSAGES.get(roomId);
      roomMessages.push(message);
      if (roomMessages.length > 100) {
        roomMessages.shift(); // Remove oldest message if more than 100
      }
      ROOM_MESSAGES.set(roomId, roomMessages);
      
      console.log(`[SW] Stored message in room ${roomId}, total messages: ${roomMessages.length}`);
      console.log(`[SW] Current room clients for ${roomId}:`, ROOMS.get(roomId) || []);
      
      // Broadcast message to all clients in the room EXCEPT the sender
      // This prevents the sender from receiving their own message twice
      console.log(`[SW] Broadcasting message to room ${roomId}, excluding sender ${clientId}`);
      broadcastToRoom(roomId, 'message', message, clientId);
      
      // For debugging, also send directly to the sender to confirm receipt
      // but with a special flag indicating it's their own message being echoed back
      console.log(`[SW] Sending echo confirmation to sender ${clientId}`);
      event.source.postMessage({
        type: 'message',
        data: { ...message, isEcho: true },
        roomId: roomId,
        messageId: `msg_${Date.now()}_${messageCounter++}`
      });
      
      console.log(`[SW] ====== MESSAGE HANDLING END ======`);
      break;    case 'shareDocument':
      console.log(`[SW] Document share request received for room ${roomId}`, { 
        docName: data.document?.name, 
        docType: data.document?.type,
        docSize: data.document?.size,
        fromUser: data.user
      });
      
      try {
        // Make sure the document has the required type field for proper rendering
        // and ensure it has a unique ID
        const documentMessage = {
          ...data,
          id: data.id || generateUniqueId('doc', data.userId),
          type: 'document',
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        // Store document in room message history like regular messages
        if (!ROOM_MESSAGES.has(roomId)) {
          ROOM_MESSAGES.set(roomId, []);
        }
        
        const roomMessages = ROOM_MESSAGES.get(roomId);
        roomMessages.push(documentMessage);
        if (roomMessages.length > 100) {
          roomMessages.shift(); // Remove oldest message if more than 100
        }
        ROOM_MESSAGES.set(roomId, roomMessages);
          // Broadcast to all clients in room except the sender
        broadcastToRoom(roomId, 'documentShared', documentMessage, clientId);
        
        // Also send back to the sender with an isEcho flag
        event.source.postMessage({
          type: 'documentShared',
          data: { ...documentMessage, isEcho: true },
          roomId: roomId,
          messageId: `doc_${Date.now()}_${messageCounter++}`
        });
        
        console.log(`[SW] Document shared successfully to room ${roomId}`);
      } catch (error) {
        console.error(`[SW] Error sharing document to room ${roomId}:`, error);
      }
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
      // Update heartbeat time for this client
      CLIENT_HEARTBEATS.set(clientId, Date.now());
      
      // Send pong directly to the client that sent the ping
      event.source.postMessage({
        type: 'pong',
        timestamp: Date.now()
      });
      break;
      
    case 'heartbeat':
      // Update heartbeat time for this client
      CLIENT_HEARTBEATS.set(clientId, Date.now());
      
      // If a user ID is provided, make sure this user is correctly tracked
      if (data && data.userId && data.roomId) {
        // Check if this user is already registered in this room
        const userInRoom = [...USERS.values()].some(
          u => u.userId === data.userId && u.roomId === data.roomId
        );
        
        // If not in room, this might be a reconnection or browser refresh
        if (!userInRoom && data.rejoin) {
          console.log(`[SW] Heartbeat detected user ${data.userId} attempting to rejoin room ${data.roomId}`);
          
          // Add client to room
          if (!ROOMS.has(data.roomId)) {
            ROOMS.set(data.roomId, []);
          }
          if (!ROOMS.get(data.roomId).includes(clientId)) {
            ROOMS.set(data.roomId, [...ROOMS.get(data.roomId), clientId]);
          }
          
          // Update user data
          USERS.set(clientId, {
            userId: data.userId,
            name: data.name || "Unknown User",
            roomId: data.roomId,
            joinedAt: Date.now(),
            isCreator: data.isCreator || false
          });
          
          // Broadcast updated room users
          const roomUsers = [...USERS.values()]
            .filter(user => user.roomId === data.roomId)
            .map(({ userId, name, isCreator }) => ({ id: userId, name, isCreator }));
          
          broadcastToRoom(data.roomId, 'roomUsers', roomUsers);
        }
      }
      break;    case 'requestRoomUsers':
      if (data.roomId) {
        // Create a set to track unique user IDs we've already processed
        const processedUserIds = new Set();
        const roomUsers = [...USERS.values()]
          .filter(user => {
            if (user.roomId === data.roomId && !processedUserIds.has(user.userId)) {
              processedUserIds.add(user.userId);
              return true;
            }
            return false;
          })
          .map(({ userId, name, isCreator }) => ({ 
            id: userId, 
            name, 
            isCreator: isCreator === undefined ? false : isCreator // Handle undefined isCreator
          }));
        
        console.log(`[SW] Responding to request for room ${data.roomId} users:`, roomUsers);
        
        // Send to the requesting client
        event.source.postMessage({
          type: 'roomUsers',
          data: roomUsers,
          roomId: data.roomId
        });
        
        // Also broadcast to all clients to ensure consistency
        broadcastToRoom(data.roomId, 'roomUsers', roomUsers);
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