const express = require("express");

const {
  transfer,
  getTransactionStatus,
  getTransactions,
} = require("../controllers/transactionController");

const router = express.Router();

router.post("/transfer", transfer);

router.get("/status/:reference", getTransactionStatus);

router.get("/:customerId/transactions", getTransactions);

module.exports = router;