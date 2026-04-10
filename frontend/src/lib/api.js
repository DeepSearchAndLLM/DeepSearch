const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function request(path, options = {}) {
  const { headers = {}, ...restOptions } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed')
  }

  return payload
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function login(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function getCurrentUser(token) {
  const payload = await request('/auth/me', {
    headers: authHeaders(token),
  })

  return payload.user
}

export async function getDocuments(token) {
  const payload = await request('/documents', {
    headers: authHeaders(token),
  })

  return payload.documents || []
}

export async function askQuestion(token, question) {
  return request('/chat/ask', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ question }),
  })
}

export async function getTeams(token) {
  const payload = await request('/admin/teams', {
    headers: authHeaders(token),
  })

  return payload.teams || []
}

export async function createTeam(token, name) {
  const payload = await request('/admin/teams', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })

  return payload.team
}

export async function updateTeam(token, teamId, name) {
  const payload = await request(`/admin/teams/${teamId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })

  return payload.team
}

export async function updateTeamDocuments(token, teamId, documentIds) {
  const payload = await request(`/admin/teams/${teamId}/documents`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ documentIds }),
  })

  return payload.team
}

export async function getUsers(token) {
  const payload = await request('/admin/users', {
    headers: authHeaders(token),
  })

  return payload.users || []
}

export async function createUser(token, userData) {
  const payload = await request('/admin/users', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(userData),
  })

  return payload.user
}

export async function updateUserTeam(token, userId, teamId) {
  const payload = await request(`/admin/users/${userId}/team`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ teamId }),
  })

  return payload.user
}

export async function getAdminDocuments(token) {
  const payload = await request('/admin/documents', {
    headers: authHeaders(token),
  })

  return payload.documents || []
}

export async function syncDocuments(token) {
  return request('/admin/documents/sync', {
    method: 'POST',
    headers: authHeaders(token),
  })
}
