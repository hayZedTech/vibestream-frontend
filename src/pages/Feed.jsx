// src/pages/Feed.jsx
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";
import Swal from "sweetalert2";
import DOMPurify from "dompurify";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
// do not auto-connect until we have username
const socket = io(SOCKET_URL, { autoConnect: false });

export default function Feed({ isProfile = false }) {
  // posts
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetching, setFetching] = useState(false);

  // notifications & chat
  const [notifications, setNotifications] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [chatTo, setChatTo] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showInboxList, setShowInboxList] = useState(false);

  // NEW: lift notifications open state so we can coordinate with inbox
  const [showNotifications, setShowNotifications] = useState(false);

  const MAX_IMAGE_SIZE_MB = 3;
  const LIMIT = 5;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const { id: profileId } = useParams();

  // keep username/id in state so updates re-render and functions use latest
  const [loggedInUsername, setLoggedInUsername] = useState(localStorage.getItem("username") || "");
  const [loggedInUserId, setLoggedInUserId] = useState(localStorage.getItem("userId") || "");

  const chatInputRef = useRef(null);
  const chatListRef = useRef(null);
  const quickNameRef = useRef(null);

  // ---------------------- utility: try multiple auth/me endpoints ----------------------
  const tryLoadCurrentUser = async () => {
    const tries = ["auth/me", "/auth/me", "api/auth/me", "/api/auth/me"];
    for (const p of tries) {
      try {
        const res = await API.get(p);
        if (res && res.data) {
          const u = res.data.username || res.data.user?.username || res.data.name || res.data.user?.name;
          const id = res.data.id || res.data._id || res.data.user?._id || res.data.user?.id;
          if (u) {
            setLoggedInUsername(u);
            if (id) setLoggedInUserId(id);
            localStorage.setItem("username", u);
            if (id) localStorage.setItem("userId", id);
            console.debug("Loaded current user from", p, u, id);
            return { username: u, id };
          }
        }
      } catch (e) {
        // try next
      }
    }
    return null;
  };

  // ---------------------- fetch notifications ----------------------
  const fetchNotifications = async (username = loggedInUsername) => {
    if (!username) return;
    try {
      const res = await API.get("/notifications");
      setNotifications(res.data || []);
    } catch (e) {
      console.warn("Could not load notifications:", e?.response?.data || e?.message || e);
    }
  };

  // ---------------------- fetch recent messages ----------------------
  const fetchRecentMessages = async (username = loggedInUsername) => {
    if (!username) return;
    try {
      try {
        const res = await API.get(`/messages/recent?user=${encodeURIComponent(username)}`);
        setRecentMessages(res.data || []);
        return;
      } catch (innerErr) {
        const res2 = await API.get(`/messages?user=${encodeURIComponent(username)}`);
        setRecentMessages(res2.data || []);
        return;
      }
    } catch (e) {
      console.warn("Failed to load recent messages:", e?.response?.data || e?.message || e);
      setRecentMessages([]);
    }
  };

  const fetchUnreadCount = async (username = loggedInUsername) => {
    if (!username) return 0;
    try {
      const res = await API.get(`/messages/unread-count?user=${encodeURIComponent(username)}`);
      return (res.data && res.data.unread) ? Number(res.data.unread) : 0;
    } catch (e) {
      console.warn("Failed to load unread count", e?.response?.data || e?.message || e);
      return recentMessages.filter((m) => m.toUsername === username && !m.read).length;
    }
  };

  // ---------------------- initialize user & socket ----------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (loggedInUsername) {
        try {
          if (!socket.connected) socket.connect();
          socket.emit("join", loggedInUsername);
        } catch (e) { console.warn("socket join error:", e); }
        fetchRecentMessages(loggedInUsername);
        fetchNotifications(loggedInUsername);
        return;
      }

      const user = await tryLoadCurrentUser();
      if (cancelled) return;
      if (user && user.username) {
        try {
          if (!socket.connected) socket.connect();
          socket.emit("join", user.username);
        } catch (e) { console.warn("socket join after load error:", e); }
        fetchRecentMessages(user.username);
        fetchNotifications(user.username);
        return;
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ---------------------- socket handlers (depend on username) ----------------------
  useEffect(() => {
    if (!loggedInUsername) {
      return;
    }

    if (!socket.connected) socket.connect();
    try { socket.emit("join", loggedInUsername); } catch (e) { console.warn("join emit failed", e); }

    socket.on("onlineUsers", (list) => setOnlineUsers(Array.isArray(list) ? list : []));
    socket.on("newPost", (post) => setPosts((prev) => [post, ...prev]));
    socket.on("newLike", ({ postId, fromUserId }) => {
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, likes: [...(p.likes || []), fromUserId] } : p)));
    });
    socket.on("newComment", ({ postId, text, fromUserId }) => {
      setPosts((prev) => prev.map((p) => p._id === postId ? { ...p, comments: [...(p.comments || []), { text, user: { _id: fromUserId, username: "Someone" } }] } : p));
    });
    socket.on("notification", (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      Swal.fire({ toast: true, position: "top-end", icon: "info", title: `${notif.type} from ${notif.fromUsername || "Someone"}`, showConfirmButton: false, timer: 2500 });
    });

    socket.on("chatMessage", (msg) => {
      setRecentMessages((prev) => {
        const arr = Array.isArray(prev) ? [...prev] : [];
        const idx = arr.findIndex((m) => (m._id && msg._id && m._id === msg._id) || (m.createdAt === msg.createdAt && m.fromUsername === msg.fromUsername && m.toUsername === msg.toUsername && m.text === msg.text));
        if (idx >= 0) arr.splice(idx, 1);
        arr.unshift(msg);
        return arr;
      });

      const belongsToOpen = chatTo && (msg.fromUsername === chatTo || msg.toUsername === chatTo);
      if (belongsToOpen || !chatTo) setChatMessages((prev) => [...prev, msg]);

      if (msg.toUsername === loggedInUsername || msg.fromUsername === chatTo) {
        setChatVisible(true);
      } else {
        Swal.fire({ toast: true, position: "top-end", icon: "info", title: `Message from ${msg.fromUsername}: ${String(msg.text).slice(0, 80)}`, showConfirmButton: false, timer: 2500 });
      }
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("newPost");
      socket.off("newLike");
      socket.off("newComment");
      socket.off("notification");
      socket.off("chatMessage");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUsername, chatTo]);

  // ---------------------- posts fetch ----------------------
  useEffect(() => {
    setPage(1);
    setPosts([]);
    setHasMore(true);
  }, [isProfile, profileId]);

  useEffect(() => {
    if (fetching) return;
    setFetching(true);
    const fetchPosts = async () => {
      try {
        const url = isProfile ? `/posts/user/${profileId}?page=${page}&limit=${LIMIT}` : `/posts?page=${page}&limit=${LIMIT}`;
        const res = await API.get(url);
        setPosts((prev) => (page === 1 ? res.data.posts : [...prev, ...(res.data.posts || [])]));
        const totalPages = res.data.totalPages ?? null;
        setHasMore(totalPages !== null ? page < totalPages : (res.data.posts?.length ?? 0) === LIMIT);
      } catch (err) {
        console.warn("Error loading posts:", err?.response?.data || err?.message || err);
      } finally {
        setFetching(false);
      }
    };
    fetchPosts();
  }, [page, isProfile, profileId]);

  // ---------------------- image validation ----------------------
  const validateImage = (file) => {
    if (!file) return true;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_IMAGE_SIZE_MB) { Swal.fire("Image too large", `Maximum ${MAX_IMAGE_SIZE_MB}MB`, "warning"); return false; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { Swal.fire("Invalid type", "JPEG, PNG, GIF, WEBP only", "warning"); return false; }
    return true;
  };

  // ---------------------- create post ----------------------
  const handleCreatePost = async () => {
    if (!newPostText && !newPostImage) { Swal.fire("Empty Post", "Write something or add an image", "warning"); return; }
    if (!validateImage(newPostImage)) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append("text", DOMPurify.sanitize(newPostText));
      if (newPostImage instanceof File) form.append("image", newPostImage);
      const res = await API.post("/posts", form, { headers: { "Content-Type": "multipart/form-data" } });
      setPosts((prev) => [res.data, ...prev]);
      setNewPostText(""); setNewPostImage(null); setPreviewImage(null);
      Swal.fire({ icon: "success", title: "Posted 🎉", timer: 1500, showConfirmButton: false });
      socket.emit("newPost", res.data);
    } catch (err) {
      console.error("create post error", err);
      Swal.fire("Error", "Failed to create post", "error");
    } finally { setLoading(false); }
  };

  // ---------------------- like / comment / delete ----------------------
  const handleLike = async (postId) => {
    try {
      const res = await API.put(`/posts/${postId}/like`);
      setPosts((prev) => prev.map((p) => (p._id === postId ? res.data : p)));
      socket.emit("newLike", { postId, fromUserId: loggedInUsername, postOwnerId: res.data.user.username });
    } catch (err) {
      console.warn("like error", err);
      Swal.fire("Error", "Failed to update like", "error");
    }
  };

  const handleComment = async (postId, text) => {
    if (!text) return;
    try {
      const sanitized = DOMPurify.sanitize(text);
      const res = await API.post(`/posts/${postId}/comment`, { text: sanitized });
      setPosts((prev) => prev.map((p) => (p._id === postId ? res.data : p)));
      socket.emit("newComment", { postId, text: sanitized, fromUserId: loggedInUsername, postOwnerId: res.data.user.username });
    } catch (err) {
      console.warn("comment error", err);
      Swal.fire("Error", "Failed to add comment", "error");
    }
  };

  const handleDelete = async (postId) => {
    const confirm = await Swal.fire({ title: "Delete post?", text: "Cannot undo", icon: "warning", showCancelButton: true, confirmButtonText: "Yes" });
    if (!confirm.isConfirmed) return;
    try { await API.delete(`/posts/${postId}`); setPosts((prev) => prev.filter((p) => p._id !== postId)); Swal.fire("Deleted!", "Your post has been deleted", "success"); }
    catch (err) { console.warn("delete error", err); Swal.fire("Error", "Failed to delete post", "error"); }
  };

  // ---------------------- conversation fetch ----------------------
  const fetchConversation = async (userA, userB) => {
    if (!userA || !userB) return;
    try {
      const res = await API.get(`/messages/conversation?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`);
      setChatMessages(res.data || []);
      try {
        await API.put('/messages/conversation/mark-read', { username: loggedInUsername, peer: userB });
        setRecentMessages((prev) => prev.map(m => (m.fromUsername === userB && m.toUsername === loggedInUsername ? { ...m, read: true } : m)));
      } catch (e) { /* non-fatal */ }
    } catch (e) {
      console.warn("fetchConversation error", e);
      setChatMessages([]);
    }
  };

  // ---------------------- send message ----------------------
  const sendMessage = async () => {
    if (!chatTo || !chatInputRef.current || !chatInputRef.current.value.trim()) return;
    if (!loggedInUsername) {
      Swal.fire("Not logged in", "Set your display name (top-right) before sending messages.", "warning");
      return;
    }

    // Prevent sending to self
    if ((chatTo || "").trim() === (loggedInUsername || "").trim()) {
      Swal.fire({ icon: "info", title: "Cannot message yourself", text: "Choose another user to chat with.", timer: 1500, showConfirmButton: false });
      return;
    }

    const text = chatInputRef.current.value.trim();
    const payload = { fromUsername: loggedInUsername, toUsername: chatTo.trim(), text };

    const tempMsg = { ...payload, createdAt: new Date().toISOString(), _id: `temp-${Date.now()}`, read: false };
    setChatMessages((prev) => [...prev, tempMsg]);
    setRecentMessages((prev) => [tempMsg, ...prev.filter(m => m._id !== tempMsg._id)]);
    chatInputRef.current.value = "";
    setChatVisible(true);

    try {
      const res = await API.post('/messages', payload);
      const saved = res.data;
      setChatMessages((prev) => {
        const withoutTemp = prev.filter(m => m._id !== tempMsg._id);
        return [...withoutTemp, saved];
      });
      await fetchRecentMessages(loggedInUsername);
      await fetchConversation(loggedInUsername, chatTo);
    } catch (err) {
      console.error("sendMessage error (POST)", err);
      const serverMsg = err?.response?.data?.msg || err?.response?.data || err.message || String(err);
      Swal.fire("Send failed", String(serverMsg), "error");
      try {
        socket.emit("chatMessage", payload);
      } catch (emitErr) {
        console.warn("socket emit fallback failed", emitErr);
      }
    }
  };

  const openChatWith = (username) => {
    if (!username) return;
    // Prevent opening a chat with self
    if ((username || "").trim() === (loggedInUsername || "").trim()) {
      Swal.fire({ icon: "info", title: "Cannot message yourself", timer: 1200, showConfirmButton: false });
      return;
    }
    setChatTo(username);
    setChatVisible(true);
    fetchConversation(loggedInUsername, username);
  };

  const unreadCount = recentMessages.filter((m) => m.toUsername === loggedInUsername && !m.read).length;

  const OnlineDot = ({ username }) => {
    const isOnline = onlineUsers.includes(username);
    return (
      <span style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        background: isOnline ? '#28a745' : '#ced4da', marginLeft: -14, marginTop: -34, marginRight: 8,
        border: '2px solid white', boxShadow: '0 0 0 2px rgba(0,0,0,0.03)'
      }} title={isOnline ? 'Online' : 'Offline'} />
    );
  };

  useEffect(() => { if (chatTo) fetchConversation(loggedInUsername, chatTo); }, [chatTo]);

  useEffect(() => { if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight; }, [chatMessages, chatVisible]);

  const setQuickName = () => {
    const v = (quickNameRef.current?.value || "").trim();
    if (!v) { Swal.fire("Enter a name", "Please enter a display name to enable chat.", "warning"); return; }
    setLoggedInUsername(v);
    localStorage.setItem("username", v);
    try {
      if (!socket.connected) socket.connect();
      socket.emit("join", v);
    } catch (e) { console.warn("socket join after set name failed", e); }
    fetchRecentMessages(v);
    fetchNotifications(v);
  };

  const handleNotificationClick = (notif) => {
    if (notif.postId) {
      const postElem = document.getElementById(`post-${notif.postId}`);
      if (postElem) postElem.scrollIntoView({ behavior: "smooth" });
    } else if (notif.fromUsername) {
      openChatWith(notif.fromUsername);
    }
  };

  // ---------------------- render ----------------------
  return (
    
    <div className="container mt-4" style={{ maxWidth: 800}}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0 fw-bold">{isProfile ? "👤 My Posts" : "📢 Social Feed"}</h2>

        <div className="d-flex align-items-center">
          <div className="me-2">
            {/* Notifications now controlled by parent so we can close inbox when opening */}
            <NotificationsDropdown
              notifications={notifications}
              onClickNotif={handleNotificationClick}
              open={showNotifications}
              setOpen={(v) => { setShowNotifications(v); if (v) setShowInboxList(false); }}
            />
          </div>

          <div className="position-relative me-2">
            {/* clicking inbox toggles inbox and closes notifications */}
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => { setShowInboxList((s) => { const next = !s; if (next) setShowNotifications(false); return next; }); }}
              title="Inbox"
            >
              ✉️
            </button>
            {unreadCount > 0 && (<span style={{ position: "absolute", top: -6, right: -6, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{unreadCount}</span>)}

            {showInboxList && (
              <div className="card shadow-sm position-absolute end-0 mt-2" style={{ width: 320, zIndex: 2000 }}>
                <div className="card-body p-2">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Inbox</strong>
                    <button className="btn btn-sm btn-link" onClick={() => { fetchRecentMessages(); }}>Refresh</button>
                  </div>
                  {recentMessages.length === 0 && <div className="text-center text-muted small">No messages</div>}
                  {recentMessages.map((m, i) => {
                    const peer = m.fromUsername === loggedInUsername ? m.toUsername : m.fromUsername;
                    return (
                      <div key={`${peer}-${i}`} className="border-bottom py-2" style={{ cursor: "pointer" }} onClick={() => { setShowInboxList(false); openChatWith(peer); }}>
                        <div className="d-flex justify-content-between">
                          <div style={{ fontWeight: m.read ? 400 : 700 }}>{peer}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#333' }}>{m.text?.slice(0, 80)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!loggedInUsername && (
            <div className="ms-2 d-flex align-items-center">
              <input ref={quickNameRef} placeholder="Set name to chat" className="form-control form-control-sm me-2" style={{ width: 180 }} />
              <button className="btn btn-sm btn-success" onClick={setQuickName}>Set</button>
            </div>
          )}
        </div>
      </div>

      {/* New Post UI */}
      {!isProfile && (
        <div className="card shadow-sm mb-4 border-0 rounded-3">
          <div className="card-body p-4">
            <textarea className="form-control mb-3 shadow-sm" placeholder="What's on your mind?" value={newPostText} onChange={(e) => setNewPostText(e.target.value)} />
            {previewImage && <div className="mb-3 text-center"><img src={previewImage} alt="preview" className="img-fluid rounded" style={{ maxHeight: 220 }} /></div>}
            <input type="file" className="form-control mb-3" accept="image/*" onChange={(e) => { const file = e.target.files[0]; if (!validateImage(file)) return; setNewPostImage(file); if (file) setPreviewImage(URL.createObjectURL(file)); }} />
            <button className="btn btn-primary w-100 shadow" onClick={handleCreatePost} disabled={loading}>{loading ? <span className="spinner-border spinner-border-sm me-2" role="status" /> : "🚀 Post"}</button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {posts.map((post) => (
        <div key={post._id} id={`post-${post._id}`} className="card shadow-sm mb-4 border-0 rounded-3">
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-3">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={post.user?.avatar || "/default-avatar.png"} alt="avatar" width={45} height={45} className="rounded-circle me-2 border" style={{ objectFit: "cover", cursor: "pointer" }} onClick={() => openChatWith(post.user.username)} />
                <span style={{ position: 'absolute', right: -2, bottom: -2 }}><OnlineDot username={post.user.username} /></span>
              </div>
              <strong style={{ cursor: "pointer" }} onClick={() => openChatWith(post.user.username)}>{post.user.username}</strong>

              {post.user.username !== loggedInUsername && (
                <button className="btn btn-sm btn-outline-primary ms-auto" title="Message" onClick={() => openChatWith(post.user.username)}>💬</button>
              )}
            </div>

            {post.text && <p className="mb-2">{post.text}</p>}
            {post.image && <div className="mb-3 text-center"><img src={post.image} alt="post" className="img-fluid rounded" style={{ maxHeight: 220, objectFit: "cover" }} /></div>}

            <div className="d-flex mb-2">
              <button className={`btn btn-sm me-2 ${((post.likes || []).includes(loggedInUsername) || (post.likes || []).includes(loggedInUserId)) ? "btn-success" : "btn-outline-success"}`} onClick={() => handleLike(post._id)}>👍 Like ({post.likes?.length || 0})</button>

              {(post.user?.username === loggedInUsername || post.user?._id === loggedInUserId) && (
                <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(post._id)}>🗑 Delete</button>
              )}
            </div>

            <div className="mt-3">
              <h6 className="fw-bold">💬 Comments</h6>
              {(post.comments || []).map((c) => (
                <div key={c._id} className="border-top pt-2 mb-2">
                  <strong>{c.user.username}:</strong> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.text) }} />
                </div>
              ))}
              <AddComment postId={post._id} onAdd={(text) => handleComment(post._id, text)} />
            </div>
          </div>
        </div>
      ))}

      {/* Load more */}
      <div className="text-center mb-4">
        {hasMore ? (
          <button className="btn btn-outline-primary" onClick={() => setPage((p) => p + 1)} disabled={fetching}>{fetching ? "Loading..." : "Load More ⬇️"}</button>
        ) : <div className="text-muted">No more posts</div>}
      </div>

      {/* Chat Floating Button */}
      {!chatVisible && (
        <button aria-label="Open chat" onClick={() => setChatVisible(true)} style={{
          position: "fixed", bottom: 18, left: 18, zIndex: 1060, width: 56, height: 56, borderRadius: "50%",
          border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.15)", background: "#0d6efd", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer"
        }}>
          💬
          {unreadCount > 0 && (<span style={{ position: "absolute", top: 4, left: 40, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{unreadCount}</span>)}
        </button>
      )}

      {/* Chat Panel */}
      {chatVisible && (
        <div className="position-fixed" style={{ bottom: 18, left: 18, zIndex: 1060, ...(window.innerWidth < 576 ? { width: "calc(100vw - 24px)", maxWidth: "100%", left: "12px", right: "12px", bottom: "12px" } : { width: "360px", maxWidth: "90vw" }) }}>
          <div className="card shadow-sm rounded-3">
            <div className="card-header d-flex align-items-center justify-content-between p-2">
              <strong className="mb-0">💬 Chat {chatTo ? `with ${chatTo}` : ""}</strong>
              <div>
                <button className="btn btn-sm btn-outline-secondary me-2" title="Close chat" onClick={() => setChatVisible(false)}>✕</button>
              </div>
            </div>

            <div className="card-body p-2">
              <div className="mb-2">
                <input type="text" className="form-control mb-2" placeholder="Username to chat" value={chatTo || ""} onChange={(e) => setChatTo(e.target.value)} />
                <div className="input-group mb-2">
                  <input ref={chatInputRef} type="text" className="form-control" placeholder={loggedInUsername ? "Type a message..." : "Set your name to send messages"} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} />
                  <button className="btn btn-primary" onClick={sendMessage} disabled={!loggedInUsername}>Send</button>
                </div>

                <div ref={chatListRef} className="chat-messages border rounded p-2" style={{ maxHeight: 320, overflowY: "auto", background: "#f8f9fa" }}>
                  {chatMessages
                    .filter(m => !chatTo || m.fromUsername === chatTo || m.toUsername === chatTo || m.fromUsername === loggedInUsername || m.toUsername === loggedInUsername)
                    .map((m) => (
                      <div key={m._id || m.createdAt} className={`mb-2 p-2 rounded ${m.fromUsername === loggedInUsername ? "bg-primary text-white ms-auto" : "bg-white text-dark"}`} style={{ maxWidth: "85%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{m.fromUsername} <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                        <div>{m.text}</div>
                      </div>
                    ))}
                </div>

                {/* Recent conversations */}
                <div className="mt-2">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <strong style={{ fontSize: 14 }}>Recent</strong>
                    <button className="btn btn-sm btn-link" onClick={() => fetchRecentMessages()}>Refresh</button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }}>
                    {recentMessages.map((m, i) => {
                      const peer = m.fromUsername === loggedInUsername ? m.toUsername : m.fromUsername;
                      return (
                        <div key={`${peer}-${i}`} className="d-flex align-items-center justify-content-between py-1" style={{ cursor: "pointer" }} onClick={() => { openChatWith(peer); }}>
                          <div>
                            <div style={{ fontWeight: m.read ? 400 : 700 }}>{peer} {onlineUsers.includes(peer) && <span style={{ color: '#28a745', marginLeft: 6 }}>●</span>}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{m.text?.slice(0, 60)}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#888' }}>{new Date(m.createdAt).toLocaleDateString()}</div>
                        </div>
                      );
                    })}
                    {recentMessages.length === 0 && <div className="text-muted small">No recent messages</div>}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AddComment component (unchanged)
function AddComment({ postId, onAdd }) {
  const [text, setText] = useState("");
  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(postId, text);
    setText("");
  };
  return (
    <div className="d-flex mt-2">
      <input type="text" className="form-control me-2" placeholder="Write a comment..." value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-sm btn-primary" onClick={handleSubmit}>Send</button>
    </div>
  );
}

// NotificationsDropdown helper (open controlled by parent)
function NotificationsDropdown({ notifications, onClickNotif, open, setOpen }) {
  return (
    <div className="position-relative">
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => { setOpen(!open); }}
        style={{ position: "relative" }}
      >
        🔔
        {notifications.length > 0 && <span style={{
          position: "absolute", top: -6, right: -6, background: "red", color: "white",
          borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11
        }}>{notifications.length}</span>}
      </button>

      {open && (
        <div className="card shadow-sm position-absolute end-0 mt-2" style={{ width: 300, zIndex: 2000 }}>
          <div className="card-body p-2">
            {notifications.length === 0 && <div className="text-center text-muted small">No notifications</div>}
            {notifications.map((n, i) => (
              <div key={i} className="alert alert-info p-2 mb-1 rounded" style={{ cursor: "pointer" }} onClick={() => { onClickNotif(n); setOpen(false); }}>
                <strong>{n.type}</strong> — {n.fromUsername || (n.fromUser && n.fromUser.username) || "Someone"}
                <div style={{ fontSize: 12, opacity: 0.8 }}>{n.message || (n.postId ? `post ${n.postId}` : "")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
