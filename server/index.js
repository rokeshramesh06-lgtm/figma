import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import {
  createCall,
  createMessage,
  createUser,
  getCallById,
  getConversationIdsForUser,
  getConversationMemberIds,
  getConversationSummaryForUser,
  getConversationsForUser,
  getMessagesForConversation,
  getOrCreateDirectConversation,
  getPublicUsers,
  getUserByEmail,
  getUserById,
  isConversationMember,
  updateCallStatus,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const distDir = path.join(workspaceRoot, "dist");

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-in-production";
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"));
    },
  }),
);
app.use(express.json());

const onlineSockets = new Map();

function getTokenFromRequest(headers = {}) {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  const token = getTokenFromRequest(req.headers);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);

    if (!user) {
      res.status(401).json({ error: "Account not found." });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token." });
  }
}

function addSocketForUser(userId, socketId) {
  const existing = onlineSockets.get(userId) ?? new Set();
  existing.add(socketId);
  onlineSockets.set(userId, existing);
  return existing.size === 1;
}

function removeSocketForUser(userId, socketId) {
  const existing = onlineSockets.get(userId);
  if (!existing) {
    return false;
  }

  existing.delete(socketId);
  if (existing.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }

  return false;
}

function getOnlineUserIds() {
  return [...onlineSockets.keys()].map(Number);
}

function joinUserSocketsToConversation(userId, conversationId) {
  const socketIds = onlineSockets.get(userId);
  if (!socketIds) {
    return;
  }

  for (const socketId of socketIds) {
    io.sockets.sockets.get(socketId)?.join(`conversation:${conversationId}`);
  }
}

function emitConversationSummary(conversationId) {
  const memberIds = getConversationMemberIds(conversationId);
  for (const memberId of memberIds) {
    const summary = getConversationSummaryForUser(conversationId, memberId);
    if (summary) {
      io.to(`user:${memberId}`).emit("conversation:summary", { conversation: summary });
    }
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!name || !email || password.length < 6) {
    res.status(400).json({ error: "Name, email, and a 6+ character password are required." });
    return;
  }

  if (getUserByEmail(email)) {
    res.status(409).json({ error: "That email is already registered." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ name, email, passwordHash });
  const token = signToken(user);

  res.status(201).json({ token, user });
});

app.post("/api/auth/signin", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const userRecord = getUserByEmail(email);

  if (!userRecord) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, userRecord.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const user = getUserById(userRecord.id);
  const token = signToken(user);
  res.json({ token, user });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/users", authRequired, (req, res) => {
  res.json({ users: getPublicUsers(req.user.id) });
});

app.get("/api/conversations", authRequired, (req, res) => {
  res.json({ conversations: getConversationsForUser(req.user.id) });
});

app.post("/api/conversations/direct", authRequired, (req, res) => {
  const otherUserId = Number(req.body?.userId);

  if (!otherUserId || otherUserId === req.user.id) {
    res.status(400).json({ error: "Choose another user to start chatting." });
    return;
  }

  const otherUser = getUserById(otherUserId);
  if (!otherUser) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const conversation = getOrCreateDirectConversation(req.user.id, otherUserId);
  const memberIds = getConversationMemberIds(conversation.id);

  for (const memberId of memberIds) {
    joinUserSocketsToConversation(memberId, conversation.id);
  }

  for (const memberId of memberIds) {
    const summary = getConversationSummaryForUser(conversation.id, memberId);
    io.to(`user:${memberId}`).emit("conversation:created", { conversation: summary });
  }

  res.status(201).json({ conversation });
});

app.get("/api/conversations/:conversationId/messages", authRequired, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const messages = getMessagesForConversation(conversationId, req.user.id);

  if (!messages) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  res.json({ messages });
});

