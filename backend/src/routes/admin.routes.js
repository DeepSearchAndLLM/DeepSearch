const express = require("express");

const {
  createTeamHandler,
  createUser,
  listDocuments,
  listTeams,
  listUsers,
  syncDocuments,
  updateTeamHandler,
  updateTeamDocuments,
  updateUserTeam,
} = require("../controllers/admin.controller");
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/require-role");

const router = express.Router();

router.use(authenticate, requireRole("admin"));

router.get("/teams", listTeams);
router.post("/teams", createTeamHandler);
router.put("/teams/:teamId", updateTeamHandler);
router.put("/teams/:teamId/documents", updateTeamDocuments);
router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:userId/team", updateUserTeam);
router.get("/documents", listDocuments);
router.post("/documents/sync", syncDocuments);

module.exports = router;
