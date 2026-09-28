

const express = require("express");

const {
  getTransactionStatus,
} = require("../controllers/transactionController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.get("/:reference", authenticate, getTransactionStatus);

module.exports = router;



