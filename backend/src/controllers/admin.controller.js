const {
  assignUserToTeam,
  createTeam,
  createUserAccount,
  getAdminDocuments,
  getTeamsWithAccess,
  getUsersWithPermissions,
  replaceTeamDocumentAccess,
  syncDocumentsFromFilesystem,
  updateTeam,
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

async function listTeams(req, res, next) {
  try {
    const teams = await getTeamsWithAccess();
    res.json({ teams });
  } catch (error) {
    next(error);
  }
}

async function createTeamHandler(req, res, next) {
  try {
    const team = await createTeam(req.body);
    res.status(201).json({ team });
  } catch (error) {
    next(error);
  }
}

async function updateTeamHandler(req, res, next) {
  try {
    const teamId = Number(req.params.teamId);
    const team = await updateTeam({
      teamId,
      name: req.body.name,
    });
    res.json({ team });
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

async function updateUserTeam(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const { teamId } = req.body;

    const result = await assignUserToTeam({
      userId,
      teamId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateTeamDocuments(req, res, next) {
  try {
    const teamId = Number(req.params.teamId);
    const actorId = req.user.id;
    const { documentIds } = req.body;

    const result = await replaceTeamDocumentAccess({
      teamId,
      documentIds,
      actorId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTeamHandler,
  listUsers,
  listTeams,
  createUser,
  listDocuments,
  syncDocuments,
  updateTeamHandler,
  updateTeamDocuments,
  updateUserTeam,
};
