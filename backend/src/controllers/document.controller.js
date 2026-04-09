const { listDocumentsForUser } = require("../services/document.service");

async function listDocuments(req, res, next) {
  try {
    const documents = await listDocumentsForUser(req.user);
    res.json({ documents });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDocuments,
};
