import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import {
  createMessage,
  createUser,
  getConversationMemberIds,
  getConversationsForUser,
  getMessagesForConversation,
  getOrCreateDirectConversation,
  getPublicUsers,
  getUserByEmail,
  getUserById,
  isConversationMember,
} from "./db.js";

export const JWT_SECRET = process.env.JWT_SECRET || "replace-this-in-production";

export const corsOptions = {
  origin(_origin, callback) {
    callback(null, true);
  },
  methods: ["GET", "POST"],
};

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

export function authRequired(req, res, next) {
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

export function createApp({
  onConversationCreated = () => {},
  onMessageCreated = () => {},
} = {}) {
  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());

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

    try {
      onConversationCreated({ conversation, memberIds });
    } catch {}

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

    try {
      onMessageCreated({ conversationId, message });
    } catch {}

    res.status(201).json({ message });
  });

  return app;
}
