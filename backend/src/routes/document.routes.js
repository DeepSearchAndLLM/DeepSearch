const express = require("express");
const multer = require("multer");

const {
  listDocuments,
  uploadDocument,
} = require("../controllers/document.controller");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.get("/", authenticate, listDocuments);
router.post("/", authenticate, upload.single("file"), uploadDocument);

module.exports = router;
