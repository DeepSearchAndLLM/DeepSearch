const express = require("express");

const adminRoutes = require("./admin.routes");
const authRoutes = require("./auth.routes");
const chatRoutes = require("./chat.routes");
const documentRoutes = require("./document.routes");

const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/documents", documentRoutes);

module.exports = router;
