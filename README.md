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

## Test it locally

1. Open the app in two browser windows.
2. Create two separate accounts.
3. Start a direct chat from one account to the other.
4. Send messages in both windows.
5. Start an audio or video call from one side and accept it on the other.

## Notes

- User, conversation, message, and call data are stored in [server/chat.sqlite](/C:/Users/rokes/OneDrive/Desktop/Chat%20free/server/chat.sqlite) after first run.
- WebRTC calling works well on `localhost`. For internet-facing production deployment, you would normally add HTTPS and a TURN server.
