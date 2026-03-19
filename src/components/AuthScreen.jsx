import { useEffect, useState } from "react";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

export default function AuthScreen({
  mode,
  onModeChange,
  onSubmit,
  isBusy,
  isCheckingServerOrigin,
  error,
  requiresServerOrigin,
  onDetectServerOrigin,
}) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: mode === "signup" ? current.name : "",
      password: "",
    }));
  }, [mode]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (requiresServerOrigin) {
      return;
    }

    await onSubmit(form);
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

          {isCheckingServerOrigin ? (
            <p className="server-copy">Checking whether this deployment already exposes the shared backend...</p>
          ) : null}

          {!isCheckingServerOrigin && requiresServerOrigin ? (
            <section className="server-panel inline-server-panel">
              <p className="eyebrow">Service Status</p>
              <p className="subtle-copy">
                This site is waiting for its shared backend connection. End users do not need to
                enter anything here.
              </p>
              <p className="server-warning">
                The deployment could not find its configured backend yet. Retry the check, or set
                `BACKEND_ORIGIN` in Vercel so this site can proxy `/api` and `/socket.io` to the
                shared backend.
              </p>
              <div className="server-actions">
                <button className="secondary-button" onClick={onDetectServerOrigin} type="button">
                  Retry backend check
                </button>
              </div>
            </section>
          ) : null}

          <button
            className="primary-button"
            disabled={isBusy || isCheckingServerOrigin || requiresServerOrigin}
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
