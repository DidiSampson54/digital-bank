
const express = require("express");

const {
  getCustomerTransactions,
  getTransactionStatus,
} = require("../controllers/transactionController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.get(
  "/:customer_id/transactions",
  authenticate,
  getCustomerTransactions
);

router.get(
  "/status/:reference",
  authenticate,
  getTransactionStatus
);

module.exports = router;
