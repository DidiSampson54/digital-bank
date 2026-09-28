
const pool = require("../config/database");
const crypto = require("crypto");

const intraBankTransfer = async (req, res) => {
  const {
    customer_id,
    sender_account_number,
    receiver_account_number,
    amount,
    narration,
  } = req.body;

  if (
    !customer_id ||
    !sender_account_number ||
    !receiver_account_number ||
    amount === undefined
  ) {
    return res.status(400).json({
      message:
        "Customer ID, sender account, receiver account and amount are required",
    });
  }

  if (sender_account_number === receiver_account_number) {
    return res.status(400).json({
      message: "Sender and receiver accounts must be different",
    });
  }

  const transferAmount = Number(amount);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({
      message: "Transfer amount must be greater than zero",
    });
  }

  const customerId = Number(customer_id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const senderResult = await client.query(
      `SELECT
         id,
         customer_id,
         account_number,
         balance
       FROM accounts
       WHERE account_number = $1
       FOR UPDATE`,
      [sender_account_number]
    );

    if (senderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Sender account not found",
      });
    }

    const sender = senderResult.rows[0];

    if (sender.customer_id !== customerId) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        message: "You are not authorized to use this account",
      });
    }

    const receiverResult = await client.query(
      `SELECT
         id,
         account_number,
         balance
       FROM accounts
       WHERE account_number = $1
       FOR UPDATE`,
      [receiver_account_number]
    );

    if (receiverResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Receiver account not found",
      });
    }

    const receiver = receiverResult.rows[0];

    const senderBalance = Number(sender.balance);

    if (senderBalance < transferAmount) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const transactionReference = crypto.randomUUID();

    await client.query(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE id = $2`,
      [transferAmount, sender.id]
    );

    await client.query(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE id = $2`,
      [transferAmount, receiver.id]
    );

    const transactionResult = await client.query(
      `INSERT INTO transactions (
         transaction_reference,
         sender_account_id,
         receiver_account_id,
         receiver_account_number,
         amount,
         transfer_type,
         status,
         narration
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         'INTRA_BANK',
         'SUCCESS',
         $6
       )
       RETURNING *`,
      [
        transactionReference,
        sender.id,
        receiver.id,
        receiver.account_number,
        transferAmount,
        narration || null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Transfer successful",
      transaction: transactionResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError.message);
    }

    console.error("Intra-bank transfer failed:", error);

    return res.status(500).json({
      message: "Transfer failed",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  intraBankTransfer,
};

