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
  isHostedOnVercel,
  error,
  requiresServerOrigin,
  serverOrigin,
  onSaveServerOrigin,
}) {
  const [form, setForm] = useState(initialForm);
  const [serverOriginDraft, setServerOriginDraft] = useState(serverOrigin);
  const [serverOriginMessage, setServerOriginMessage] = useState("");

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
    await onSubmit(form);
  }

  function handleSaveServerOrigin() {
    const savedServerOrigin = onSaveServerOrigin(serverOriginDraft);
    setServerOriginDraft(savedServerOrigin);
    setServerOriginMessage(`Backend set to ${savedServerOrigin}`);
  }

  function handleUseLocalServer() {
    const savedServerOrigin = onSaveServerOrigin(defaultServerOrigin);
    setServerOriginDraft(savedServerOrigin);
    setServerOriginMessage(`Backend reset to ${savedServerOrigin}`);
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

          {error ? <p className="form-error">{error}</p> : null}

          {requiresServerOrigin ? (
            <p className="form-error">
              Set a backend URL before signing in or signing up.
            </p>
          ) : null}

          <button className="primary-button" disabled={isBusy || requiresServerOrigin} type="submit">
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

        <section className="server-panel">
          <p className="eyebrow">Backend URL</p>
          <p className="subtle-copy">
            If sign up hits the wrong server, point the app to the backend that is actually running.
          </p>

          {isHostedOnVercel ? (
            <p className="server-warning">
              This frontend is running on Vercel. For this project, the backend is not automatically
              available on the same URL, so you need to enter a separate backend origin.
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
              placeholder="http://127.0.0.1:3001"
              type="url"
              value={serverOriginDraft}
            />
          </label>

          <div className="server-actions">
            <button className="secondary-button" onClick={handleSaveServerOrigin} type="button">
              Save backend
            </button>
            <button className="icon-button" onClick={handleUseLocalServer} type="button">
              Use local backend
            </button>
          </div>

          <p className="server-copy">
            Current backend: {serverOrigin || "Not configured yet"}
          </p>
          {serverOriginMessage ? <p className="server-copy">{serverOriginMessage}</p> : null}
        </section>
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
