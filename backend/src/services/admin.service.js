const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");

const { query, pool } = require("../config/database");
const { env } = require("../config/env");
const { findUserByEmail, findUserById } = require("./auth.service");
const { badRequest, notFound } = require("../utils/http-errors");

const ALLOWED_FILE_TYPES = new Set([".txt", ".pdf", ".docx"]);
const ALLOWED_ROLES = new Set(["admin", "user"]);

async function ensureTeamExists(teamId) {
  const result = await query(
    `
      SELECT id, name, is_active
      FROM teams
      WHERE id = $1
      LIMIT 1
    `,
    [teamId]
  );

  const team = result.rows[0] || null;
  if (!team || !team.is_active) {
    throw badRequest("Selected team does not exist or is inactive");
  }

  return team;
}

async function getUsersWithPermissions() {
  const result = await query(
    `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.team_id,
        u.is_active,
        u.created_at,
        t.name AS team_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'fileName', d.file_name,
              'fileType', d.file_type
            )
            ORDER BY d.file_name
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM users u
      LEFT JOIN teams t
        ON t.id = u.team_id
      LEFT JOIN team_documents td
        ON td.team_id = t.id
      LEFT JOIN documents d
        ON d.id = td.document_id
        AND d.is_active = TRUE
      GROUP BY u.id, t.id
      ORDER BY u.created_at ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    team: row.team_id
      ? {
          id: row.team_id,
          name: row.team_name,
        }
      : null,
    isActive: row.is_active,
    createdAt: row.created_at,
    documents: row.documents,
  }));
}

async function getTeamsWithAccess() {
  const result = await query(
    `
      SELECT
        t.id,
        t.name,
        t.is_active,
        t.created_at,
        COUNT(DISTINCT u.id)::int AS user_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'fileName', d.file_name,
              'fileType', d.file_type
            )
            ORDER BY d.file_name
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM teams t
      LEFT JOIN users u
        ON u.team_id = t.id
        AND u.is_active = TRUE
      LEFT JOIN team_documents td
        ON td.team_id = t.id
      LEFT JOIN documents d
        ON d.id = td.document_id
        AND d.is_active = TRUE
      GROUP BY t.id
      ORDER BY t.name ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    userCount: row.user_count,
    documents: row.documents,
  }));
}

async function createTeam({ name }) {
  if (!name || !name.trim()) {
    throw badRequest("name is required");
  }

  const normalizedName = name.trim();
  const existing = await query(
    `
      SELECT id
      FROM teams
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `,
    [normalizedName]
  );

  if (existing.rows[0]) {
    throw badRequest("A team with this name already exists");
  }

  const result = await query(
    `
      INSERT INTO teams (name)
      VALUES ($1)
      RETURNING id, name, is_active, created_at
    `,
    [normalizedName]
  );

  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    isActive: result.rows[0].is_active,
    createdAt: result.rows[0].created_at,
    userCount: 0,
    documents: [],
  };
}

