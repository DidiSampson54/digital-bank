
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

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  const transferAmount = Number(amount);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({
      message: "Transfer amount must be greater than zero",
    });
  }

  if (sender_account_number === receiver_account_number) {
    return res.status(400).json({
      message: "Sender and receiver accounts must be different",
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

    if (sender.customer_id !== customerId) {
      return res.status(403).json({
        message: "You are not authorized to use this account",
      });
    }

    if (!sender.nibss_account_number) {
      return res.status(400).json({
        message: "Sender account is not linked to a NIBSS account",
      });
    }

    const senderBalance = Number(sender.balance);

    if (senderBalance < transferAmount) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const transactionReference = crypto.randomUUID();

    const nibssResult = await transferFunds(
      sender.nibss_account_number,
      receiver_account_number,
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
      message: "Inter-bank transfer successful",
      transaction: transactionResult.rows[0],
      provider_response: nibssResult,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError.message);
    }

    console.error(
      "Inter-bank transfer error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      message: "Inter-bank transfer failed",
      error: error.response?.data || error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  interbankTransfer,
};

