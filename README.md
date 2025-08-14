# Interlink Forum — v16.1

- Frontend: Next.js (Page Router) + Tailwind + socket.io-client
- Backend: Express.js + Socket.IO + Mongoose
- Features: JWT auth, roles (admin delete reply), rate limit + honeypot, nested replies, @mentions + notifications, realtime WS (replies + notifications), animated gradient UI, sticky footer.
- UX: Back/Home on Community, Thread detail, FAQs. Telegram link updated. Login keeps current page using `?next=`. Thread list is **not realtime**.

## Run
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
# Optional (DEV): seed admin
# curl -X POST http://localhost:4000/api/auth/seed-admin -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# http://localhost:3000
```
