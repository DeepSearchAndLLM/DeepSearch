import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  UsersRound,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "deepsearch_token";

function getErrorMessage(error) {
  return error?.message || "An unexpected error occurred";
}

async function apiRequest(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

async function uploadDocumentRequest({ token, file }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || `Upload failed (${response.status})`);
  }

  return payload;
}

function fileTypeLabel(type) {
  return (type || "doc").replace(".", "").toUpperCase();
}

function sourceLabel(source) {
  if (!source) return "Unknown source";
  if (typeof source === "string") return source;

  const fileName = source.file_name || source.fileName || source.file_path || "Unknown source";
  if (source.line_start && source.line_end) {
    return `${fileName} line ${source.line_start}-${source.line_end}`;
  }
  if (source.page_number) {
    return `${fileName} page ${source.page_number}`;
  }
  if (source.paragraph_index !== undefined) {
    return `${fileName} paragraph ${source.paragraph_index}`;
  }

  return fileName;
}

function sourceKey(source, index) {
  if (!source || typeof source === "string") return `${source || "source"}-${index}`;
  return `${source.file_name || source.fileName || source.file_path || "source"}-${source.chunk_index ?? index}`;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;

    apiRequest("/auth/me", { token })
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setBooting(false));
  }, [token]);

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  if (booting) {
    return <FullScreenLoader label="Checking session" />;
  }

  if (!token || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <Workspace token={token} user={user} onLogout={handleLogout} />;
}

function FullScreenLoader({ label }) {
  return (
    <main className="center-screen">
      <Loader2 className="spin" size={28} />
      <span>{label}</span>
    </main>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      onLogin(result.token, result.user);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Search size={26} />
          </div>
          <div>
            <h1>DeepSearch</h1>
            <p>Secure document search based on team permissions.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              type="password"
              value={password}
            />
          </label>

          {error ? <InlineAlert message={error} /> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}

function Workspace({ token, user, onLogout }) {
  const [activeView, setActiveView] = useState("search");
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setDocumentsLoading(true);
    setDocumentsError("");
    apiRequest("/documents", { token })
      .then(({ documents }) => setDocuments(documents || []))
      .catch((err) => setDocumentsError(getErrorMessage(err)))
      .finally(() => setDocumentsLoading(false));
  }, [token, refreshKey]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <Search size={21} />
          </div>
          <strong>DeepSearch</strong>
        </div>

        <nav className="nav-list">
          <NavButton
            active={activeView === "search"}
            icon={<MessageSquareText size={18} />}
            label="Query"
            onClick={() => setActiveView("search")}
          />
          <NavButton
            active={activeView === "documents"}
            icon={<FileText size={18} />}
            label="Documents"
            onClick={() => setActiveView("documents")}
          />
          {user.role === "admin" ? (
            <NavButton
              active={activeView === "admin"}
              icon={<Shield size={18} />}
              label="Admin"
              onClick={() => setActiveView("admin")}
            />
          ) : null}
        </nav>

        <div className="user-card">
          <div className="avatar">
            <UserRound size={19} />
          </div>
          <div>
            <strong>{user.fullName}</strong>
            <span>{user.team?.name || user.role}</span>
          </div>
        </div>

        <button className="ghost-button full" onClick={onLogout} type="button">
          <LogOut size={18} />
          Log out
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Hello, {user.fullName}</p>
            <h1>{activeView === "admin" ? "Admin panel" : "Document intelligence"}</h1>
          </div>
          <button className="ghost-button" onClick={() => setRefreshKey((key) => key + 1)} type="button">
            <RefreshCw size={18} />
            Refresh
          </button>
        </header>

        {activeView === "search" ? (
          <SearchView token={token} />
        ) : null}
        {activeView === "documents" ? (
          <DocumentsView
            token={token}
            user={user}
            documents={documents}
            loading={documentsLoading}
            error={documentsError}
            onUploaded={() => setRefreshKey((key) => key + 1)}
          />
        ) : null}
        {activeView === "admin" && user.role === "admin" ? <AdminView token={token} /> : null}
      </main>
    </div>
  );
}

