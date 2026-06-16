const {
  createDocumentForUser,
  listDocumentsForUser,
} = require("../services/document.service");

async function listDocuments(req, res, next) {
  try {
    const documents = await listDocumentsForUser(req.user);
    res.json({ documents });
  } catch (error) {
    next(error);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const document = await createDocumentForUser({
      user: req.user,
      file: req.file,
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDocuments,
  uploadDocument,
};
