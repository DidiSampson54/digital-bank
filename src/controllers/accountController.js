const axios = require("axios");
const pool = require("../config/database");

// CREATE ACCOUNT
const createAccount = async (req, res) => {
  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
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
         verification_dob,
         provider_reference
       FROM onboarding
       WHERE customer_id = $1
         AND status = 'VERIFIED'
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

    /*
     * PAYASAP PORTFOLIO DEMO ACCOUNT
     *
     * Demo identities use PAYASAP-DEMO as their provider
     * reference. For these customers, we create the
     * account locally instead of sending the fake identity
     * to NIBSS.
     */
    if (onboarding.provider_reference === "PAYASAP-DEMO") {
      let accountNumber;
      let accountExists = true;

      while (accountExists) {
        accountNumber = Math.floor(
          1000000000 + Math.random() * 9000000000
        ).toString();

        const duplicateCheck = await pool.query(
          `SELECT id
           FROM accounts
           WHERE account_number = $1`,
          [accountNumber]
        );

        accountExists = duplicateCheck.rows.length > 0;
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
          accountNumber,
          accountNumber,
          15000,
        ]
      );

      return res.status(201).json({
        message: "Demo account created successfully",
        account: result.rows[0],
        demo: true,
      });
    }

    /*
     * REAL/TEST NIBSS ACCOUNT CREATION
     */
    const kycType =
      onboarding.verification_type.toLowerCase();

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
      error:
        error.response?.data || error.message,
    });
  }
};


// GET LOGGED-IN CUSTOMER'S ACCOUNT
const getMyAccount = async (req, res) => {
  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         nibss_account_number,
         balance,
         savebox_balance,
         created_at
       FROM accounts
       WHERE customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    return res.status(200).json({
      message: "Account retrieved successfully",
      account: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Get account error:",
      error
    );

    return res.status(500).json({
      message: "Failed to retrieve account",
    });
  }
};


// GET ACCOUNT BALANCE
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
    console.error(
      "Balance enquiry error:",
      error
    );

    return res.status(500).json({
      message: "Failed to retrieve account balance",
    });
  }
};

// MOVE MONEY TO SAVEBOX
const moveToSaveBox = async (req, res) => {
  const customerId = req.user.customer_id;
  const { amount } = req.body;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  const transferAmount = Number(amount);

  if (!transferAmount || transferAmount <= 0) {
    return res.status(400).json({
      message: "A valid amount greater than 0 is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountResult = await client.query(
      `SELECT
         id,
         balance,
         savebox_balance
       FROM accounts
       WHERE customer_id = $1
       FOR UPDATE`,
      [customerId]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Account not found",
      });
    }

    const account = accountResult.rows[0];

    const mainBalance = Number(account.balance);

    if (transferAmount > mainBalance) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Insufficient funds",
        balance: mainBalance,
      });
    }

    const result = await client.query(
      `UPDATE accounts
       SET
         balance = balance - $1,
         savebox_balance = savebox_balance + $1
       WHERE id = $2
       RETURNING
         id,
         account_number,
         balance,
         savebox_balance`,
      [transferAmount, account.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Money moved to SaveBox successfully",
      account: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "SaveBox transfer error:",
      error
    );

    return res.status(500).json({
      message: "Failed to move money to SaveBox",
    });
  } finally {
    client.release();
  }
};


// MOVE MONEY FROM SAVEBOX BACK TO MAIN ACCOUNT
const withdrawFromSaveBox = async (req, res) => {
  const customerId = req.user.customer_id;
  const { amount } = req.body;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  const withdrawAmount = Number(amount);

  if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({
      message: "A valid amount greater than 0 is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountResult = await client.query(
      `SELECT
         id,
         balance,
         savebox_balance
       FROM accounts
       WHERE customer_id = $1
       FOR UPDATE`,
      [customerId]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Account not found",
      });
    }

    const account = accountResult.rows[0];

    const saveBoxBalance = Number(
      account.savebox_balance || 0
    );

    if (withdrawAmount > saveBoxBalance) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Insufficient SaveBox funds",
        savebox_balance: saveBoxBalance,
      });
    }

    const result = await client.query(
      `UPDATE accounts
       SET
         balance = balance + $1,
         savebox_balance = savebox_balance - $1
       WHERE id = $2
       RETURNING
         id,
         account_number,
         balance,
         savebox_balance`,
      [withdrawAmount, account.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Money withdrawn from SaveBox successfully",
      account: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "SaveBox withdrawal error:",
      error
    );

    return res.status(500).json({
      message: "Failed to withdraw money from SaveBox",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createAccount,
  getMyAccount,
  getAccountBalance,
  moveToSaveBox,
  withdrawFromSaveBox,
};