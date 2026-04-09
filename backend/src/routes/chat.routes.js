const express = require("express");

const { askQuestion } = require("../controllers/chat.controller");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();

router.post("/ask", authenticate, askQuestion);

module.exports = router;
