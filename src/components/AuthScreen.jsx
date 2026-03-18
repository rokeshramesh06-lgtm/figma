import { useEffect, useState } from "react";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

export default function AuthScreen({
  defaultServerOrigin,
  mode,
  onModeChange,
  onSubmit,
  isBusy,
  isCheckingServerOrigin,
  error,
  requiresServerOrigin,
  serverOrigin,
  onDetectServerOrigin,
  onSaveServerOrigin,
}) {
  const [form, setForm] = useState(initialForm);
  const [serverOriginDraft, setServerOriginDraft] = useState(serverOrigin);
  const [serverOriginMessage, setServerOriginMessage] = useState("");
  const hasServerOriginDraft = Boolean(serverOriginDraft.trim());
  const shouldShowInlineServerSetup = isCheckingServerOrigin || requiresServerOrigin;

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: mode === "signup" ? current.name : "",
      password: "",
    }));
  }, [mode]);

  useEffect(() => {
    setServerOriginDraft(serverOrigin);
  }, [serverOrigin]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!serverOrigin && hasServerOriginDraft) {
      const savedServerOrigin = onSaveServerOrigin(serverOriginDraft);

      if (!savedServerOrigin) {
        setServerOriginMessage("Enter a full backend URL like https://your-backend.example.com.");
        return;
      }

      setServerOriginDraft(savedServerOrigin);
      setServerOriginMessage(`Backend set to ${savedServerOrigin}`);
    }

    if (!serverOrigin && !hasServerOriginDraft) {
      setServerOriginMessage("Enter a backend URL below, then press the button again.");
      return;
    }

    await onSubmit(form);
  }

  function handleSaveServerOrigin() {
    const savedServerOrigin = onSaveServerOrigin(serverOriginDraft);
    if (!savedServerOrigin) {
      setServerOriginMessage("Enter a full backend URL like https://your-backend.example.com.");
      return;
    }

    setServerOriginDraft(savedServerOrigin);
    setServerOriginMessage(`Backend set to ${savedServerOrigin}`);
  }

  function handleUseLocalServer() {
    const savedServerOrigin = onSaveServerOrigin(defaultServerOrigin);
    setServerOriginDraft(savedServerOrigin);
    setServerOriginMessage(`Backend reset to ${savedServerOrigin}`);
  }

  function renderServerPanel(isInline = false) {
    return (
      <section className={`server-panel${isInline ? " inline-server-panel" : ""}`}>
        <p className="eyebrow">Backend URL</p>
        <p className="subtle-copy">
          Paste the backend origin here. The app will save it automatically when you sign in or
          sign up.
        </p>

        {requiresServerOrigin && !isCheckingServerOrigin ? (
          <p className="server-warning">
            No same-origin backend was detected for this deployment yet. Enter a backend URL, or
            try detecting a same-origin `/api` backend again.
          </p>
        ) : null}

        <label className="field">
          <span>Server</span>
          <input
            name="serverOrigin"
            onChange={(event) => {
              setServerOriginDraft(event.target.value);
              setServerOriginMessage("");
            }}
            placeholder="https://your-backend.example.com"
            type="url"
            value={serverOriginDraft}
          />
        </label>

        <div className="server-actions">
          <button className="secondary-button" disabled={isCheckingServerOrigin} onClick={handleSaveServerOrigin} type="button">
            Save backend
          </button>
          <button
            className="secondary-button"
            disabled={isCheckingServerOrigin}
            onClick={onDetectServerOrigin}
            type="button"
          >
            {isCheckingServerOrigin ? "Checking..." : "Detect backend"}
          </button>
          <button className="icon-button" disabled={isCheckingServerOrigin} onClick={handleUseLocalServer} type="button">
            Use local backend
          </button>
        </div>

        <p className="server-copy">
          Current backend: {serverOrigin || "Not configured yet"}
        </p>
        {serverOriginMessage ? <p className="server-copy">{serverOriginMessage}</p> : null}
      </section>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-badge">CF</div>
          <div>
            <p className="eyebrow">Realtime chat and calling</p>
            <h1>Chat Free</h1>
            <p className="subtle-copy">
              Sign in to start messaging instantly, or create a fresh account backed by SQLite.
            </p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <label className="field">
              <span>Name</span>
              <input
                autoComplete="name"
                name="name"
                onChange={updateField}
                placeholder="Aarav Sharma"
                required
                value={form.name}
              />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              onChange={updateField}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              name="password"
              onChange={updateField}
              placeholder="Minimum 6 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {shouldShowInlineServerSetup ? renderServerPanel(true) : null}

          {error ? <p className="form-error">{error}</p> : null}

          {isCheckingServerOrigin ? (
            <p className="server-copy">Checking whether this deployment already exposes the backend...</p>
          ) : null}

          {!isCheckingServerOrigin && requiresServerOrigin ? (
            <p className="form-error">
              Enter a backend URL above. You can paste it and submit right away.
            </p>
          ) : null}

          <button
            className="primary-button"
            disabled={isBusy || isCheckingServerOrigin || (!serverOrigin && !hasServerOriginDraft)}
            type="submit"
          >
            {isBusy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="secondary-button"
          onClick={() => onModeChange(mode === "signin" ? "signup" : "signin")}
          type="button"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        {!shouldShowInlineServerSetup ? renderServerPanel(false) : null}
      </section>

      <aside className="auth-preview">
        <div className="preview-card">
          <p className="eyebrow">What is included</p>
          <h2>WhatsApp-style essentials, ready locally.</h2>
          <ul className="feature-list">
            <li>JWT sign up and sign in</li>
            <li>SQLite persistence for users, chats, and call history</li>
            <li>Real-time messaging with Socket.IO</li>
            <li>Browser audio and video calling with WebRTC signaling</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
