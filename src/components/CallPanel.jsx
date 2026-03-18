function callStatusLabel(status) {
  switch (status) {
    case "calling":
      return "Calling...";
    case "connecting":
      return "Connecting...";
    case "active":
      return "Live now";
    default:
      return "";
  }
}

export default function CallPanel({
  incomingCall,
  callState,
  localVideoRef,
  remoteVideoRef,
  onAcceptIncoming,
  onDeclineIncoming,
  onHangUp,
  onToggleMute,
  onToggleVideo,
}) {
  const activeCallVisible = callState.status !== "idle";
  const peerUser = callState.peerUser || incomingCall?.from;

  if (!incomingCall && !activeCallVisible) {
    return null;
  }

  return (
    <>
      {incomingCall ? (
        <div className="modal-scrim">
          <section className="incoming-call-card">
            <p className="eyebrow">{incomingCall.kind === "audio" ? "Incoming audio call" : "Incoming video call"}</p>
            <h2>{incomingCall.from.name} is calling you</h2>
            <p className="subtle-copy">Accept to open the live call view, or decline to end it.</p>
            <div className="call-actions">
              <button className="secondary-button" onClick={onDeclineIncoming} type="button">
                Decline
              </button>
              <button className="primary-button" onClick={onAcceptIncoming} type="button">
                Accept
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeCallVisible ? (
        <div className="call-overlay">
          <section className="call-stage">
            <header className="call-header">
              <div>
                <p className="eyebrow">{callState.kind === "audio" ? "Audio call" : "Video call"}</p>
                <h2>{peerUser?.name || "Connecting"}</h2>
                <p className="subtle-copy">{callStatusLabel(callState.status)}</p>
              </div>
              <button className="secondary-button" onClick={onHangUp} type="button">
                End call
              </button>
            </header>

            <div className={`media-grid ${callState.kind === "audio" ? "audio-only" : ""}`}>
              <div className="media-card">
                <video
                  autoPlay
                  className={callState.kind === "video" ? "media-video" : "media-sink"}
                  muted
                  playsInline
                  ref={localVideoRef}
                />
                <div className="media-fallback">
                  <strong>You</strong>
                  <span>{callState.muted ? "Muted" : "Mic on"}</span>
                </div>
              </div>

              <div className="media-card">
                <video
                  autoPlay
                  className={callState.kind === "video" ? "media-video" : "media-sink"}
                  playsInline
                  ref={remoteVideoRef}
                />
                <div className="media-fallback">
                  <strong>{peerUser?.name || "Waiting..."}</strong>
                  <span>{callState.status === "active" ? "Connected" : "Waiting for media"}</span>
                </div>
              </div>
            </div>

            <div className="call-actions">
              <button className="icon-button" onClick={onToggleMute} type="button">
                {callState.muted ? "Unmute" : "Mute"}
              </button>
              {callState.kind === "video" ? (
                <button className="icon-button" onClick={onToggleVideo} type="button">
                  {callState.videoEnabled ? "Camera off" : "Camera on"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