app.post("/api/conversations/:conversationId/messages", authRequired, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const body = String(req.body?.body || "").trim();

  if (!body) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  if (!isConversationMember(conversationId, req.user.id)) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  const message = createMessage({ conversationId, senderId: req.user.id, body });
  io.to(`conversation:${conversationId}`).emit("message:new", { message });
  emitConversationSummary(conversationId);

  res.status(201).json({ message });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);

    if (!user) {
      next(new Error("Account not found"));
      return;
    }

    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;
  const becameOnline = addSocketForUser(user.id, socket.id);

  socket.join(`user:${user.id}`);

  for (const conversationId of getConversationIdsForUser(user.id)) {
    socket.join(`conversation:${conversationId}`);
  }

  socket.emit("presence:snapshot", { userIds: getOnlineUserIds() });
  if (becameOnline) {
    socket.broadcast.emit("presence:update", { userId: user.id, online: true });
  }

  socket.on("message:send", (payload = {}, ack = () => {}) => {
    try {
      const conversationId = Number(payload.conversationId);
      const body = String(payload.body || "").trim();

      if (!conversationId || !body) {
        ack({ ok: false, error: "Conversation and message are required." });
        return;
      }

      if (!isConversationMember(conversationId, user.id)) {
        ack({ ok: false, error: "Conversation not found." });
        return;
      }

      const message = createMessage({ conversationId, senderId: user.id, body });
      io.to(`conversation:${conversationId}`).emit("message:new", { message });
      emitConversationSummary(conversationId);
      ack({ ok: true, message });
    } catch (error) {
      ack({ ok: false, error: error.message || "Unable to send message." });
    }
  });

  socket.on("call:start", (payload = {}, ack = () => {}) => {
    try {
      const conversationId = Number(payload.conversationId);
      const kind = payload.kind === "audio" ? "audio" : "video";
      const offer = payload.offer;

      if (!conversationId || !offer) {
        ack({ ok: false, error: "Call offer is missing." });
        return;
      }

      if (!isConversationMember(conversationId, user.id)) {
        ack({ ok: false, error: "Conversation not found." });
        return;
      }

      const call = createCall({ conversationId, initiatorId: user.id, kind });
      ack({ ok: true, callId: call.id });

      socket.to(`conversation:${conversationId}`).emit("call:incoming", {
        callId: call.id,
        conversationId,
        kind,
        offer,
        from: user,
      });
    } catch (error) {
      ack({ ok: false, error: error.message || "Unable to start call." });
    }
  });

  socket.on("call:answer", (payload = {}, ack = () => {}) => {
    try {
      const callId = Number(payload.callId);
      const answer = payload.answer;
      const call = getCallById(callId);

      if (!call || !answer || !isConversationMember(call.conversation_id, user.id)) {
        ack({ ok: false, error: "Call not found." });
        return;
      }

      updateCallStatus(callId, "active");
      socket.to(`conversation:${call.conversation_id}`).emit("call:answered", {
        callId,
        answer,
        answeredBy: user,
      });
      ack({ ok: true });
    } catch (error) {
      ack({ ok: false, error: error.message || "Unable to answer call." });
    }
  });

  socket.on("call:ice-candidate", (payload = {}, ack = () => {}) => {
    try {
      const callId = Number(payload.callId);
      const candidate = payload.candidate;
      const call = getCallById(callId);

      if (!call || !candidate || !isConversationMember(call.conversation_id, user.id)) {
        ack({ ok: false, error: "Call not found." });
        return;
      }

      socket.to(`conversation:${call.conversation_id}`).emit("call:ice-candidate", {
        callId,
        candidate,
        fromUserId: user.id,
      });
      ack({ ok: true });
    } catch (error) {
      ack({ ok: false, error: error.message || "Unable to sync candidate." });
    }
  });

  socket.on("call:end", (payload = {}, ack = () => {}) => {
    try {
      const callId = Number(payload.callId);
      const reason = String(payload.reason || "ended");
      const call = getCallById(callId);

      if (!call || !isConversationMember(call.conversation_id, user.id)) {
        ack({ ok: false, error: "Call not found." });
        return;
      }

      updateCallStatus(callId, reason);
      io.to(`conversation:${call.conversation_id}`).emit("call:ended", {
        callId,
        conversationId: call.conversation_id,
        reason,
        endedBy: user.id,
      });
      ack({ ok: true });
    } catch (error) {
      ack({ ok: false, error: error.message || "Unable to end call." });
    }
  });

  socket.on("disconnect", () => {
    const becameOffline = removeSocketForUser(user.id, socket.id);
    if (becameOffline) {
      socket.broadcast.emit("presence:update", { userId: user.id, online: false });
    }
  });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});
