const express = require("express");

const {
  createUser,
  listDocuments,
  listUsers,
  syncDocuments,
  updateUserPermissions,
} = require("../controllers/admin.controller");
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/require-role");

const router = express.Router();

router.use(authenticate, requireRole("admin"));

router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:userId/document-permissions", updateUserPermissions);
router.get("/documents", listDocuments);
router.post("/documents/sync", syncDocuments);

module.exports = router;
