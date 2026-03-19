function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function messageTime(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export default function ConversationPane({
  conversation,
  currentUser,
  messages,
  draft,
  onDraftChange,
  onSend,
  onStartCall,
  onlineUserIds,
  messagingReady,
  callingEnabled,
  loadingMessages,
  composerError,
  notice,
  messagesEndRef,
}) {
  if (!conversation) {
    return (
      <section className="conversation-pane empty-state-pane">
        <div className="welcome-card">
          <p className="eyebrow">Ready to chat</p>
          <h2>Select a chat or start one from the people list.</h2>
          <p className="subtle-copy">
            Open this app in two browser windows, create two accounts, and you can test messaging
            and calling immediately.
          </p>
        </div>
      </section>
    );
  }

  const otherUser = conversation.otherUser;
  const isOnline = onlineUserIds.has(otherUser?.id);

  return (
    <section className="conversation-pane">
      <header className="conversation-header">
        <div className="contact-main">
          <div
            className="avatar-pill"
            style={{ "--avatar-color": otherUser?.avatarColor || "#0f9d58" }}
          >
            {initials(otherUser?.name)}
          </div>
          <div>
            <strong>{otherUser?.name}</strong>
            <p>{isOnline ? "Online now" : "Available for chat"}</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="icon-button" disabled={!callingEnabled} onClick={() => onStartCall("audio")} type="button">
            Audio call
          </button>
          <button className="primary-button compact" disabled={!callingEnabled} onClick={() => onStartCall("video")} type="button">
            Video call
          </button>
        </div>
      </header>

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <div className="messages-panel">
        {loadingMessages ? <p className="empty-copy">Loading messages...</p> : null}

        {messages.map((message) => {
          const isOwn = message.sender.id === currentUser.id;

          return (
            <article className={`message-row ${isOwn ? "own" : ""}`} key={message.id}>
              <div className={`message-bubble ${isOwn ? "own" : ""}`}>
                {!isOwn ? <strong>{message.sender.name}</strong> : null}
                <p>{message.body}</p>
                <span>{messageTime(message.createdAt)}</span>
              </div>
            </article>
          );
        })}

        {!messages.length && !loadingMessages ? (
          <p className="empty-copy">No messages yet. Send the first one.</p>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form className="composer" onSubmit={onSend}>
        <textarea
          disabled={!messagingReady}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={messagingReady ? "Type a message" : "Connecting to chat service..."}
          rows={1}
          value={draft}
        />
        <button className="primary-button compact" disabled={!messagingReady || !draft.trim()} type="submit">
          Send
        </button>
      </form>

      {composerError ? <p className="form-error composer-error">{composerError}</p> : null}
    </section>
  );
}
