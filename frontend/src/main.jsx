import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpenCheck,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  DatabaseZap,
  FileText,
  FolderLock,
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
  UploadCloud,
  UserRound,
  UsersRound,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "deepsearch_token";

function getErrorMessage(error) {
  return error?.message || "Beklenmeyen bir hata olustu";
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
    throw new Error(payload.message || `Istek basarisiz oldu (${response.status})`);
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
    throw new Error(payload.message || `Yukleme basarisiz oldu (${response.status})`);
  }

  return payload;
}

function formatDate(value) {
  if (!value) return "Yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function fileTypeLabel(type) {
  return (type || "doc").replace(".", "").toUpperCase();
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
    return <FullScreenLoader label="Oturum kontrol ediliyor" />;
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
            <p>Takim yetkilerine gore dokumanlarda guvenli arama.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            E-posta
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
            Sifre
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sifreniz"
              type="password"
              value={password}
            />
          </label>

          {error ? <InlineAlert message={error} /> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
            Giris yap
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

  const stats = useMemo(() => {
    const types = new Set(documents.map((document) => document.file_type || document.fileType));
    return {
      documentCount: documents.length,
      typeCount: types.size,
      indexedCount: documents.filter((document) => document.last_indexed_at).length,
    };
  }, [documents]);

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
            label="Sorgu"
            onClick={() => setActiveView("search")}
          />
          <NavButton
            active={activeView === "documents"}
            icon={<FileText size={18} />}
            label="Dokumanlar"
            onClick={() => setActiveView("documents")}
          />
          {user.role === "admin" ? (
            <NavButton
              active={activeView === "admin"}
              icon={<Shield size={18} />}
              label="Yonetim"
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
          Cikis
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Merhaba, {user.fullName}</p>
            <h1>{activeView === "admin" ? "Yonetim paneli" : "Dokuman zekasi"}</h1>
          </div>
          <button className="ghost-button" onClick={() => setRefreshKey((key) => key + 1)} type="button">
            <RefreshCw size={18} />
            Yenile
          </button>
        </header>

        <section className="stat-grid">
          <Metric icon={<BookOpenCheck />} value={stats.documentCount} label="erisilebilir dokuman" />
          <Metric icon={<FolderLock />} value={stats.typeCount} label="dosya turu" />
          <Metric icon={<DatabaseZap />} value={stats.indexedCount} label="indeks kaydi" />
        </section>

        {activeView === "search" ? (
  <SearchView
    token={token}
    documents={documents}
    loading={documentsLoading}
    error={documentsError}
  />
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
    if (!file || loading || !canUpload) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await uploadDocumentRequest({ token, file });
      setFile(null);
      event.currentTarget.reset();
      setNotice(`${result.document.file_name} yuklendi.`);
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
        <div className="metric-icon">
          <UploadCloud size={20} />
        </div>
        <div>
          <h2>Dokuman ekle</h2>
          <p>
            {user.role === "admin"
              ? "Admin yuklemeleri tum aktif takimlara acilir."
              : `${user.team?.name || "Takimsiz"} icin kaynak ekleyin.`}
          </p>
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
          <span>{file ? file.name : "TXT, PDF veya DOCX sec"}</span>
        </label>
        <button className="primary-button compact-button" disabled={!file || !canUpload || loading} type="submit">
          {loading ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
          Yukle
        </button>
      </form>

      {!canUpload ? <InlineAlert message="Dokuman yuklemek icin bir takima atanmis olmalisiniz." /> : null}
      {error ? <InlineAlert message={error} /> : null}
      {notice ? <InlineSuccess message={notice} /> : null}
    </section>
  );
}

function SearchView({ token, documents, loading, error }) {
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
          <div>
            <h2>Akilli sorgu</h2>
            <p>Yanıtlar sadece erisiminiz olan dokumanlardan uretilir.</p>
          </div>
          <Sparkles size={22} />
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={34} />
              <strong>Bir soru sorun</strong>
              <span>Ornek: Bakim raporlarinda en kritik riskler neler?</span>
            </div>
          ) : (
            messages.map((message, index) => <ChatMessage key={`${message.type}-${index}`} message={message} />)
          )}
          {asking ? (
            <div className="message answer">
              <Loader2 className="spin" size={18} />
              <span>Kaynaklar taraniyor...</span>
            </div>
          ) : null}
        </div>

        <form className="ask-form" onSubmit={ask}>
          <textarea
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Dokumanlariniz hakkinda sorun..."
            rows={2}
            value={question}
          />
          <button className="icon-button primary" disabled={asking || !question.trim()} title="Gonder" type="submit">
            <Send size={20} />
          </button>
        </form>
      </div>

      <DocumentRail documents={documents} loading={loading} error={error} />
    </section>
  );
}

function ChatMessage({ message }) {
  if (message.type === "question") {
    return (
      <div className="message question">
        <strong>Soru</strong>
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
        <strong>Yanit</strong>
        <span>{message.usedSourceCount || 0} kaynak kullanildi</span>
      </div>
      <p>{message.answer || "Yanit bulunamadi."}</p>
      {message.sources?.length ? (
        <div className="source-list">
          {message.sources.map((source, index) => (
            <span key={`${source}-${index}`}>{source}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocumentRail({ documents, loading, error }) {
  return (
    <aside className="document-rail">
      <div className="panel-heading compact">
        <h2>Kaynaklar</h2>
        <span>{documents.length}</span>
      </div>
      {loading ? <ListLoader /> : null}
      {error ? <InlineAlert message={error} /> : null}
      {!loading && !error ? (
        <div className="compact-list">
          {documents.slice(0, 8).map((document) => (
            <DocumentItem document={document} key={document.id} compact />
          ))}
          {documents.length === 0 ? <p className="muted">Erisilebilir dokuman yok.</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

function DocumentsView({ token, user, documents, loading, error, onUploaded }) {
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
            <h2>Dokuman katalogu</h2>
            <p>Rolunuz ve takiminiza gore izin verilen kaynaklar.</p>
          </div>
        </div>

        {loading ? <ListLoader /> : null}
        {error ? <InlineAlert message={error} /> : null}

        {!loading && !error ? (
          <div className="document-table">
            {documents.map((document) => (
              <DocumentItem document={document} key={document.id} />
            ))}
            {documents.length === 0 ? <EmptyLine text="Dokuman bulunamadi." /> : null}
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
      setNotice("Takim olusturuldu.");
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
      setNotice("Kullanici olusturuldu.");
    });
  }

  async function syncDocuments() {
    await runAdminAction(async () => {
      const result = await apiRequest("/admin/documents/sync", { token, method: "POST" });
      setNotice(`${result.scannedCount || 0} dosya tarandi.`);
    });
  }

  async function updateTeamDocuments(teamId, documentIds) {
    await runAdminAction(async () => {
      await apiRequest(`/admin/teams/${teamId}/documents`, {
        token,
        method: "PUT",
        body: { documentIds },
      });
      setNotice("Takim dokuman izinleri guncellendi.");
    });
  }

  async function updateUserTeam(userId, teamId) {
    await runAdminAction(async () => {
      await apiRequest(`/admin/users/${userId}/team`, {
        token,
        method: "PUT",
        body: { teamId: teamId ? Number(teamId) : null },
      });
      setNotice("Kullanici takimi guncellendi.");
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
            <h2>Takimlar</h2>
            <p>Dokuman izinlerini ekip seviyesinde yonetin.</p>
          </div>
          <button className="ghost-button" onClick={syncDocuments} type="button">
            <RefreshCw size={18} />
            Sync
          </button>
        </div>
        {error ? <InlineAlert message={error} /> : null}
        {notice ? <InlineSuccess message={notice} /> : null}
        <form className="inline-form" onSubmit={createTeam}>
          <input onChange={(event) => setTeamName(event.target.value)} placeholder="Yeni takim adi" value={teamName} />
          <button className="primary-button compact-button" type="submit">
            <Plus size={17} />
            Ekle
          </button>
        </form>
        {loading ? <ListLoader /> : <TeamAccessList documents={documents} teams={teams} onSave={updateTeamDocuments} />}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Kullanicilar</h2>
            <p>Hesap olusturun ve takim atamasi yapin.</p>
          </div>
          <UsersRound size={22} />
        </div>
        <form className="user-form" onSubmit={createUser}>
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, fullName: event.target.value }))}
            placeholder="Ad soyad"
            value={newUser.fullName}
          />
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, email: event.target.value }))}
            placeholder="E-posta"
            type="email"
            value={newUser.email}
          />
          <input
            onChange={(event) => setNewUser((state) => ({ ...state, password: event.target.value }))}
            placeholder="Sifre"
            type="password"
            value={newUser.password}
          />
          <select onChange={(event) => setNewUser((state) => ({ ...state, role: event.target.value }))} value={newUser.role}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select onChange={(event) => setNewUser((state) => ({ ...state, teamId: event.target.value }))} value={newUser.teamId}>
            <option value="">Takim sec</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button className="primary-button" type="submit">
            <Plus size={17} />
            Kullanici ekle
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
              <span>{team.userCount} kullanici</span>
            </div>
            <button className="icon-button" onClick={() => onSave(team.id, drafts[team.id] || [])} title="Kaydet" type="button">
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
      {teams.length === 0 ? <EmptyLine text="Takim yok." /> : null}
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
              <option value="">Takimsiz</option>
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
      {users.length === 0 ? <EmptyLine text="Kullanici yok." /> : null}
    </div>
  );
}

function DocumentItem({ document, compact = false }) {
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
      {!compact ? <span className="muted">{formatDate(document.last_indexed_at)}</span> : null}
    </article>
  );
}

function Metric({ icon, value, label }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
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
      <span>Yukleniyor...</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
