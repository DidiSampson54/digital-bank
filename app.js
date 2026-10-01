
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const customerRoutes = require("./src/routes/customerRoutes");
const onboardingRoutes = require("./src/routes/onboardingRoutes");
const accountRoutes = require("./src/routes/accountRoutes");
const interbankRoutes = require("./src/routes/interbankRoutes");
const transferRoutes = require("./src/routes/transferRoutes");
const transactionRoutes = require("./src/routes/transactionRoutes");
const transactionStatusRoutes = require("./src/routes/transactionStatusRoutes");
const authRoutes = require("./src/routes/authRoutes");
const demoIdentityRoutes = require("./src/routes/demoIdentityRoutes");



const app = express();

app.use(cors());
app.use(express.json());

app.use("/customers", customerRoutes);
app.use("/customers", transactionRoutes);
app.use("/onboarding", onboardingRoutes);
app.use("/accounts", accountRoutes);
app.use("/transfers", transferRoutes);
app.use("/transfers/inter-bank", interbankRoutes);
app.use("/transactions", transactionStatusRoutes);
app.use("/auth", authRoutes);
app.use("/demo-identity", demoIdentityRoutes);



module.exports = app;