function DocumentUpload({ token, user, onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canUpload = user.role === "admin" || Boolean(user.team);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file || loading || !canUpload) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await uploadDocumentRequest({ token, file });
      const uploadedName = result.document?.file_name || result.document?.fileName || file.name;
      setFile(null);
      form.reset();
      setNotice(`${uploadedName} uploaded.`);
      onUploaded();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="upload-panel">
      <div className="upload-copy">
        <div>
          <h2>Add document</h2>
        </div>
      </div>

      <form className="upload-form" onSubmit={submit}>
        <label className="file-picker">
          <input
            accept=".txt,.pdf,.docx"
            disabled={!canUpload || loading}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            type="file"
          />
          <span>{file ? file.name : "Choose TXT, PDF, or DOCX"}</span>
        </label>
        <button className="primary-button compact-button" disabled={!file || !canUpload || loading} type="submit">
          {loading ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
          Upload
        </button>
      </form>

      {!canUpload ? <InlineAlert message="You must be assigned to a team to upload documents." /> : null}
      {error ? <InlineAlert message={error} /> : null}
      {notice ? <InlineSuccess message={notice} /> : null}
    </section>
  );
}

function SearchView({ token }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);

  async function ask(event) {
    event.preventDefault();
    if (!question.trim() || asking) return;

    const nextQuestion = question.trim();
    setQuestion("");
    setAsking(true);
    setMessages((items) => [...items, { type: "question", text: nextQuestion }]);

    try {
      const result = await apiRequest("/chat/ask", {
        token,
        method: "POST",
        body: { question: nextQuestion },
      });
      setMessages((items) => [...items, { type: "answer", ...result }]);
    } catch (err) {
      setMessages((items) => [...items, { type: "error", text: getErrorMessage(err) }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="content-grid">
      <div className="chat-panel">
        <div className="panel-heading">
          <h2>Question Panel</h2>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={34} />
              <strong>Ask a question</strong>
            </div>
          ) : (
            messages.map((message, index) => <ChatMessage key={`${message.type}-${index}`} message={message} />)
          )}
          {asking ? (
            <div className="message answer">
              <Loader2 className="spin" size={18} />
              <span>Scanning sources...</span>
            </div>
          ) : null}
        </div>

        <form className="ask-form" onSubmit={ask}>
          <textarea
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your documents..."
            rows={2}
            value={question}
          />
          <button className="icon-button primary" disabled={asking || !question.trim()} title="Send" type="submit">
            <Send size={20} />
          </button>
        </form>
      </div>

    </section>
  );
}

