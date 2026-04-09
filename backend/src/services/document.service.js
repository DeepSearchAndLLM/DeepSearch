const { query } = require("../config/database");

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
      SELECT
        d.id,
        d.file_name,
        d.file_path,
        d.file_type,
        d.is_active,
        d.created_at,
        d.updated_at,
        d.last_indexed_at
      FROM documents d
      INNER JOIN document_permissions dp
        ON dp.document_id = d.id
      WHERE dp.user_id = $1
        AND d.is_active = TRUE
      ORDER BY d.file_name ASC
    `,
    [user.id]
  );

  return result.rows;
}

module.exports = {
  listDocumentsForUser,
};
