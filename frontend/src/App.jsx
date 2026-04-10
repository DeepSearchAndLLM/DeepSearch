import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  askQuestion,
  createTeam,
  createUser,
  getAdminDocuments,
  getCurrentUser,
  getDocuments,
  getTeams,
  getUsers,
  login as loginRequest,
  syncDocuments,
  updateTeam,
  updateTeamDocuments,
  updateUserTeam,
} from './lib/api'

const TOKEN_STORAGE_KEY = 'deepsearch-token'
const THEME_STORAGE_KEY = 'deepsearch-theme'

const loginDefaults = {
  email: '',
  password: '',
}

const createUserDefaults = {
  email: '',
  fullName: '',
  password: '',
  role: 'user',
  teamId: '',
}

const createTeamDefaults = {
  name: '',
}

const renameTeamDefaults = {
  teamId: '',
  name: '',
}

const assignUserTeamDefaults = {
  userId: '',
  teamId: '',
}

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setStoredToken(token) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function getStoredTheme() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light'
}

function setStoredTheme(theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

function getGreetingMessage(user) {
  if (!user) {
    return 'Merhaba! Size nasil yardimci olabilirim?'
  }

  if (user.role === 'admin') {
    return 'Merhaba admin. Dokumanlari sorabilir veya yonetim panelini kullanabilirsiniz.'
  }

  return 'Merhaba! Takiminiza acik dokumanlar icin soru sorabilirsiniz.'
}

function getLocationLabel(source) {
  if (source.page_number) {
    return `Sayfa ${source.page_number}`
  }

  if (source.line_start && source.line_end) {
    return `Satir ${source.line_start}-${source.line_end}`
  }

  if (source.paragraph_index !== undefined && source.paragraph_index !== null) {
    return `Paragraf ${source.paragraph_index}`
  }

  return 'Konum bilgisi yok'
}

function getTabTitle(activeTab) {
  switch (activeTab) {
    case 'dashboard':
      return 'Dashboard'
    case 'chat':
      return 'Chat'
    case 'documents':
      return 'Documents'
    case 'sources':
      return 'Sources'
    case 'admin':
      return 'Admin'
    default:
      return 'DeepSearch'
  }
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function App() {
  const [token, setToken] = useState(() => getStoredToken())
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()))
  const [loginForm, setLoginForm] = useState(loginDefaults)
  const [loginPending, setLoginPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [user, setUser] = useState(null)
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('chat')
  const [question, setQuestion] = useState('')
  const [questionPending, setQuestionPending] = useState(false)
  const [lastAnswer, setLastAnswer] = useState(null)
  const [messages, setMessages] = useState([])

  const [adminLoading, setAdminLoading] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminTeams, setAdminTeams] = useState([])
  const [adminDocuments, setAdminDocuments] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeamDocumentIds, setSelectedTeamDocumentIds] = useState([])

  const [createUserForm, setCreateUserForm] = useState(createUserDefaults)
  const [createTeamForm, setCreateTeamForm] = useState(createTeamDefaults)
  const [renameTeamForm, setRenameTeamForm] = useState(renameTeamDefaults)
  const [assignUserTeamForm, setAssignUserTeamForm] = useState(assignUserTeamDefaults)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminActionPending, setAdminActionPending] = useState(false)

  const visibleTabs = useMemo(() => {
    const baseTabs = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'chat', label: 'Chat' },
      { key: 'documents', label: 'Documents' },
      { key: 'sources', label: 'Sources' },
    ]

    if (user?.role === 'admin') {
      baseTabs.push({ key: 'admin', label: 'Admin' })
    }

    return baseTabs
  }, [user?.role])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!token) {
        setAuthLoading(false)
        setUser(null)
        setDocuments([])
        setMessages([])
        return
      }

      setAuthLoading(true)

      try {
        const [me, docs] = await Promise.all([
          getCurrentUser(token),
          getDocuments(token),
        ])

        if (cancelled) {
          return
        }

        setUser(me)
        setDocuments(docs)
        setMessages([{ role: 'assistant', content: getGreetingMessage(me) }])
        setErrorMessage('')
      } catch (error) {
        if (cancelled) {
          return
        }

        clearStoredToken()
        setToken(null)
        setUser(null)
        setDocuments([])
        setMessages([])
        setErrorMessage(error.message)
      } finally {
        if (!cancelled) {
          setAuthLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!user || user.role !== 'admin' || !token) {
      return
    }

    loadAdminData(token)
  }, [user, token])

  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeamDocumentIds([])
      return
    }

    const team = adminTeams.find((item) => String(item.id) === String(selectedTeamId))
    setSelectedTeamDocumentIds((team?.documents || []).map((document) => document.id))
  }, [selectedTeamId, adminTeams])

  const documentCountLabel = documents.length === 1 ? 'dokuman' : 'dokuman'
  const sourceCount = lastAnswer?.sources?.length || 0

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    setStoredTheme(theme)
  }, [theme])

  async function loadDocuments(activeToken) {
    setDocumentsLoading(true)

    try {
      const docs = await getDocuments(activeToken)
      setDocuments(docs)
    } finally {
      setDocumentsLoading(false)
    }
  }

  async function loadAdminData(activeToken) {
    setAdminLoading(true)

    try {
      const [users, teams, docs] = await Promise.all([
        getUsers(activeToken),
        getTeams(activeToken),
        getAdminDocuments(activeToken),
      ])

      setAdminUsers(users)
      setAdminTeams(teams)
      setAdminDocuments(docs)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setLoginPending(true)
    setErrorMessage('')

    try {
      const result = await loginRequest(loginForm)
      setStoredToken(result.token)
      setToken(result.token)
      setUser(result.user)
      setMessages([{ role: 'assistant', content: getGreetingMessage(result.user) }])
      setLoginForm(loginDefaults)
      setActiveTab('chat')
      setLastAnswer(null)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoginPending(false)
    }
  }

  function handleLogout() {
    clearStoredToken()
    setToken(null)
    setUser(null)
    setDocuments([])
    setMessages([])
    setLastAnswer(null)
    setQuestion('')
    setErrorMessage('')
    setAdminMessage('')
    setActiveTab('chat')
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  async function handleAskQuestion(event) {
    event.preventDefault()
    if (!question.trim() || !token) {
      return
    }

    const askedQuestion = question.trim()
    setQuestion('')
    setQuestionPending(true)
    setErrorMessage('')
    setActiveTab('chat')
    setMessages((current) => [...current, { role: 'user', content: askedQuestion }])

    try {
      const result = await askQuestion(token, askedQuestion)

      setLastAnswer(result)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.answer,
          sources: result.sources || [],
        },
      ])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setQuestionPending(false)
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault()
    if (!token) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await createTeam(token, createTeamForm.name)
      setCreateTeamForm(createTeamDefaults)
      await loadAdminData(token)
      setAdminMessage('Takim olusturuldu.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  async function handleRenameTeam(event) {
    event.preventDefault()
    if (!token) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await updateTeam(token, renameTeamForm.teamId, renameTeamForm.name)
      setRenameTeamForm(renameTeamDefaults)
      await loadAdminData(token)
      setAdminMessage('Takim adi guncellendi.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    if (!token) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await createUser(token, {
        ...createUserForm,
        teamId:
          createUserForm.role === 'user'
            ? toNumberOrNull(createUserForm.teamId)
            : toNumberOrNull(createUserForm.teamId),
      })

      setCreateUserForm(createUserDefaults)
      await loadAdminData(token)
      setAdminMessage('Kullanici olusturuldu.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  async function handleAssignUserTeam(event) {
    event.preventDefault()
    if (!token) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await updateUserTeam(
        token,
        assignUserTeamForm.userId,
        toNumberOrNull(assignUserTeamForm.teamId),
      )

      setAssignUserTeamForm(assignUserTeamDefaults)
      await loadAdminData(token)
      setAdminMessage('Kullanici takimi guncellendi.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  async function handleSyncDocuments() {
    if (!token) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await syncDocuments(token)
      await Promise.all([loadDocuments(token), loadAdminData(token)])
      setAdminMessage('Dokumanlar senkronize edildi.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  function toggleTeamDocument(documentId) {
    setSelectedTeamDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    )
  }

  async function handleSaveTeamDocuments(event) {
    event.preventDefault()
    if (!token || !selectedTeamId) {
      return
    }

    setAdminActionPending(true)
    setAdminMessage('')

    try {
      await updateTeamDocuments(token, selectedTeamId, selectedTeamDocumentIds)
      await Promise.all([loadDocuments(token), loadAdminData(token)])
      setAdminMessage('Takim dokumanlari guncellendi.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAdminActionPending(false)
    }
  }

  const dashboardCards = useMemo(
    () => [
      { label: 'Rol', value: user?.role || '-' },
      { label: 'Takim', value: user?.team?.name || (user?.role === 'admin' ? 'Admin' : '-') },
      { label: 'Dokuman', value: `${documents.length} ${documentCountLabel}` },
      { label: 'Kaynak', value: `${sourceCount}` },
    ],
    [documents.length, documentCountLabel, sourceCount, user],
  )

  if (authLoading) {
    return (
      <main className="screen screen-loading">
        <button className="theme-toggle floating" onClick={toggleTheme} type="button">
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <div className="loading-box">Yukleniyor...</div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="screen screen-login">
        <button className="theme-toggle floating" onClick={toggleTheme} type="button">
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <form className="login-panel" onSubmit={handleLogin}>
          <h1>Giris Yap</h1>

          <label className="input-group">
            <span>Kullanici Adi</span>
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="input-group">
            <span>Sifre</span>
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              required
            />
          </label>

          {errorMessage ? <p className="status-error">{errorMessage}</p> : null}

          <button className="button-dark" type="submit" disabled={loginPending}>
            {loginPending ? 'Giris yapiliyor...' : 'Giris'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="screen app-screen">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Menü</h2>
        </div>

        <nav className="sidebar-nav">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={tab.key === activeTab ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-box">
            <strong>{user.fullName}</strong>
            <span>{user.role === 'admin' ? 'Admin' : user.team?.name || 'User'}</span>
          </div>
          <button className="button-outline" onClick={handleLogout} type="button">
            Sign Out
          </button>
        </div>
      </aside>

      <section className="content-shell">
        <header className="content-header">
          <h1>{getTabTitle(activeTab)}</h1>
          <button className="theme-toggle" onClick={toggleTheme} type="button">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </header>

        {errorMessage ? <p className="status-error content-error">{errorMessage}</p> : null}
        {adminMessage && activeTab === 'admin' ? (
          <p className="status-success content-error">{adminMessage}</p>
        ) : null}

        <section className="content-body">
          {activeTab === 'dashboard' ? (
            <section className="dashboard-grid">
              {dashboardCards.map((card) => (
                <article key={card.label} className="info-card">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}

              <article className="info-card info-card-wide">
                <span>Son cevap</span>
                <strong>{lastAnswer?.answer || 'Henuz soru sorulmadi.'}</strong>
              </article>
            </section>
          ) : null}

          {activeTab === 'chat' ? (
            <section className="chat-layout">
              <div className="messages">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={message.role === 'assistant' ? 'message assistant' : 'message user'}
                  >
                    <p>{message.content}</p>

                    {message.sources?.length ? (
                      <div className="message-sources">
                        {message.sources.map((source, sourceIndex) => (
                          <div
                            key={`${source.file_name}-${sourceIndex}`}
                            className="source-chip"
                          >
                            <strong>{source.file_name}</strong>
                            <span>{getLocationLabel(source)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <form className="chat-input-row" onSubmit={handleAskQuestion}>
                <input
                  placeholder="Mesajinizi yazin..."
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <button className="button-dark send-button" disabled={questionPending} type="submit">
                  {questionPending ? 'Bekleyin' : 'Gönder'}
                </button>
              </form>
            </section>
          ) : null}

          {activeTab === 'documents' ? (
            <section className="list-section">
              <div className="section-toolbar">
                <p>Erisilebilen dokumanlar</p>
                <span>{documentsLoading ? 'Yukleniyor...' : `${documents.length} adet`}</span>
              </div>

              <div className="list-grid">
                {documents.map((document) => (
                  <article key={document.id} className="list-card">
                    <strong>{document.file_name}</strong>
                    <span>{document.file_path}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'sources' ? (
            <section className="list-section">
              <div className="section-toolbar">
                <p>Son cevap kaynaklari</p>
                <span>{sourceCount} adet</span>
              </div>

              <div className="list-grid">
                {(lastAnswer?.sources || []).map((source, index) => (
                  <article key={`${source.file_name}-${index}`} className="list-card">
                    <strong>{source.file_name}</strong>
                    <span>{getLocationLabel(source)}</span>
                    <p>{source.excerpt}</p>
                  </article>
                ))}

                {!lastAnswer?.sources?.length ? (
                  <article className="list-card empty-card">
                    <strong>Kaynak yok</strong>
                    <span>Bir soru sorduktan sonra burada kaynaklar gorunecek.</span>
                  </article>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab === 'admin' && user.role === 'admin' ? (
            <section className="admin-layout">
              <div className="admin-row">
                <article className="admin-card">
                  <div className="section-toolbar">
                    <p>Dokuman islemleri</p>
                    <button
                      className="button-dark small-button"
                      type="button"
                      onClick={handleSyncDocuments}
                      disabled={adminActionPending || adminLoading}
                    >
                      Sync Documents
                    </button>
                  </div>

                  <div className="compact-list">
                    {adminDocuments.map((document) => (
                      <div key={document.id} className="compact-item">
                        <strong>{document.file_name}</strong>
                        <span>{document.assigned_team_count || 0} takim</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="admin-card">
                  <div className="section-toolbar">
                    <p>Takimlar</p>
                    <span>{adminTeams.length} adet</span>
                  </div>

                  <form className="stack-form" onSubmit={handleCreateTeam}>
                    <label className="input-group">
                      <span>Yeni takim</span>
                      <input
                        value={createTeamForm.name}
                        onChange={(event) =>
                          setCreateTeamForm({ name: event.target.value })
                        }
                        required
                      />
                    </label>
                    <button className="button-dark small-button" disabled={adminActionPending}>
                      Takim Olustur
                    </button>
                  </form>

                  <form className="stack-form" onSubmit={handleRenameTeam}>
                    <label className="input-group">
                      <span>Takim sec</span>
                      <select
                        value={renameTeamForm.teamId}
                        onChange={(event) =>
                          setRenameTeamForm((current) => ({
                            ...current,
                            teamId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Seciniz</option>
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="input-group">
                      <span>Yeni isim</span>
                      <input
                        value={renameTeamForm.name}
                        onChange={(event) =>
                          setRenameTeamForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <button className="button-dark small-button" disabled={adminActionPending}>
                      Takim Adini Guncelle
                    </button>
                  </form>
                </article>
              </div>

              <div className="admin-row">
                <article className="admin-card">
                  <div className="section-toolbar">
                    <p>Kullanici Olustur</p>
                    <span>{adminUsers.length} kullanici</span>
                  </div>

                  <form className="stack-form" onSubmit={handleCreateUser}>
                    <label className="input-group">
                      <span>Email</span>
                      <input
                        value={createUserForm.email}
                        onChange={(event) =>
                          setCreateUserForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="input-group">
                      <span>Ad Soyad</span>
                      <input
                        value={createUserForm.fullName}
                        onChange={(event) =>
                          setCreateUserForm((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="input-group">
                      <span>Sifre</span>
                      <input
                        type="password"
                        value={createUserForm.password}
                        onChange={(event) =>
                          setCreateUserForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="input-group">
                      <span>Rol</span>
                      <select
                        value={createUserForm.role}
                        onChange={(event) =>
                          setCreateUserForm((current) => ({
                            ...current,
                            role: event.target.value,
                            teamId: event.target.value === 'admin' ? '' : current.teamId,
                          }))
                        }
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </label>

                    <label className="input-group">
                      <span>Takim</span>
                      <select
                        value={createUserForm.teamId}
                        onChange={(event) =>
                          setCreateUserForm((current) => ({
                            ...current,
                            teamId: event.target.value,
                          }))
                        }
                        required={createUserForm.role === 'user'}
                      >
                        <option value="">Seciniz</option>
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button className="button-dark small-button" disabled={adminActionPending}>
                      Kullanici Ekle
                    </button>
                  </form>
                </article>

                <article className="admin-card">
                  <div className="section-toolbar">
                    <p>Kullanici Takimi</p>
                    <span>Var olan kullanici guncelle</span>
                  </div>

                  <form className="stack-form" onSubmit={handleAssignUserTeam}>
                    <label className="input-group">
                      <span>Kullanici</span>
                      <select
                        value={assignUserTeamForm.userId}
                        onChange={(event) =>
                          setAssignUserTeamForm((current) => ({
                            ...current,
                            userId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Seciniz</option>
                        {adminUsers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.fullName} ({item.role})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="input-group">
                      <span>Takim</span>
                      <select
                        value={assignUserTeamForm.teamId}
                        onChange={(event) =>
                          setAssignUserTeamForm((current) => ({
                            ...current,
                            teamId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Seciniz</option>
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button className="button-dark small-button" disabled={adminActionPending}>
                      Takim Ata
                    </button>
                  </form>
                </article>
              </div>

              <article className="admin-card">
                <div className="section-toolbar">
                  <p>Takim Dokuman Yetkileri</p>
                  <span>Backend team access mantigi</span>
                </div>

                <form className="stack-form" onSubmit={handleSaveTeamDocuments}>
                  <label className="input-group">
                    <span>Takim sec</span>
                    <select
                      value={selectedTeamId}
                      onChange={(event) => setSelectedTeamId(event.target.value)}
                      required
                    >
                      <option value="">Seciniz</option>
                      {adminTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="checkbox-grid">
                    {adminDocuments.map((document) => (
                      <label key={document.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTeamDocumentIds.includes(document.id)}
                          onChange={() => toggleTeamDocument(document.id)}
                        />
                        <span>{document.file_name}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    className="button-dark small-button"
                    disabled={adminActionPending || !selectedTeamId}
                  >
                    Dokuman Yetkilerini Kaydet
                  </button>
                </form>
              </article>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  )
}

export default App