function ChatMessage({ message }) {
  if (message.type === "question") {
    return (
      <div className="message question">
        <strong>Question</strong>
        <p>{message.text}</p>
      </div>
    );
  }

  if (message.type === "error") {
    return (
      <div className="message error">
        <CircleAlert size={18} />
        <p>{message.text}</p>
      </div>
    );
  }

  return (
    <div className="message answer">
      <div className="answer-head">
        <strong>Answer</strong>
        <span>{message.usedSourceCount || 0} sources used</span>
      </div>
      <p>{message.answer || "No answer found."}</p>
      {message.sources?.length ? (
        <div className="source-list">
          {message.sources.map((source, index) => (
            <span key={sourceKey(source, index)} title={source?.excerpt || sourceLabel(source)}>
              {sourceLabel(source)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocumentsView({ token, user, documents, loading, error, onUploaded }) {
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function deleteDocument(document) {
    const fileName = document.file_name || document.fileName || "this document";
    if (!window.confirm(`Delete ${fileName}?`)) return;

    setDeleteError("");
    setDeletingId(document.id);

    try {
      await apiRequest(`/documents/${document.id}`, {
        token,
        method: "DELETE",
      });
      onUploaded();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <DocumentUpload
        token={token}
        user={user}
        onUploaded={onUploaded}
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Document catalog</h2>
          </div>
        </div>

        {loading ? <ListLoader /> : null}
        {error ? <InlineAlert message={error} /> : null}
        {deleteError ? <InlineAlert message={deleteError} /> : null}

        {!loading && !error ? (
          <div className="document-table">
            {documents.map((document) => (
              <DocumentItem
                document={document}
                key={document.id}
                onDelete={user.role === "admin" ? deleteDocument : null}
                deleting={deletingId === document.id}
              />
            ))}
            {documents.length === 0 ? <EmptyLine text="No documents found." /> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function AdminView({ token }) {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [teamName, setTeamName] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "user",
    teamId: "",
  });

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const [teamResult, userResult, documentResult] = await Promise.all([
        apiRequest("/admin/teams", { token }),
        apiRequest("/admin/users", { token }),
        apiRequest("/admin/documents", { token }),
      ]);
      setTeams(teamResult.teams || []);
      setUsers(userResult.users || []);
      setDocuments(documentResult.documents || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function createTeam(event) {
    event.preventDefault();
    if (!teamName.trim()) return;
    await runAdminAction(async () => {
      await apiRequest("/admin/teams", {
        token,
        method: "POST",
        body: { name: teamName },
      });
      setTeamName("");
      setNotice("Team created.");
    });
  }

  async function createUser(event) {
    event.preventDefault();
    await runAdminAction(async () => {
      await apiRequest("/admin/users", {
        token,
        method: "POST",
        body: {
          ...newUser,
          teamId: newUser.teamId ? Number(newUser.teamId) : null,
        },
      });
      setNewUser({ email: "", fullName: "", password: "", role: "user", teamId: "" });
      setNotice("User created.");
    });
  }

  async function syncDocuments() {
    await runAdminAction(async () => {
      const result = await apiRequest("/admin/documents/sync", { token, method: "POST" });
      setNotice(`${result.scannedCount || 0} files scanned.`);
    });
  }

  async function updateTeamDocuments(teamId, documentIds) {
    await runAdminAction(async () => {
      await apiRequest(`/admin/teams/${teamId}/documents`, {
        token,
        method: "PUT",
        body: { documentIds },
      });
      setNotice("Team document permissions updated.");
    });
  }

  async function updateUserTeam(userId, teamId) {
    await runAdminAction(async () => {
      await apiRequest(`/admin/users/${userId}/team`, {
        token,
        method: "PUT",
        body: { teamId: teamId ? Number(teamId) : null },
      });
      setNotice("User team updated.");
    });
  }

  async function runAdminAction(action) {
    setError("");
    setNotice("");
    try {
      await action();
      await loadAdminData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="admin-layout">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Teams</h2>
          </div>
          <button className="ghost-button" onClick={syncDocuments} type="button">
            <RefreshCw size={18} />
            Sync
          </button>
        </div>
        {error ? <InlineAlert message={error} /> : null}
        {notice ? <InlineSuccess message={notice} /> : null}
        <form className="inline-form" onSubmit={createTeam}>
          <input onChange={(event) => setTeamName(event.target.value)} placeholder="New team name" value={teamName} />
          <button className="primary-button compact-button" type="submit">
            <Plus size={17} />
            Add
          </button>
        </form>
        {loading ? <ListLoader /> : <TeamAccessList documents={documents} teams={teams} onSave={updateTeamDocuments} />}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Users</h2>
            <p>Create accounts and assign teams.</p>
          </div>
          <UsersRound size={22} />
        </div>
        <form className="user-form" onSubmit={createUser}>
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, fullName: event.target.value }))}
            placeholder="Full name"
            value={newUser.fullName}
          />
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, email: event.target.value }))}
            placeholder="Email"
            type="email"
            value={newUser.email}
          />
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, password: event.target.value }))}
            placeholder="Password"
            type="password"
            value={newUser.password}
          />
          <select onChange={(event) => setNewUser((state) => ({ ...state, role: event.target.value }))} value={newUser.role}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select onChange={(event) => setNewUser((state) => ({ ...state, teamId: event.target.value }))} value={newUser.teamId}>
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button className="primary-button" type="submit">
            <Plus size={17} />
            Add user
          </button>
        </form>
        {loading ? <ListLoader /> : <UserList teams={teams} users={users} onTeamChange={updateUserTeam} />}
      </div>
    </section>
  );
}

function TeamAccessList({ teams, documents, onSave }) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts(
      Object.fromEntries(teams.map((team) => [team.id, team.documents.map((document) => document.id)]))
    );
  }, [teams]);

  function toggle(teamId, documentId) {
    setDrafts((state) => {
      const current = new Set(state[teamId] || []);
      if (current.has(documentId)) {
        current.delete(documentId);
      } else {
        current.add(documentId);
      }
      return { ...state, [teamId]: Array.from(current) };
    });
  }

  return (
    <div className="team-list">
      {teams.map((team) => (
        <article className="team-card" key={team.id}>
          <div className="team-card-head">
            <div>
              <strong>{team.name}</strong>
              <span>{team.userCount} users</span>
            </div>
            <button className="icon-button" onClick={() => onSave(team.id, drafts[team.id] || [])} title="Save" type="button">
              <Check size={19} />
            </button>
          </div>
          <div className="checkbox-list">
            {documents.map((document) => (
              <label key={document.id}>
                <input
                  checked={(drafts[team.id] || []).includes(document.id)}
                  onChange={() => toggle(team.id, document.id)}
                  type="checkbox"
                />
                <span>{document.file_name}</span>
              </label>
            ))}
          </div>
        </article>
      ))}
      {teams.length === 0 ? <EmptyLine text="No teams." /> : null}
    </div>
  );
}

