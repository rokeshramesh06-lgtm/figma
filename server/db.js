import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "chat.sqlite");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_group INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    initiator_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    ended_at TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const palette = [
  "#0f9d58",
  "#128c7e",
  "#1a73e8",
  "#e37400",
  "#c5221f",
  "#9334e6",
  "#00897b",
  "#7cb342",
];

function now() {
  return new Date().toISOString();
}

function colorForEmail(email) {
  const seed = [...email.toLowerCase()].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatar_color,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    createdAt: row.created_at,
    sender: {
      id: row.sender_id,
      name: row.sender_name,
      email: row.sender_email,
      avatarColor: row.sender_avatar_color,
    },
  };
}

function mapConversation(row) {
  return {
    id: row.id,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    otherUser: row.other_user_id
      ? {
          id: row.other_user_id,
          name: row.other_user_name,
          email: row.other_user_email,
          avatarColor: row.other_user_avatar_color,
        }
      : null,
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          body: row.last_message_body,
          createdAt: row.last_message_created_at,
          sender: {
            id: row.last_message_sender_id,
            name: row.last_message_sender_name,
          },
        }
      : null,
  };
}

export function getUserById(id) {
  return mapUser(
    db
      .prepare(
        `
          SELECT id, name, email, avatar_color
          FROM users
          WHERE id = ?
        `,
      )
      .get(id),
  );
}

export function getUserByEmail(email) {
  return db
    .prepare(
      `
        SELECT id, name, email, password_hash, avatar_color
        FROM users
        WHERE LOWER(email) = LOWER(?)
      `,
    )
    .get(email.trim());
}

