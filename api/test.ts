export default function handler(req: any, res: any) {
  res.json({ message: 'Hello from Vercel serverless!', timestamp: new Date().toISOString() });
}
