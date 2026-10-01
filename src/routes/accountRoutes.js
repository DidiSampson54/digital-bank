
const express = require("express");

const {
  createAccount,
  getMyAccount,
  getAccountBalance,
  moveToSaveBox,
  withdrawFromSaveBox,
} = require("../controllers/accountController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

// Create account
router.post("/", authenticate, createAccount);

// Get logged-in customer's account
router.get("/me", authenticate, getMyAccount);

// Move money to SaveBox
router.post("/savebox", authenticate, moveToSaveBox);

router.post(
  "/savebox/withdraw",
  authenticate,
  withdrawFromSaveBox
);

// Get account balance
router.get(
  "/:account_number/balance",
  authenticate,
  getAccountBalance
);

module.exports = router;

