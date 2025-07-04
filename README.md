# FastSync 💬 - Real-time Chat Application

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/FastSync)

A modern, production-ready real-time chat application built with React, Vite, Node.js, Express, and Socket.IO. Features instant messaging, file sharing, typing indicators, and seamless deployment.

## ✨ Features

- 🚀 **Real-time messaging** - Instant message delivery using WebSocket connections
- 📎 **File sharing** - Share images, documents, and other files instantly with preview
- ⌨️ **Typing indicators** - See when others are typing in real-time
- 👥 **User presence** - Track who's online in each room
- 🏠 **Room-based chat** - Create and join different chat rooms with unique IDs
- 📜 **Message history** - Persistent message history per room
- 📱 **Responsive design** - Works perfectly on desktop, tablet, and mobile
- 🔒 **Production ready** - Optimized for deployment with proper error handling
- ⚡ **Auto-reconnection** - Seamless reconnection when connection drops
- 🌐 **Cross-platform** - Works in all modern browsers

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Modern web browser

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/FastSync.git
   cd FastSync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm run start
   ```
   
   This starts both backend (port 5000) and frontend (port 5173) automatically.

4. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Enter your name and start chatting!

### Alternative: Start servers separately

```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend  
npm run dev
```

## 🏗️ Project Structure

```
FastSync/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout wrapper components
│   │   └── ui/             # UI elements (buttons, inputs, etc.)
│   ├── contexts/           # React contexts for state management
│   │   ├── SocketContext.jsx  # Socket.IO connection and chat logic
│   │   └── UserContext.jsx    # User state management
│   ├── pages/              # Page components
│   │   ├── Home.jsx        # Landing page
│   │   ├── Welcome.jsx     # User name input
│   │   ├── Rooms.jsx       # Room list/creation
│   │   └── Room.jsx        # Main chat interface
│   └── utils/              # Utility functions and helpers
├── api/                    # Serverless API functions (Vercel)
├── public/                 # Static assets
├── server.js              # Backend server (Express + Socket.IO)
├── vercel.json            # Vercel deployment configuration
└── package.json           # Dependencies and scripts
```

## 🛠️ Development

### Available Scripts

- `npm run start` - Start both frontend and backend (recommended)
- `npm run dev` - Start frontend development server only
- `npm run dev:backend` - Start backend server only
- `npm run dev:full` - Start both servers with concurrently
- `npm run build` - Build for production
- `npm run vercel-build` - Build for Vercel deployment
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run preview` - Preview production build locally

### Tech Stack

**Frontend:**
- React 19 + Vite
- TailwindCSS for styling
- Socket.IO Client for real-time communication
- React Router for navigation

**Backend:**
- Node.js + Express
- Socket.IO for WebSocket connections
- CORS enabled
- Production-ready error handling

## 🌐 API Reference

### REST Endpoints

- `GET /` - Health check and server status
- `GET /api/room/:roomId` - Get room information (users, message count)

### Socket.IO Events

**Client to Server:**
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room  
- `send_message` - Send a text message
- `send_document` - Share a file
- `typing` - Start typing notification
- `stop_typing` - Stop typing notification

**Server to Client:**
- `receive_message` - Receive a new message
- `message_history` - Get previous messages when joining
- `user_joined` - User joined notification
- `user_left` - User left notification
- `user_typing` - Someone is typing
- `user_stopped_typing` - Someone stopped typing
- `error` - Error notifications

## 🚀 Deployment

### Deploy to Vercel (Recommended - Zero Configuration)

**🎯 One-Click Deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/somyadipghosh/FastSync)

**📦 GitHub Integration:**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Vercel automatically:
   - Builds the React frontend
   - Deploys backend as serverless functions
   - Configures Socket.IO routing
   - Provides HTTPS and custom domains
   - Sets up auto-deployments on git push

**⚡ CLI Deploy:**
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Other Deployment Options

#### Netlify + Railway
- **Frontend**: Deploy to Netlify
- **Backend**: Deploy to Railway or Heroku

#### Docker Deployment
```bash
docker build -t fastsync .
docker run -p 5000:5000 fastsync
```

## ⚙️ Configuration

### Environment Variables

**Development (.env.local):**
```env
VITE_SERVER_URL=http://localhost:5000
```

**Production (Auto-configured on Vercel):**
- `NODE_ENV=production`
- `VITE_SERVER_URL` - Automatically set to deployment URL

### Socket.IO Configuration

- **Reconnection**: Automatic with exponential backoff
- **Timeout**: 20 second connection timeout  
- **Transports**: WebSocket with polling fallback
- **CORS**: Configured for cross-origin requests

## 🔒 Security & Performance

### Security Features
- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Rate limiting on message sending
- ✅ File size limits
- ✅ XSS protection

### Performance Optimizations
- ✅ Message history limits (1000 per room)
- ✅ Automatic room cleanup
- ✅ Efficient reconnection handling
- ✅ Optimized bundle size
- ✅ Lazy loading of components

## 🐛 Troubleshooting

### Common Issues

**Connection Problems:**
- Ensure backend is running on port 5000
- Check `VITE_SERVER_URL` in environment
- Verify firewall/network settings

**Messages Not Sending:**
- Check internet connection stability
- Look for errors in browser console
- Verify user properly joined room

**File Upload Issues:**
- Check file size (limit: 10MB)
- Verify file type is supported
- Ensure stable connection

### Debug Mode

Enable detailed logging:
```env
VITE_DEBUG=true
```

## � Usage Guide

1. **Enter your name** on the welcome screen
2. **Create a new room** or **join existing** with room ID
3. **Share the room link** with others to invite them
4. **Start chatting** - messages appear instantly
5. **Share files** by clicking the attachment icon
6. **See typing indicators** when others are typing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## � License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Real-time communication powered by [Socket.IO](https://socket.io/)
- Styled with [TailwindCSS](https://tailwindcss.com/)
- Deployed on [Vercel](https://vercel.com/)

## 📞 Support

- 🐛 [Report bugs](https://github.com/somyadipghosh/FastSync/issues)
- 💡 [Request features](https://github.com/somyadipghosh/FastSync/issues)
- 📖 [Documentation](https://github.com/somyadipghosh/FastSync/wiki)

---

<div align="center">
  <strong>FastSync</strong> - Building the future of real-time communication! 🚀

  Made with ❤️ by [Somyadip Ghosh](https://github.com/somyadipghosh)

  ⭐ Star this repo if you found it helpful!
</div>
