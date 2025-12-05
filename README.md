# Real-Time Health Monitoring System

This is a beginner-friendly project for monitoring patient vitals in real time.

## Quick start

1. Start services:
```bash
docker-compose up -d
```

2. Start backend:
```bash
cd backend
npm install
cp .env.example .env
node server.js
```

3. Serve frontend (option):
```bash
cd frontend
npx http-server -p 8080
# open http://localhost:8080
```
