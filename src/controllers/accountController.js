
const axios = require("axios");
const pool = require("../config/database");

const createAccount = async (req, res) => {
  const { customer_id } = req.body;

  if (!customer_id) {
    return res.status(400).json({
      message: "Customer ID is required",
    });
  }

  const customerId = Number(customer_id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  try {
    const customerResult = await pool.query(
      `SELECT id, name
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const onboardingResult = await pool.query(
      `SELECT
         verification_type,
         verification_number,
         verification_dob
       FROM onboarding
       WHERE customer_id = $1
         AND status = 'VERIFIED'
         AND verification_number IS NOT NULL
         AND verification_dob IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId]
    );

    if (onboardingResult.rows.length === 0) {
      return res.status(403).json({
        message:
          "Customer must complete and pass onboarding before account creation",
      });
    }

    const onboarding = onboardingResult.rows[0];

    const existingAccount = await pool.query(
      `SELECT
         id,
         account_number,
         nibss_account_number,
         balance
       FROM accounts
       WHERE customer_id = $1`,
      [customerId]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(409).json({
        message: "Customer already has an account",
        account: existingAccount.rows[0],
      });
    }

    const kycType = onboarding.verification_type.toLowerCase();
    const kycId = onboarding.verification_number;

    const dob = new Date(onboarding.verification_dob)
      .toISOString()
      .split("T")[0];

    const tokenResponse = await axios.post(
      `${process.env.NIBSS_BASE_URL}/api/auth/token`,
      {
        apiKey: process.env.NIBSS_API_KEY,
        apiSecret: process.env.NIBSS_API_SECRET,
      }
    );

    const token = tokenResponse.data.token;

    const nibssResponse = await axios.post(
      `${process.env.NIBSS_BASE_URL}/api/account/create`,
      {
        kycType,
        kycID: kycId,
        dob,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const nibssAccount = nibssResponse.data.account;

    if (!nibssAccount?.accountNumber) {
      return res.status(502).json({
        message:
          "NIBSS account creation succeeded without an account number",
      });
    }

    const result = await pool.query(
      `INSERT INTO accounts (
         customer_id,
         account_number,
         nibss_account_number,
         balance
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        customerId,
        nibssAccount.accountNumber,
        nibssAccount.accountNumber,
        15000,
      ]
    );

    return res.status(201).json({
      message: "Account created successfully",
      account: result.rows[0],
      provider_response: nibssResponse.data,
    });
  } catch (error) {
    console.error(
      "Account creation error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      message: "Failed to create account",
      error: error.response?.data || error.message,
    });
  }
};

const getAccountBalance = async (req, res) => {
  const { account_number } = req.params;

  if (!account_number) {
    return res.status(400).json({
      message: "Account number is required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         account_number,
         balance
       FROM accounts
       WHERE account_number = $1`,
      [account_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    return res.status(200).json({
      message: "Balance retrieved successfully",
      account: result.rows[0],
    });
  } catch (error) {
    console.error("Balance enquiry error:", error);

    return res.status(500).json({
      message: "Failed to retrieve account balance",
    });
  }
};

module.exports = {
  createAccount,
  getAccountBalance,
};

