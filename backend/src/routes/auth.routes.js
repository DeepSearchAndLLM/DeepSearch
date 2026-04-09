const express = require("express");

const { login, me } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, me);

module.exports = router;
