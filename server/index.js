import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createApp, JWT_SECRET, corsOptions } from "./app.js";
import {
  createCall,
  createMessage,
  getCallById,
  getConversationIdsForUser,
  getConversationMemberIds,
  getConversationSummaryForUser,
  getUserById,
  isConversationMember,
  updateCallStatus,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const distDir = path.join(workspaceRoot, "dist");

const PORT = Number(process.env.PORT || 3001);

const onlineSockets = new Map();

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

function joinUserSocketsToConversation(io, userId, conversationId) {
  const socketIds = onlineSockets.get(userId);
  if (!socketIds) {
    return;
  }

  for (const socketId of socketIds) {
    io.sockets.sockets.get(socketId)?.join(`conversation:${conversationId}`);
  }
}

function emitConversationSummary(io, conversationId) {
  const memberIds = getConversationMemberIds(conversationId);
  for (const memberId of memberIds) {
    const summary = getConversationSummaryForUser(conversationId, memberId);
    if (summary) {
      io.to(`user:${memberId}`).emit("conversation:summary", { conversation: summary });
    }
  }
}

let io;

const app = createApp({
  onConversationCreated({ conversation, memberIds }) {
    for (const memberId of memberIds) {
      joinUserSocketsToConversation(io, memberId, conversation.id);
    }

    for (const memberId of memberIds) {
      const summary = getConversationSummaryForUser(conversation.id, memberId);
      io.to(`user:${memberId}`).emit("conversation:created", { conversation: summary });
    }
  },
  onMessageCreated({ conversationId, message }) {
    io.to(`conversation:${conversationId}`).emit("message:new", { message });
    emitConversationSummary(io, conversationId);
  },
});

const httpServer = createServer(app);
io = new Server(httpServer, {
  cors: corsOptions,
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
      emitConversationSummary(io, conversationId);
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
