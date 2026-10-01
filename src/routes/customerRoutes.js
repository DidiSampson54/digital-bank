const express = require("express");

const {
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const {
  getCustomerProfile,
} = require("../controllers/demoIdentityController");

const authenticate = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createCustomer);

router.get("/profile", authenticate, getCustomerProfile);

router.get("/:id", authenticate, getCustomer);

router.patch("/:id", authenticate, updateCustomer);

router.delete("/:id", authenticate, deleteCustomer);

module.exports = router;