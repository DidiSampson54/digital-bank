
const express = require("express");

const {
  intraBankTransfer,
} = require("../controllers/transferController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/intra-bank", authenticate, intraBankTransfer);

module.exports = router;

