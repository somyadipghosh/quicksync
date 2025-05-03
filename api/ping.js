// This endpoint helps keep our WebSocket connection alive in Vercel's serverless environment
export default function handler(req, res) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}