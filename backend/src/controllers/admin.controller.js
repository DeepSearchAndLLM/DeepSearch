const {
  createUserAccount,
  getAdminDocuments,
  getUsersWithPermissions,
  syncDocumentsFromFilesystem,
  replaceUserDocumentPermissions,
} = require("../services/admin.service");

async function listUsers(req, res, next) {
  try {
    const users = await getUsersWithPermissions();
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await createUserAccount(req.body);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function listDocuments(req, res, next) {
  try {
    const documents = await getAdminDocuments();
    res.json({ documents });
  } catch (error) {
    next(error);
  }
}

async function syncDocuments(req, res, next) {
  try {
    const summary = await syncDocumentsFromFilesystem();
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function updateUserPermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const actorId = req.user.id;
    const { documentIds } = req.body;

    const result = await replaceUserDocumentPermissions({
      userId,
      documentIds,
      actorId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  listDocuments,
  syncDocuments,
  updateUserPermissions,
};