export function createUser({ name, email, passwordHash }) {
  const createdAt = now();
  const normalizedEmail = email.trim().toLowerCase();
  const avatarColor = colorForEmail(normalizedEmail);

  const result = db
    .prepare(
      `
        INSERT INTO users (name, email, password_hash, avatar_color, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(name.trim(), normalizedEmail, passwordHash, avatarColor, createdAt);

  return getUserById(result.lastInsertRowid);
}

export function getPublicUsers(currentUserId) {
  return db
    .prepare(
      `
        SELECT id, name, email, avatar_color
        FROM users
        WHERE id != ?
        ORDER BY LOWER(name), LOWER(email)
      `,
    )
    .all(currentUserId)
    .map(mapUser);
}

export function getConversationIdsForUser(userId) {
  return db
    .prepare(
      `
        SELECT conversation_id
        FROM conversation_members
        WHERE user_id = ?
      `,
    )
    .all(userId)
    .map((row) => row.conversation_id);
}

export function isConversationMember(conversationId, userId) {
  return Boolean(
    db
      .prepare(
        `
          SELECT 1
          FROM conversation_members
          WHERE conversation_id = ? AND user_id = ?
        `,
      )
      .get(conversationId, userId),
  );
}

export function getConversationMemberIds(conversationId) {
  return db
    .prepare(
      `
        SELECT user_id
        FROM conversation_members
        WHERE conversation_id = ?
      `,
    )
    .all(conversationId)
    .map((row) => row.user_id);
}

export function getConversationSummaryForUser(conversationId, userId) {
  const row = db
    .prepare(
      `
        SELECT
          c.id,
          c.created_at,
          c.updated_at,
          other.id AS other_user_id,
          other.name AS other_user_name,
          other.email AS other_user_email,
          other.avatar_color AS other_user_avatar_color,
          last_message.id AS last_message_id,
          last_message.body AS last_message_body,
          last_message.created_at AS last_message_created_at,
          sender.id AS last_message_sender_id,
          sender.name AS last_message_sender_name
        FROM conversations c
        JOIN conversation_members self_member
          ON self_member.conversation_id = c.id
          AND self_member.user_id = ?
        LEFT JOIN conversation_members other_member
          ON other_member.conversation_id = c.id
          AND other_member.user_id != ?
        LEFT JOIN users other ON other.id = other_member.user_id
        LEFT JOIN messages last_message
          ON last_message.id = (
            SELECT id
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY id DESC
            LIMIT 1
          )
        LEFT JOIN users sender ON sender.id = last_message.sender_id
        WHERE c.id = ?
          AND c.is_group = 0
      `,
    )
    .get(userId, userId, conversationId);

  return row ? mapConversation(row) : null;
}

export function getConversationsForUser(userId) {
  return db
    .prepare(
      `
        SELECT
          c.id,
          c.created_at,
          c.updated_at,
          other.id AS other_user_id,
          other.name AS other_user_name,
          other.email AS other_user_email,
          other.avatar_color AS other_user_avatar_color,
          last_message.id AS last_message_id,
          last_message.body AS last_message_body,
          last_message.created_at AS last_message_created_at,
          sender.id AS last_message_sender_id,
          sender.name AS last_message_sender_name
        FROM conversations c
        JOIN conversation_members self_member
          ON self_member.conversation_id = c.id
          AND self_member.user_id = ?
        LEFT JOIN conversation_members other_member
          ON other_member.conversation_id = c.id
          AND other_member.user_id != ?
        LEFT JOIN users other ON other.id = other_member.user_id
        LEFT JOIN messages last_message
          ON last_message.id = (
            SELECT id
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY id DESC
            LIMIT 1
          )
        LEFT JOIN users sender ON sender.id = last_message.sender_id
        WHERE c.is_group = 0
        ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC
      `,
    )
    .all(userId, userId)
    .map(mapConversation);
}

const getDirectConversationIdStatement = db.prepare(`
  SELECT c.id
  FROM conversations c
  JOIN conversation_members member_a
    ON member_a.conversation_id = c.id
    AND member_a.user_id = ?
  JOIN conversation_members member_b
    ON member_b.conversation_id = c.id
    AND member_b.user_id = ?
  WHERE c.is_group = 0
  LIMIT 1
`);

const createDirectConversationTransaction = db.transaction((userId, otherUserId) => {
  const existingConversation = getDirectConversationIdStatement.get(userId, otherUserId);
  if (existingConversation) {
    return existingConversation.id;
  }

  const createdAt = now();
  const conversationResult = db
    .prepare(
      `
        INSERT INTO conversations (is_group, title, created_at, updated_at)
        VALUES (0, NULL, ?, ?)
      `,
    )
    .run(createdAt, createdAt);

  const conversationId = conversationResult.lastInsertRowid;
  const insertMember = db.prepare(`
    INSERT INTO conversation_members (conversation_id, user_id, joined_at)
    VALUES (?, ?, ?)
  `);

  insertMember.run(conversationId, userId, createdAt);
  insertMember.run(conversationId, otherUserId, createdAt);

  return conversationId;
});

export function getOrCreateDirectConversation(userId, otherUserId) {
  const conversationId = createDirectConversationTransaction(userId, otherUserId);
  return getConversationSummaryForUser(conversationId, userId);
}

export function getMessagesForConversation(conversationId, userId) {
  if (!isConversationMember(conversationId, userId)) {
    return null;
  }

  return db
    .prepare(
      `
        SELECT
          m.id,
          m.conversation_id,
          m.body,
          m.created_at,
          sender.id AS sender_id,
          sender.name AS sender_name,
          sender.email AS sender_email,
          sender.avatar_color AS sender_avatar_color
        FROM messages m
        JOIN users sender ON sender.id = m.sender_id
        WHERE m.conversation_id = ?
        ORDER BY m.id ASC
      `,
    )
    .all(conversationId)
    .map(mapMessage);
}

const createMessageTransaction = db.transaction((conversationId, senderId, body) => {
  const createdAt = now();
  const result = db
    .prepare(
      `
        INSERT INTO messages (conversation_id, sender_id, body, created_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(conversationId, senderId, body.trim(), createdAt);

  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(createdAt, conversationId);

  return db
    .prepare(
      `
        SELECT
          m.id,
          m.conversation_id,
          m.body,
          m.created_at,
          sender.id AS sender_id,
          sender.name AS sender_name,
          sender.email AS sender_email,
          sender.avatar_color AS sender_avatar_color
        FROM messages m
        JOIN users sender ON sender.id = m.sender_id
        WHERE m.id = ?
      `,
    )
    .get(result.lastInsertRowid);
});

export function createMessage({ conversationId, senderId, body }) {
  return mapMessage(createMessageTransaction(conversationId, senderId, body));
}

export function createCall({ conversationId, initiatorId, kind }) {
  const createdAt = now();
  const result = db
    .prepare(
      `
        INSERT INTO calls (conversation_id, initiator_id, kind, status, created_at)
        VALUES (?, ?, ?, 'ringing', ?)
      `,
    )
    .run(conversationId, initiatorId, kind, createdAt);

  return getCallById(result.lastInsertRowid);
}

export function getCallById(callId) {
  return db
    .prepare(
      `
        SELECT id, conversation_id, initiator_id, kind, status, created_at, ended_at
        FROM calls
        WHERE id = ?
      `,
    )
    .get(callId);
}

export function updateCallStatus(callId, status) {
  const endedAt = status === "ringing" || status === "active" ? null : now();
  db.prepare(`UPDATE calls SET status = ?, ended_at = ? WHERE id = ?`).run(status, endedAt, callId);
  return getCallById(callId);
}

