const express = require("express");

const {
  verifyCustomer,
} = require("../controllers/onboardingController");

const router = express.Router();

router.post("/", verifyCustomer);

module.exports = router;