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

GitHub Pages can only host the frontend files. This repo's Vercel setup now exposes the HTTP `/api` backend from the same project, while local development still runs the standalone Node server.

- For local use, run `npm run dev` so the frontend talks to `http://127.0.0.1:3001`.
- For deployed use on Vercel, this repo now routes `/api/*` into a Node function from the same project.
- If you are using GitHub Pages, this repo now includes a Pages workflow that deploys the built `dist` bundle from `main`.
- End users no longer enter backend URLs manually.

## Vercel note

Hosted frontends now probe `GET /api/health` on their own origin. This repo includes a Vercel `/api` function entrypoint, so auth and core chat data can run on the website itself.

- If your deployment exposes the API on the same origin, the app will pick it up automatically.
- On hosted same-origin deployments, the app falls back to HTTP sync for messaging if Socket.IO is unavailable.
- SQLite on Vercel uses ephemeral storage, so hosted data is not durable across cold restarts. For long-term production persistence, use a managed database instead.

## Test it locally

1. Open the app in two browser windows.
2. Create two separate accounts.
3. Start a direct chat from one account to the other.
4. Send messages in both windows.
5. Start an audio or video call from one side and accept it on the other.

## Notes

- User, conversation, message, and call data are stored in [server/chat.sqlite](/C:/Users/rokes/OneDrive/Desktop/Chat%20free/server/chat.sqlite) after first run.
- WebRTC calling works well on `localhost`. For internet-facing production deployment, you would normally add HTTPS and a TURN server.
