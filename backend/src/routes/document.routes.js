const express = require("express");
const multer = require("multer");

const {
  deleteDocument,
  listDocuments,
  uploadDocument,
} = require("../controllers/document.controller");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.get("/", authenticate, listDocuments);
router.post("/", authenticate, upload.single("file"), uploadDocument);
router.delete("/:documentId", authenticate, deleteDocument);

module.exports = router;
