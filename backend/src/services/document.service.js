const fs = require("fs/promises");
const path = require("path");

const { env } = require("../config/env");
const { pool, query } = require("../config/database");
const { badRequest, createHttpError, notFound } = require("../utils/http-errors");

const ALLOWED_FILE_TYPES = new Set([".txt", ".pdf", ".docx"]);

function getSafeFileName(originalName) {
  const baseName = path.basename(originalName || "").replace(/[^\w .()-]/g, "_").trim();
  const extension = path.extname(baseName).toLowerCase();

  if (!baseName || baseName === "." || baseName === "..") {
    throw badRequest("file name is required");
  }

  if (!ALLOWED_FILE_TYPES.has(extension)) {
    throw badRequest("Only TXT, PDF, and DOCX files are supported");
  }

  return baseName;
}

async function ensureFileDoesNotExist(fileName) {
  const existing = await query(
    `
      SELECT id
      FROM documents
      WHERE file_name = $1
      LIMIT 1
    `,
    [fileName]
  );

  if (existing.rows[0]) {
    throw badRequest("A document with this file name already exists");
  }

  try {
    await fs.access(path.join(env.documentsDir, fileName));
    throw badRequest("A file with this name already exists");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function listDocumentsForUser(user) {
  if (user.role === "admin") {
    const result = await query(
      `
        SELECT
          id,
          file_name,
          file_path,
          file_type,
          is_active,
          created_at,
          updated_at,
          last_indexed_at
        FROM documents
        WHERE is_active = TRUE
        ORDER BY file_name ASC
      `
    );

    return result.rows;
  }

  const result = await query(
    `
      SELECT DISTINCT
        d.id,
        d.file_name,
        d.file_path,
        d.file_type,
        d.is_active,
        d.created_at,
        d.updated_at,
        d.last_indexed_at
      FROM documents d
      INNER JOIN team_documents td
        ON td.document_id = d.id
      INNER JOIN users u
        ON u.team_id = td.team_id
      WHERE u.id = $1
        AND d.is_active = TRUE
      ORDER BY d.file_name ASC
    `,
    [user.id]
  );

  return result.rows;
}

async function uploadDocumentForUser({ user, file }) {
  if (!file) {
    throw badRequest("file is required");
  }

  if (user.role !== "admin" && !user.teamId) {
    throw createHttpError(403, "You must be assigned to a team to upload documents");
  }

  const fileName = getSafeFileName(file.originalname);
  const fileType = path.extname(fileName).slice(1).toLowerCase();
  const relativePath = `data/documents/${fileName}`;
  const destinationPath = path.join(env.documentsDir, fileName);

  await fs.mkdir(env.documentsDir, { recursive: true });
  await ensureFileDoesNotExist(fileName);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await fs.writeFile(destinationPath, file.buffer, { flag: "wx" });

    const documentResult = await client.query(
      `
        INSERT INTO documents (file_name, file_path, file_type, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING
          id,
          file_name,
          file_path,
          file_type,
          is_active,
          created_at,
          updated_at,
          last_indexed_at
      `,
      [fileName, relativePath, fileType]
    );

    const document = documentResult.rows[0];

    if (user.role === "admin") {
      await client.query(
        `
          INSERT INTO team_documents (team_id, document_id, granted_by)
          SELECT id, $1, $2
          FROM teams
          WHERE is_active = TRUE
          ON CONFLICT DO NOTHING
        `,
        [document.id, user.id]
      );
    } else {
      await client.query(
        `
          INSERT INTO team_documents (team_id, document_id, granted_by)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `,
        [user.teamId, document.id, user.id]
      );
    }

    await client.query("COMMIT");
    return document;
  } catch (error) {
    await client.query("ROLLBACK");
    await fs.rm(destinationPath, { force: true }).catch(() => {});

    if (error.code === "23505") {
      throw badRequest("A document with this file name already exists");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function deleteDocumentForUser({ user, documentId }) {
  if (user.role !== "admin") {
    throw createHttpError(403, "Only admins can delete documents");
  }

  const normalizedDocumentId = Number(documentId);
  if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId <= 0) {
    throw badRequest("documentId must be a valid number");
  }

  const client = await pool.connect();
  let fileName;

  try {
    await client.query("BEGIN");

    const documentResult = await client.query(
      `
        SELECT id, file_name
        FROM documents
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [normalizedDocumentId]
    );

    const document = documentResult.rows[0];
    if (!document) {
      throw notFound("Document not found");
    }

    fileName = document.file_name;

    await client.query(
      `
        DELETE FROM team_documents
        WHERE document_id = $1
      `,
      [normalizedDocumentId]
    );

    await client.query(
      `
        DELETE FROM documents
        WHERE id = $1
      `,
      [normalizedDocumentId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (fileName) {
    await fs.rm(path.join(env.documentsDir, path.basename(fileName)), { force: true });
  }

  return { id: normalizedDocumentId };
}

module.exports = {
  deleteDocumentForUser,
  listDocumentsForUser,
  uploadDocumentForUser,
};
