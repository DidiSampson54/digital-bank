
const pool = require("../config/database");
const crypto = require("crypto");
const { transferFunds } = require("../services/transferService");

const interbankTransfer = async (req, res) => {
  const {
    customer_id,
    sender_account_number,
    receiver_account_number,
    receiver_bank_code,
    amount,
    narration,
  } = req.body;

  if (
    !customer_id ||
    !sender_account_number ||
    !receiver_account_number ||
    !receiver_bank_code ||
    amount === undefined ||
    amount === null
  ) {
    return res.status(400).json({
      message:
        "Customer ID, sender account, receiver account, bank code and amount are required",
    });
  }

  const customerId = Number(customer_id);
  const transferAmount = Number(amount);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  if (
    !Number.isFinite(transferAmount) ||
    transferAmount <= 0
  ) {
    return res.status(400).json({
      message: "Transfer amount must be greater than zero",
    });
  }

  if (
    sender_account_number ===
    receiver_account_number
  ) {
    return res.status(400).json({
      message:
        "Sender and receiver accounts must be different",
    });
  }

  if (
    !/^\d{10}$/.test(
      receiver_account_number.toString()
    )
  ) {
    return res.status(400).json({
      message:
        "Receiver account number must be 10 digits",
    });
  }

  const client = await pool.connect();

  try {
    const senderResult = await client.query(
      `SELECT
         id,
         customer_id,
         account_number,
         nibss_account_number,
         balance
       FROM accounts
       WHERE account_number = $1`,
      [sender_account_number]
    );

    if (senderResult.rows.length === 0) {
      return res.status(404).json({
        message: "Sender account not found",
      });
    }

    const sender = senderResult.rows[0];

    if (Number(sender.customer_id) !== customerId) {
      return res.status(403).json({
        message:
          "You are not authorized to use this account",
      });
    }

    const senderBalance = Number(sender.balance);

    if (senderBalance < transferAmount) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    /*
     * PAYASAP DEMO ACCOUNT
     *
     * This account does not exist inside NIBSS.
     * Therefore we simulate the inter-bank transfer
     * locally instead of sending it to NIBSS.
     */
    const onboardingResult = await client.query(
      `SELECT provider_reference
       FROM onboarding
       WHERE customer_id = $1
         AND status = 'VERIFIED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId]
    );

    const providerReference =
      onboardingResult.rows[0]?.provider_reference;

    if (providerReference === "PAYASAP-DEMO") {
      const transactionReference =
        crypto.randomUUID();

      await client.query("BEGIN");

      await client.query(
        `UPDATE accounts
         SET balance = balance - $1
         WHERE id = $2`,
        [transferAmount, sender.id]
      );

      const transactionResult = await client.query(
        `INSERT INTO transactions (
           transaction_reference,
           sender_account_id,
           receiver_account_id,
           receiver_account_number,
           receiver_bank_code,
           amount,
           transfer_type,
           status,
           narration,
           provider_reference
         )
         VALUES (
           $1,
           $2,
           NULL,
           $3,
           $4,
           $5,
           'INTER_BANK',
           'SUCCESS',
           $6,
           'PAYASAP-DEMO'
         )
         RETURNING *`,
        [
          transactionReference,
          sender.id,
          receiver_account_number,
          receiver_bank_code,
          transferAmount,
          narration || "Demo inter-bank transfer",
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message:
          "Demo inter-bank transfer successful",
        demo: true,
        transaction:
          transactionResult.rows[0],
      });
    }

    /*
     * REAL NIBSS INTER-BANK TRANSFER
     *
     * This path is kept for accounts that were
     * actually created through NIBSS.
     */
    if (!sender.nibss_account_number) {
      return res.status(400).json({
        message:
          "Sender account is not linked to a NIBSS account",
      });
    }

    const transactionReference =
      crypto.randomUUID();

    const nibssResult = await transferFunds(
      sender.nibss_account_number,
      receiver_account_number,
      receiver_bank_code,
      transferAmount
    );

    await client.query("BEGIN");

    await client.query(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE id = $2`,
      [transferAmount, sender.id]
    );

    const transactionResult = await client.query(
      `INSERT INTO transactions (
         transaction_reference,
         sender_account_id,
         receiver_account_id,
         receiver_account_number,
         receiver_bank_code,
         amount,
         transfer_type,
         status,
         narration,
         provider_reference
       )
       VALUES (
         $1,
         $2,
         NULL,
         $3,
         $4,
         $5,
         'INTER_BANK',
         'SUCCESS',
         $6,
         $7
       )
       RETURNING *`,
      [
        transactionReference,
        sender.id,
        receiver_account_number,
        receiver_bank_code,
        transferAmount,
        narration || null,
        nibssResult.reference ||
          nibssResult.transactionReference ||
          null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message:
        "Inter-bank transfer successful",
      demo: false,
      transaction:
        transactionResult.rows[0],
      provider_response: nibssResult,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError.message
      );
    }

    console.error(
      "Inter-bank transfer error:",
      error.response?.data || error.message
    );

    return res.status(
      error.response?.status || 500
    ).json({
      message: "Inter-bank transfer failed",
      error:
        error.response?.data || error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  interbankTransfer,
};

