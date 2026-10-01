const express = require("express");

const {
  verifyCustomer,
} = require("../controllers/onboardingController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, verifyCustomer);

module.exports = router;