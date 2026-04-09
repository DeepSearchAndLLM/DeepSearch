const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");

const { query, pool } = require("../config/database");
const { env } = require("../config/env");
const { findUserByEmail, findUserById } = require("./auth.service");
const { badRequest, notFound } = require("../utils/http-errors");

const ALLOWED_FILE_TYPES = new Set([".txt", ".pdf", ".docx"]);
const ALLOWED_ROLES = new Set(["admin", "user"]);

async function getUsersWithPermissions() {
  const result = await query(
    `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active,
        u.created_at,
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
      LEFT JOIN document_permissions dp
        ON dp.user_id = u.id
      LEFT JOIN documents d
        ON d.id = dp.document_id
        AND d.is_active = TRUE
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    documents: row.documents,
  }));
}

async function createUserAccount({ email, fullName, password, role = "user" }) {
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

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `
      INSERT INTO users (email, full_name, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name, role, is_active, created_at
    `,
    [email, fullName, passwordHash, role]
  );

  const user = result.rows[0];
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
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
        COUNT(dp.user_id)::int AS assigned_user_count
      FROM documents d
      LEFT JOIN document_permissions dp
        ON dp.document_id = d.id
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

async function replaceUserDocumentPermissions({ userId, documentIds, actorId }) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw badRequest("userId must be a valid number");
  }

  if (!Array.isArray(documentIds)) {
    throw badRequest("documentIds must be an array");
  }

  const targetUser = await findUserById(userId);
  if (!targetUser) {
    throw notFound("User not found");
  }

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
        DELETE FROM document_permissions
        WHERE user_id = $1
      `,
      [userId]
    );

    for (const documentId of normalizedDocumentIds) {
      await client.query(
        `
          INSERT INTO document_permissions (user_id, document_id, granted_by)
          VALUES ($1, $2, $3)
        `,
        [userId, documentId, actorId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const refreshedUsers = await getUsersWithPermissions();
  const refreshedUser = refreshedUsers.find((user) => user.id === userId);

  return {
    user: refreshedUser || {
      id: userId,
      documents: [],
    },
  };
}

module.exports = {
  createUserAccount,
  getAdminDocuments,
  getUsersWithPermissions,
  replaceUserDocumentPermissions,
  syncDocumentsFromFilesystem,
};
