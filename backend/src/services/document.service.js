const fs = require("fs/promises");
const path = require("path");

const { query } = require("../config/database");
const { env } = require("../config/env");
const { badRequest } = require("../utils/http-errors");

const ALLOWED_FILE_TYPES = new Set([".txt", ".pdf", ".docx"]);

function getFileType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (!ALLOWED_FILE_TYPES.has(extension)) {
    return null;
  }

  return extension.slice(1);
}

function sanitizeFileName(fileName) {
  const parsed = path.parse(fileName);
  const safeBaseName = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${safeBaseName || "document"}${parsed.ext.toLowerCase()}`;
}

async function createUniqueFileName(fileName) {
  const safeName = sanitizeFileName(fileName);
  const parsed = path.parse(safeName);
  let candidate = safeName;
  let attempt = 1;

  while (true) {
    try {
      await fs.access(path.join(env.documentsDir, candidate));
      candidate = `${parsed.name}-${Date.now()}-${attempt}${parsed.ext}`;
      attempt += 1;
    } catch (_error) {
      return candidate;
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

async function createDocumentForUser({ user, file }) {
  if (!file) {
    throw badRequest("file is required");
  }

  const fileType = getFileType(file.originalname);
  if (!fileType) {
    throw badRequest("Only txt, pdf and docx files can be uploaded");
  }

  if (user.role !== "admin" && !user.teamId) {
    throw badRequest("User must belong to a team to upload documents");
  }

  await fs.mkdir(env.documentsDir, { recursive: true });

  const fileName = await createUniqueFileName(file.originalname);
  const absolutePath = path.join(env.documentsDir, fileName);
  const relativePath = `data/documents/${fileName}`;

  await fs.writeFile(absolutePath, file.buffer);

  try {
    const insertResult = await query(
      `
        INSERT INTO documents (file_name, file_path, file_type)
        VALUES ($1, $2, $3)
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

    const document = insertResult.rows[0];

    if (user.role === "admin") {
      await query(
        `
          INSERT INTO team_documents (team_id, document_id, granted_by)
          SELECT id, $1, $2
          FROM teams
          WHERE is_active = TRUE
          ON CONFLICT (team_id, document_id) DO NOTHING
        `,
        [document.id, user.id]
      );
    } else {
      await query(
        `
          INSERT INTO team_documents (team_id, document_id, granted_by)
          VALUES ($1, $2, $3)
          ON CONFLICT (team_id, document_id) DO NOTHING
        `,
        [user.teamId, document.id, user.id]
      );
    }

    return document;
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => {});
    throw error;
  }
}

module.exports = {
  createDocumentForUser,
  listDocumentsForUser,
};
