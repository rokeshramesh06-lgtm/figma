import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiRequest } from "./api.js";
import { serverOrigin } from "./config.js";
import AuthScreen from "./components/AuthScreen.jsx";
import CallPanel from "./components/CallPanel.jsx";
import ConversationPane from "./components/ConversationPane.jsx";
import Sidebar from "./components/Sidebar.jsx";

const STORAGE_KEY = "chat-free-session";
const emptyCallState = {
  status: "idle",
  callId: null,
  conversationId: null,
  kind: "video",
  peerUser: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  videoEnabled: true,
};

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sortConversations(conversations) {
  return [...conversations].sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt || left.updatedAt || left.createdAt;
    const rightTime = right.lastMessage?.createdAt || right.updatedAt || right.createdAt;
    return new Date(rightTime) - new Date(leftTime);
  });
}

function upsertConversation(conversations, incomingConversation) {
  const nextConversations = conversations.filter((conversation) => conversation.id !== incomingConversation.id);
  nextConversations.push(incomingConversation);
  return sortConversations(nextConversations);
}

function appendMessage(currentMap, message) {
  const existingMessages = currentMap[message.conversationId] || [];

  if (existingMessages.some((entry) => entry.id === message.id)) {
    return currentMap;
  }

  return {
    ...currentMap,
    [message.conversationId]: [...existingMessages, message],
  };
}