function UserList({ users, teams, onTeamChange }) {
  return (
    <div className="user-list">
      {users.map((user) => (
        <article className="user-row" key={user.id}>
          <div className="avatar">
            <UserRound size={18} />
          </div>
          <div className="user-info">
            <strong>{user.fullName}</strong>
            <span>{user.email}</span>
          </div>
          <span className="role-pill">{user.role}</span>
          <div className="select-wrap">
            <select onChange={(event) => onTeamChange(user.id, event.target.value)} value={user.team?.id || ""}>
              <option value="">Unassigned</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </article>
      ))}
      {users.length === 0 ? <EmptyLine text="No users." /> : null}
    </div>
  );
}

function DocumentItem({ document, compact = false, deleting = false, onDelete = null }) {
  const fileName = document.file_name || document.fileName;
  const fileType = document.file_type || document.fileType;

  return (
    <article className={compact ? "document-item compact" : "document-item"}>
      <div className="file-icon">
        <FileText size={18} />
      </div>
      <div>
        <strong>{fileName}</strong>
        {!compact ? <span>{document.file_path}</span> : null}
      </div>
      <span className="type-pill">{fileTypeLabel(fileType)}</span>
      {!compact && onDelete ? (
        <button
          className="icon-button danger"
          disabled={deleting}
          onClick={() => onDelete(document)}
          title="Delete document"
          type="button"
        >
          {deleting ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
        </button>
      ) : null}
    </article>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick} type="button">
      {icon}
      {label}
    </button>
  );
}

function InlineAlert({ message }) {
  return (
    <div className="inline-alert">
      <CircleAlert size={18} />
      <span>{message}</span>
    </div>
  );
}

function InlineSuccess({ message }) {
  return (
    <div className="inline-success">
      <Check size={18} />
      <span>{message}</span>
    </div>
  );
}

function EmptyLine({ text }) {
  return <p className="empty-line">{text}</p>;
}

function ListLoader() {
  return (
    <div className="list-loader">
      <Loader2 className="spin" size={20} />
      <span>Loading...</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
