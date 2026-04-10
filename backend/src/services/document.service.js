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

module.exports = {
  listDocumentsForUser,
};
