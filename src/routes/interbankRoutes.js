
const express = require("express");

const {
  interbankTransfer,
} = require("../controllers/interbankController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, interbankTransfer);

module.exports = router;

