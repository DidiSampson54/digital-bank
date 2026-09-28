
const express = require("express");

const {
  createAccount,
  getAccountBalance,
} = require("../controllers/accountController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createAccount);

router.get("/:account_number/balance", authenticate, getAccountBalance);

module.exports = router;

