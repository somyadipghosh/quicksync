# FastSync - Real-time Chat Application

A production-ready real-time chat application built with React, Vite, Node.js, Express, and Socket.IO.

## ✨ Features

- **Real-time messaging** - Instant message delivery using WebSocket connections
- **File sharing** - Share images, documents, and other files instantly
- **Typing indicators** - See when others are typing
- **User presence** - Track who's online in each room
- **Room-based chat** - Create and join different chat rooms
- **Message history** - Persistent message history per room
- **Responsive design** - Works on desktop and mobile devices
- **Production ready** - Optimized for deployment with proper error handling

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FastSync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and configure:
   ```env
   VITE_SERVER_URL=http://localhost:5000
   ```

4. **Start the development servers**
   ```bash
   npm run start
   ```
   
   This will start both the backend (port 5000) and frontend (port 5173).

### Alternative: Start servers separately

```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend  
npm run dev
```

## 📁 Project Structure

```
FastSync/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # UI elements (buttons, inputs, etc.)
│   ├── contexts/           # React contexts for state management
│   │   ├── SocketContext.jsx  # Socket.IO connection and chat logic
│   │   └── UserContext.jsx    # User state management
│   ├── pages/              # Page components
│   │   ├── Home.jsx        # Landing page
│   │   ├── Welcome.jsx     # User name input
│   │   ├── Rooms.jsx       # Room list/creation
│   │   └── Room.jsx        # Chat interface
│   └── utils/              # Utility functions
├── public/                 # Static assets
├── server.js              # Backend server (Express + Socket.IO)
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run dev:backend` - Start backend server
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run preview` - Preview production build

### Backend API Endpoints

- `GET /` - Health check and server status
- `GET /api/room/:roomId` - Get room information

### Socket.IO Events

**Client to Server:**
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send a text message
- `send_document` - Share a file
- `typing` - Notify others of typing
- `stop_typing` - Stop typing notification

**Server to Client:**
- `receive_message` - Receive a new message
- `message_history` - Get previous messages when joining
- `user_joined` - User joined notification
- `user_left` - User left notification
- `user_typing` - Typing indicator
- `user_stopped_typing` - Stop typing indicator
- `error` - Error notifications

## 🚀 Production Deployment

### Environment Configuration

1. **Create production environment file**
   ```bash
   cp .env.example .env.production
   ```

2. **Configure production variables**
   ```env
   VITE_SERVER_URL=https://your-domain.com
   NODE_ENV=production
   PORT=5000
   CLIENT_URL=https://your-frontend-domain.com
   ```

### Build and Deploy

1. **Build the frontend**
   ```bash
   npm run build:production
   ```

2. **Deploy frontend static files**
   - Upload `dist/` folder to your static hosting (Vercel, Netlify, etc.)

3. **Deploy backend**
   ```bash
   npm run start:production
   ```

### Deployment Platforms

#### Vercel (Frontend + Backend)
```bash
# Deploy with Vercel
npm i -g vercel
vercel --prod
```

#### Heroku (Backend)
```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CLIENT_URL=https://your-frontend-domain.com

# Deploy
git push heroku main
```

#### Railway (Backend)
1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
- `VITE_SERVER_URL` - Backend server URL (default: http://localhost:5000)

#### Backend (process.env)
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `CLIENT_URL` - Frontend URL for CORS (default: http://localhost:5173)

### Socket.IO Configuration

The application uses optimized Socket.IO settings for production:

- **Reconnection**: Automatic with exponential backoff
- **Timeout**: 20 second connection timeout
- **Transports**: WebSocket with polling fallback
- **CORS**: Configured for cross-origin requests

## 🔒 Security Features

- **Input validation** - All user inputs are validated and sanitized
- **CORS protection** - Proper CORS configuration for production
- **Message limits** - Room message history limited to prevent memory issues
- **Error handling** - Comprehensive error handling and logging
- **Graceful shutdown** - Proper cleanup on server shutdown

## 🐛 Troubleshooting

### Common Issues

1. **Connection failed**
   - Check if backend server is running
   - Verify `VITE_SERVER_URL` in environment file
   - Check firewall/network settings

2. **Messages not sending**
   - Ensure stable internet connection
   - Check browser console for errors
   - Verify user is properly joined to room

3. **File upload issues**
   - Check file size limits
   - Verify file type is supported
   - Ensure stable connection for large files

### Debug Mode

Enable debug logging by setting:
```env
VITE_DEBUG=true
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the code documentation

---

**FastSync** - Building the future of real-time communication! 🚀+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
