const {
  deleteDocumentForUser,
  listDocumentsForUser,
  uploadDocumentForUser,
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
    const document = await uploadDocumentForUser({
      user: req.user,
      file: req.file,
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const result = await deleteDocumentForUser({
      user: req.user,
      documentId: req.params.documentId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  deleteDocument,
  listDocuments,
  uploadDocument,
};
