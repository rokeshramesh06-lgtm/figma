import { useEffect } from "react";

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function NewChatModal({
  isOpen,
  users,
  onlineUserIds,
  onClose,
  onStartConversation,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div aria-modal="true" className="modal-scrim" onClick={onClose} role="dialog">
      <section className="new-chat-modal" onClick={(event) => event.stopPropagation()}>
        <header className="new-chat-header">
          <div>
            <p className="eyebrow">New chat</p>
            <h2>Pick someone to message</h2>
            <p className="subtle-copy">Choose a contact and we will open the direct conversation right away.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className="new-chat-list">
          {users.length ? (
            users.map((user) => (
              <button
                className="new-chat-card"
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
            <p className="empty-copy">
              No other accounts are visible yet. Sign in with a second account and it will show up here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
