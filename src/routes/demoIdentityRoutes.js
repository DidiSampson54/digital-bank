const express = require("express");

const {
  generateDemoNin,
  generateDemoBvn,
  getCustomerProfile,
} = require("../controllers/demoIdentityController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

// Generate or retrieve the logged-in customer's demo NIN
router.post("/nin", authenticate, generateDemoNin);

// Generate or retrieve the logged-in customer's demo BVN
router.post("/bvn", authenticate, generateDemoBvn);

router.get(
  "/profile",
  authenticate,
  getCustomerProfile
);

module.exports = router;