async function updateTeam({ teamId, name }) {
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw badRequest("teamId must be a valid number");
  }

  if (!name || !name.trim()) {
    throw badRequest("name is required");
  }

  await ensureTeamExists(teamId);

  const normalizedName = name.trim();
  const duplicate = await query(
    `
      SELECT id
      FROM teams
      WHERE LOWER(name) = LOWER($1)
        AND id <> $2
      LIMIT 1
    `,
    [normalizedName, teamId]
  );

  if (duplicate.rows[0]) {
    throw badRequest("A team with this name already exists");
  }

  await query(
    `
      UPDATE teams
      SET name = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [teamId, normalizedName]
  );

  const refreshedTeams = await getTeamsWithAccess();
  const refreshedTeam = refreshedTeams.find((team) => team.id === teamId);

  return refreshedTeam;
}

async function createUserAccount({
  email,
  fullName,
  password,
  role = "user",
  teamId = null,
}) {
  if (!email || !fullName || !password) {
    throw badRequest("email, fullName and password are required");
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw badRequest("role must be admin or user");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw badRequest("A user with this email already exists");
  }

  let normalizedTeamId = null;
  if (role === "user") {
    if (!teamId) {
      throw badRequest("teamId is required for role user");
    }

    normalizedTeamId = Number(teamId);
    if (!Number.isInteger(normalizedTeamId) || normalizedTeamId <= 0) {
      throw badRequest("teamId must be a valid number");
    }

    await ensureTeamExists(normalizedTeamId);
  } else if (teamId !== null && teamId !== undefined) {
    normalizedTeamId = Number(teamId);
    if (!Number.isInteger(normalizedTeamId) || normalizedTeamId <= 0) {
      throw badRequest("teamId must be a valid number");
    }
    await ensureTeamExists(normalizedTeamId);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `
      INSERT INTO users (email, full_name, password_hash, role, team_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name, role, team_id, is_active, created_at
    `,
    [email, fullName, passwordHash, role, normalizedTeamId]
  );

  const user = result.rows[0];
  const team =
    normalizedTeamId !== null ? await ensureTeamExists(normalizedTeamId) : null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    team: team
      ? {
          id: team.id,
          name: team.name,
        }
      : null,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

async function getAdminDocuments() {
  const result = await query(
    `
      SELECT
        d.id,
        d.file_name,
        d.file_path,
        d.file_type,
        d.is_active,
        d.created_at,
        d.updated_at,
        d.last_indexed_at,
        COUNT(DISTINCT td.team_id)::int AS assigned_team_count
      FROM documents d
      LEFT JOIN team_documents td
        ON td.document_id = d.id
      GROUP BY d.id
      ORDER BY d.file_name ASC
    `
  );

  return result.rows;
}

function getFileTypeFromName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (!ALLOWED_FILE_TYPES.has(extension)) {
    return null;
  }

  return extension.slice(1);
}

async function syncDocumentsFromFilesystem() {
  const entries = await fs.readdir(env.documentsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => getFileTypeFromName(name));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT id, file_name, is_active
        FROM documents
      `
    );

    const existingByName = new Map(
      existingResult.rows.map((row) => [row.file_name, row])
    );

    const inserted = [];
    const reactivated = [];

    for (const fileName of files) {
      const fileType = getFileTypeFromName(fileName);
      const filePath = `data/documents/${fileName}`;
      const existing = existingByName.get(fileName);

      if (!existing) {
        const insertResult = await client.query(
          `
            INSERT INTO documents (file_name, file_path, file_type, is_active)
            VALUES ($1, $2, $3, TRUE)
            RETURNING id, file_name, file_type
          `,
          [fileName, filePath, fileType]
        );
        inserted.push(insertResult.rows[0]);
        continue;
      }

      if (!existing.is_active) {
        const updateResult = await client.query(
          `
            UPDATE documents
            SET is_active = TRUE,
                file_path = $2,
                file_type = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, file_name, file_type
          `,
          [existing.id, filePath, fileType]
        );
        reactivated.push(updateResult.rows[0]);
      }
    }

    const diskFileSet = new Set(files);
    const missingInFilesystem = existingResult.rows
      .filter((row) => row.is_active && !diskFileSet.has(row.file_name))
      .map((row) => row.file_name);

    await client.query("COMMIT");

    return {
      scannedCount: files.length,
      inserted,
      reactivated,
      missingInFilesystem,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function assignUserToTeam({ userId, teamId }) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw badRequest("userId must be a valid number");
  }

  const targetUser = await findUserById(userId);
  if (!targetUser) {
    throw notFound("User not found");
  }

  let normalizedTeamId = null;
  if (teamId !== null && teamId !== undefined) {
    normalizedTeamId = Number(teamId);
    if (!Number.isInteger(normalizedTeamId) || normalizedTeamId <= 0) {
      throw badRequest("teamId must be a valid number");
    }
    await ensureTeamExists(normalizedTeamId);
  }

  if (targetUser.role === "user" && normalizedTeamId === null) {
    throw badRequest("Non-admin users must belong to a team");
  }

  await query(
    `
      UPDATE users
      SET team_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [userId, normalizedTeamId]
  );

  const refreshedUsers = await getUsersWithPermissions();
  const refreshedUser = refreshedUsers.find((user) => user.id === userId);

  return { user: refreshedUser };
}

async function replaceTeamDocumentAccess({ teamId, documentIds, actorId }) {
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw badRequest("teamId must be a valid number");
  }

  if (!Array.isArray(documentIds)) {
    throw badRequest("documentIds must be an array");
  }

  await ensureTeamExists(teamId);

  const normalizedDocumentIds = [...new Set(documentIds.map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0
  );

  if (normalizedDocumentIds.length !== documentIds.length) {
    throw badRequest("documentIds must contain only valid numeric ids");
  }

  const documentsResult = normalizedDocumentIds.length
    ? await query(
        `
          SELECT id
          FROM documents
          WHERE id = ANY($1::bigint[])
            AND is_active = TRUE
        `,
        [normalizedDocumentIds]
      )
    : { rows: [] };

  if (documentsResult.rows.length !== normalizedDocumentIds.length) {
    throw badRequest("One or more documentIds do not exist or are inactive");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM team_documents
        WHERE team_id = $1
      `,
      [teamId]
    );

    for (const documentId of normalizedDocumentIds) {
      await client.query(
        `
          INSERT INTO team_documents (team_id, document_id, granted_by)
          VALUES ($1, $2, $3)
        `,
        [teamId, documentId, actorId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const refreshedTeams = await getTeamsWithAccess();
  const refreshedTeam = refreshedTeams.find((team) => team.id === teamId);

  return { team: refreshedTeam };
}

module.exports = {
  assignUserToTeam,
  createTeam,
  createUserAccount,
  getAdminDocuments,
  getTeamsWithAccess,
  getUsersWithPermissions,
  replaceTeamDocumentAccess,
  syncDocumentsFromFilesystem,
  updateTeam,
};
