# Chat Free

A WhatsApp-style chat app built from scratch with:

- React + Vite for the client
- Express + Socket.IO for the API and realtime layer
- SQLite via `better-sqlite3` for persistence
- JWT auth with sign up and sign in
- WebRTC audio/video calling with Socket.IO signaling

## Run it

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` and the API/socket server runs at `http://localhost:3001`.

## Important hosting note

GitHub Pages can only host the frontend files. Sign up, sign in, chat persistence, and calling still require the Node + SQLite backend to be running separately.

- For local use, run `npm run dev` so the frontend talks to `http://127.0.0.1:3001`.
- For deployed use, host the backend on a Node service and set `BACKEND_ORIGIN` in Vercel so the site proxies `/api` and `/socket.io` to that backend.
- If you are using GitHub Pages, this repo now includes a Pages workflow that deploys the built `dist` bundle from `main`.
- End users no longer enter backend URLs manually. The deployment should provide one shared backend for everyone.

## Vercel note

Hosted frontends now probe `GET /api/health` on their own origin. On Vercel, this repo can proxy `/api` and `/socket.io` to one shared backend using `BACKEND_ORIGIN`.

- If your deployment exposes the API on the same origin, the app will pick it up automatically.
- If that health check fails, configure `BACKEND_ORIGIN` in Vercel so the whole site uses one shared backend automatically through same-origin proxying.
- Deploying only the Vite frontend to Vercel still does not make this Express + Socket.IO + SQLite backend available automatically, so in that setup you still need a separately hosted backend.

## Test it locally

1. Open the app in two browser windows.
2. Create two separate accounts.
3. Start a direct chat from one account to the other.
4. Send messages in both windows.
5. Start an audio or video call from one side and accept it on the other.

## Notes

- User, conversation, message, and call data are stored in [server/chat.sqlite](/C:/Users/rokes/OneDrive/Desktop/Chat%20free/server/chat.sqlite) after first run.
- WebRTC calling works well on `localhost`. For internet-facing production deployment, you would normally add HTTPS and a TURN server.
