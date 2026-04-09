const express = require("express");

const { listDocuments } = require("../controllers/document.controller");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();

router.get("/", authenticate, listDocuments);

module.exports = router;
