// Enhanced ping endpoint to help keep Socket.IO connections alive in Vercel's serverless environment
export default function handler(req, res) {
  // Add appropriate headers for CORS and caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  // Return a response with the current timestamp
  res.status(200).json({ 
    status: 'ok', 
    timestamp: Date.now(),
    message: 'Connection alive'
  });
}