function stopStream(stream) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export default function App() {
  const [session, setSession] = useState(() => getStoredSession());
  const [authMode, setAuthMode] = useState("signup");
  const [authError, setAuthError] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState(emptyCallState);

  const token = session?.token || null;
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const currentCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const onlineUserSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];
  const normalizedSearch = searchValue.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const nameMatch = conversation.otherUser?.name?.toLowerCase().includes(normalizedSearch);
      const emailMatch = conversation.otherUser?.email?.toLowerCase().includes(normalizedSearch);
      const messageMatch = conversation.lastMessage?.body?.toLowerCase().includes(normalizedSearch);
      return nameMatch || emailMatch || messageMatch;
    });
  }, [conversations, normalizedSearch]);

  const filteredUsers = useMemo(() => {
    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, users]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = callState.localStream || null;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = callState.remoteStream || null;
    }
  }, [callState.remoteStream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversationId, activeMessages.length]);

  function resetRealtimeState() {
    setUsers([]);
    setConversations([]);
    setMessagesByConversation({});
    setActiveConversationId(null);
    setMessageDraft("");
    setComposerError("");
    setSearchValue("");
    setOnlineUserIds([]);
    setIncomingCall(null);
    setNotice("");
    setCallState(emptyCallState);
  }

  function releaseCallResources() {
    pendingIceCandidatesRef.current = [];

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopStream(localStreamRef.current);
    stopStream(remoteStreamRef.current);

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    currentCallRef.current = null;
  }

  function cleanupCall(nextNotice = "") {
    releaseCallResources();
    setIncomingCall(null);
    setCallState(emptyCallState);
    if (nextNotice) {
      setNotice(nextNotice);
    }
  }

  function signOut() {
    const activeCallId = currentCallRef.current?.callId;
    if (activeCallId && socketRef.current?.connected) {
      socketRef.current.emit("call:end", { callId: activeCallId, reason: "ended" });
    }

    releaseCallResources();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSession(null);
    setAuthError("");
    resetRealtimeState();
  }

  async function emitWithAck(eventName, payload) {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error("Realtime connection is not ready yet."));
        return;
      }

      socket.emit(eventName, payload, (response) => {
        if (response?.ok) {
          resolve(response);
          return;
        }

        reject(new Error(response?.error || "Something went wrong."));
      });
    });
  }

  async function flushPendingIceCandidates(callId) {
    if (!socketRef.current?.connected || !callId) {
      return;
    }

    for (const candidate of pendingIceCandidatesRef.current) {
      socketRef.current.emit("call:ice-candidate", { callId, candidate });
    }

    pendingIceCandidatesRef.current = [];
  }

  async function createPeerConnection({ kind, conversationId, peerUser, callId = null }) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Your browser does not support WebRTC calling here.");
    }

    releaseCallResources();

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });
    const remoteStream = new MediaStream();
    const peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      const [remoteMediaStream] = event.streams;

      if (remoteMediaStream) {
        remoteMediaStream.getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
        return;
      }

      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const activeCallId = currentCallRef.current?.callId;
      if (activeCallId) {
        socketRef.current?.emit("call:ice-candidate", {
          callId: activeCallId,
          candidate: event.candidate,
        });
        return;
      }

      pendingIceCandidatesRef.current.push(event.candidate);
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        setCallState((current) => ({ ...current, status: "active" }));
        setNotice("");
      }

      if (peerConnection.connectionState === "failed") {
        cleanupCall("Call connection failed.");
      }
    };

    peerConnectionRef.current = peerConnection;
    localStreamRef.current = localStream;
    remoteStreamRef.current = remoteStream;
    currentCallRef.current = {
      callId,
      conversationId,
      kind,
      peerUser,
    };

    setCallState({
      status: callId ? "connecting" : "calling",
      callId,
      conversationId,
      kind,
      peerUser,
      localStream,
      remoteStream,
      muted: false,
      videoEnabled: kind === "video",
    });

    return peerConnection;
  }

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let ignore = false;

    async function bootstrap() {
      setIsBootstrapping(true);

      try {
        const [mePayload, usersPayload, conversationsPayload] = await Promise.all([
          apiRequest("/api/auth/me", { token }),
          apiRequest("/api/users", { token }),
          apiRequest("/api/conversations", { token }),
        ]);

        if (ignore) {
          return;
        }

        setSession((current) => (current ? { ...current, user: mePayload.user } : current));
        setUsers(usersPayload.users);
        setConversations(sortConversations(conversationsPayload.conversations));
        setActiveConversationId((current) => {
          if (current && conversationsPayload.conversations.some((item) => item.id === current)) {
            return current;
          }

          return conversationsPayload.conversations[0]?.id || null;
        });
      } catch (error) {
        if (!ignore) {
          signOut();
          setAuthError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = io(serverOrigin, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketReady(true);
    });

    socket.on("disconnect", () => {
      setSocketReady(false);
    });

    socket.on("presence:snapshot", ({ userIds }) => {
      setOnlineUserIds(userIds.map(Number));
    });

    socket.on("presence:update", ({ userId, online }) => {
      setOnlineUserIds((current) => {
        if (online) {
          return current.includes(userId) ? current : [...current, userId];
        }

        return current.filter((id) => id !== userId);
      });
    });

    socket.on("conversation:created", ({ conversation }) => {
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId((current) => current || conversation.id);
    });

    socket.on("conversation:summary", ({ conversation }) => {
      setConversations((current) => upsertConversation(current, conversation));
    });

    socket.on("message:new", ({ message }) => {
      setMessagesByConversation((current) => appendMessage(current, message));
    });

    socket.on("call:incoming", (payload) => {
      if (currentCallRef.current?.callId || incomingCallRef.current?.callId) {
        socket.emit("call:end", { callId: payload.callId, reason: "busy" });
        return;
      }

      setActiveConversationId(payload.conversationId);
      setIncomingCall(payload);
      setNotice(`${payload.from.name} is calling...`);
    });

    socket.on("call:answered", async ({ callId, answer }) => {
      if (currentCallRef.current?.callId !== callId || !peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(answer);
        setCallState((current) => ({ ...current, status: "active" }));
        setNotice("");
      } catch {
        cleanupCall("Call connection failed.");
      }
    });

    socket.on("call:ice-candidate", async ({ callId, candidate }) => {
      if (currentCallRef.current?.callId !== callId || !peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch {
        setNotice("A network issue interrupted the call.");
      }
    });

    socket.on("call:ended", ({ callId, reason }) => {
      if (incomingCallRef.current?.callId === callId) {
        setIncomingCall(null);
        setNotice(reason === "declined" ? "Call declined." : "Missed or canceled call.");
      }

      if (currentCallRef.current?.callId === callId) {
        if (reason === "declined") {
          cleanupCall("Call declined.");
          return;
        }

        if (reason === "busy") {
          cleanupCall("That person is on another call.");
          return;
        }

        cleanupCall("Call ended.");
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setSocketReady(false);
    };
  }, [token]);

  const hasMessagesLoaded = activeConversationId
    ? Object.prototype.hasOwnProperty.call(messagesByConversation, activeConversationId)
    : false;

  useEffect(() => {
    if (!token || !activeConversationId || hasMessagesLoaded) {
      return undefined;
    }

    let ignore = false;
    setIsLoadingMessages(true);

    apiRequest(`/api/conversations/${activeConversationId}/messages`, { token })
      .then((payload) => {
        if (ignore) {
          return;
        }

        setMessagesByConversation((current) => ({
          ...current,
          [activeConversationId]: payload.messages,
        }));
      })
      .catch((error) => {
        if (!ignore) {
          setNotice(error.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingMessages(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeConversationId, hasMessagesLoaded, token]);

  async function handleAuthSubmit(form) {
    setIsAuthBusy(true);
    setAuthError("");

    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const payload = await apiRequest(endpoint, {
        method: "POST",
        body: form,
      });

      resetRealtimeState();
      setSession({ token: payload.token, user: payload.user });
      setAuthMode("signin");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleStartConversation(user) {
    if (!token) {
      return;
    }

    try {
      setNotice("");
      const payload = await apiRequest("/api/conversations/direct", {
        method: "POST",
        token,
        body: { userId: user.id },
      });

      setConversations((current) => upsertConversation(current, payload.conversation));
      setActiveConversationId(payload.conversation.id);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!messageDraft.trim() || !activeConversationId) {
      return;
    }

    try {
      setComposerError("");
      await emitWithAck("message:send", {
        conversationId: activeConversationId,
        body: messageDraft,
      });
      setMessageDraft("");
    } catch (error) {
      setComposerError(error.message);
    }
  }

  async function handleStartCall(kind) {
    if (!activeConversation?.otherUser) {
      return;
    }

    try {
      setNotice("");

      const peerConnection = await createPeerConnection({
        kind,
        conversationId: activeConversation.id,
        peerUser: activeConversation.otherUser,
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await emitWithAck("call:start", {
        conversationId: activeConversation.id,
        kind,
        offer,
      });

      currentCallRef.current = {
        callId: response.callId,
        conversationId: activeConversation.id,
        kind,
        peerUser: activeConversation.otherUser,
      };
      setCallState((current) => ({ ...current, callId: response.callId }));
      await flushPendingIceCandidates(response.callId);
    } catch (error) {
      cleanupCall(error.message);
    }
  }

  async function handleAcceptIncomingCall() {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) {
      return;
    }

    try {
      setIncomingCall(null);
      setNotice("");

      const peerConnection = await createPeerConnection({
        kind: pendingCall.kind,
        conversationId: pendingCall.conversationId,
        peerUser: pendingCall.from,
        callId: pendingCall.callId,
      });

      await peerConnection.setRemoteDescription(pendingCall.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await emitWithAck("call:answer", {
        callId: pendingCall.callId,
        answer,
      });

      setCallState((current) => ({ ...current, status: "connecting", callId: pendingCall.callId }));
      await flushPendingIceCandidates(pendingCall.callId);
    } catch (error) {
      socketRef.current?.emit("call:end", { callId: pendingCall.callId, reason: "ended" });
      cleanupCall(error.message);
    }
  }

  async function handleDeclineIncomingCall() {
    const pendingCall = incomingCallRef.current;
    setIncomingCall(null);
    setNotice("Call declined.");

    if (!pendingCall) {
      return;
    }

    try {
      await emitWithAck("call:end", { callId: pendingCall.callId, reason: "declined" });
    } catch {
      setNotice("Unable to decline the call cleanly.");
    }
  }

  async function handleHangUp() {
    const activeCallId = currentCallRef.current?.callId;
    cleanupCall("");

    if (!activeCallId) {
      return;
    }

    try {
      await emitWithAck("call:end", { callId: activeCallId, reason: "ended" });
    } catch {
      setNotice("The call closed locally, but the remote hang-up notice failed.");
    }
  }

  function handleToggleMute() {
    const audioTrack = localStreamRef.current?.getAudioTracks()?.[0];
    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setCallState((current) => ({ ...current, muted: !audioTrack.enabled }));
  }

  function handleToggleVideo() {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];
    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setCallState((current) => ({ ...current, videoEnabled: videoTrack.enabled }));
  }

  if (!session?.token || !session.user) {
    return (
      <AuthScreen
        error={authError}
        isBusy={isAuthBusy}
        mode={authMode}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="app-frame">
        <Sidebar
          activeConversationId={activeConversationId}
          conversations={filteredConversations}
          currentUser={session.user}
          onlineUserIds={onlineUserSet}
          onLogout={signOut}
          onSearchChange={setSearchValue}
          onSelectConversation={setActiveConversationId}
          onStartConversation={handleStartConversation}
          searchValue={searchValue}
          socketReady={socketReady}
          users={filteredUsers}
        />

        <ConversationPane
          composerError={composerError}
          conversation={activeConversation}
          currentUser={session.user}
          draft={messageDraft}
          loadingMessages={isLoadingMessages || isBootstrapping}
          messages={activeMessages}
          messagesEndRef={messagesEndRef}
          notice={notice}
          onDraftChange={setMessageDraft}
          onSend={handleSendMessage}
          onStartCall={handleStartCall}
          onlineUserIds={onlineUserSet}
          socketReady={socketReady}
        />
      </section>

      <CallPanel
        callState={callState}
        incomingCall={incomingCall}
        localVideoRef={localVideoRef}
        onAcceptIncoming={handleAcceptIncomingCall}
        onDeclineIncoming={handleDeclineIncomingCall}
        onHangUp={handleHangUp}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        remoteVideoRef={remoteVideoRef}
      />
    </main>
  );
}
