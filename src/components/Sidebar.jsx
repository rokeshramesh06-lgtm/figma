function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function previewText(conversation, currentUserId) {
  if (!conversation.lastMessage) {
    return "Start the conversation";
  }

  const prefix = conversation.lastMessage.sender?.id === currentUserId ? "You: " : "";
  return `${prefix}${conversation.lastMessage.body}`;
}

function timeLabel(isoString) {
  if (!isoString) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export default function Sidebar({
  currentUser,
  conversations,
  users,
  activeConversationId,
  onSelectConversation,
  onStartConversation,
  onLogout,
  onlineUserIds,
  searchValue,
  onSearchChange,
  connectionLabel,
  onOpenNewChat,
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="identity-card">
          <div
            className="avatar-pill"
            style={{ "--avatar-color": currentUser.avatarColor || "#0f9d58" }}
          >
            {initials(currentUser.name)}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <p>{connectionLabel}</p>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button className="secondary-button compact" onClick={onOpenNewChat} type="button">
            New chat
          </button>
          <button className="icon-button" onClick={onLogout} type="button">
            Log out
          </button>
        </div>
      </header>

      <label className="search-shell">
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chats or contacts"
          value={searchValue}
        />
      </label>

      <section className="sidebar-section">
        <div className="section-heading">
          <h2>Chats</h2>
          <span>{conversations.length}</span>
        </div>

        <div className="conversation-list">
          {conversations.length ? (
            conversations.map((conversation) => {
              const otherUser = conversation.otherUser;
              const isActive = conversation.id === activeConversationId;
              const isOnline = onlineUserIds.has(otherUser?.id);

              return (
                <button
                  className={`conversation-card ${isActive ? "active" : ""}`}
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  type="button"
                >
                  <div
                    className="avatar-pill"
                    style={{ "--avatar-color": otherUser?.avatarColor || "#128c7e" }}
                  >
                    {initials(otherUser?.name)}
                  </div>
                  <div className="conversation-copy">
                    <div className="conversation-line">
                      <strong>{otherUser?.name || "Unknown contact"}</strong>
                      <span>{timeLabel(conversation.lastMessage?.createdAt || conversation.updatedAt)}</span>
                    </div>
                    <div className="conversation-line">
                      <p>{previewText(conversation, currentUser.id)}</p>
                      <span className={`status-dot ${isOnline ? "online" : ""}`} />
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="empty-copy">No chats yet. Pick a contact below to start.</p>
          )}
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-heading">
          <h2>People</h2>
          <span>{users.length}</span>
        </div>
        <p className="section-copy">Tap any person below to create a direct chat instantly.</p>

        <div className="contact-list">
          {users.length ? (
            users.map((user) => (
              <button
                className="contact-card"
                key={user.id}
                onClick={() => onStartConversation(user)}
                type="button"
              >
                <div className="contact-main">
                  <div
                    className="avatar-pill"
                    style={{ "--avatar-color": user.avatarColor || "#1a73e8" }}
                  >
                    {initials(user.name)}
                  </div>
                  <div>
                    <strong>{user.name}</strong>
                    <p>{user.email}</p>
                  </div>
                </div>
                <div className="contact-actions">
                  <span className={`presence-chip ${onlineUserIds.has(user.id) ? "online" : ""}`}>
                    {onlineUserIds.has(user.id) ? "Online" : "Offline"}
                  </span>
                  <span className="contact-cta">Start chat</span>
                </div>
              </button>
            ))
          ) : (
            <p className="empty-copy">Create a second account in another tab to start chatting.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
