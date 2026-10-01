const pool = require("../config/database");

const transfer = async (req, res) => {
  try {
    const {
      senderAccountNumber,
      receiverAccountNumber,
      amount,
      narration,
    } = req.body;

    if (!senderAccountNumber || !receiverAccountNumber || !amount) {
      return res.status(400).json({
        message:
          "Sender account number, receiver account number and amount are required",
      });
    }

    const transferAmount = Number(amount);

    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        message: "Amount must be a valid number greater than zero",
      });
    }

    if (senderAccountNumber === receiverAccountNumber) {
      return res.status(400).json({
        message: "Sender and receiver accounts cannot be the same",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const senderResult = await client.query(
        `SELECT id, account_number, balance
         FROM accounts
         WHERE account_number = $1
         FOR UPDATE`,
        [senderAccountNumber]
      );

      if (senderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Sender account not found",
        });
      }

      const sender = senderResult.rows[0];

      if (Number(sender.balance) < transferAmount) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Insufficient balance",
        });
      }

      const receiverResult = await client.query(
        `SELECT id, account_number
         FROM accounts
         WHERE account_number = $1
         FOR UPDATE`,
        [receiverAccountNumber]
      );

      if (receiverResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Receiver account not found",
        });
      }

      const receiver = receiverResult.rows[0];

      const transactionReference = `TXN-${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`;

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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          transactionReference,
          sender.id,
          receiver.id,
          receiver.account_number,
          transferAmount,
          "INTRA_BANK",
          "SUCCESS",
          narration || null,
        ]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Transfer successful",
        data: transactionResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Transfer error:", error);

    return res.status(500).json({
      message: "Transfer failed",
      error: error.message,
    });
  }
};

const getTransactionStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        message: "Transaction reference is required",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM transactions
       WHERE transaction_reference = $1`,
      [reference]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      message: "Transaction found",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Transaction status error:", error);

    return res.status(500).json({
      message: "Failed to retrieve transaction status",
      error: error.message,
    });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        message: "Customer ID is required",
      });
    }

    const result = await pool.query(
      `SELECT
        t.transaction_reference,
        t.sender_account_id,
        t.receiver_account_id,
        t.receiver_account_number,
        t.amount,
        t.transfer_type,
        t.status,
        t.narration,
        t.provider_reference,
        t.created_at,
        t.updated_at,
        CASE
          WHEN sender.customer_id = $1 THEN 'OUTGOING'
          WHEN receiver.customer_id = $1 THEN 'INCOMING'
        END AS direction
       FROM transactions t
       LEFT JOIN accounts sender
         ON t.sender_account_id = sender.id
       LEFT JOIN accounts receiver
         ON t.receiver_account_id = receiver.id
       WHERE sender.customer_id = $1
          OR receiver.customer_id = $1
       ORDER BY t.created_at DESC`,
      [customerId]
    );

    return res.status(200).json({
      message: "Transactions retrieved successfully",
      transactions: result.rows,
    });
  } catch (error) {
    console.error("Get transactions error:", error);

    return res.status(500).json({
      message: "Failed to retrieve transactions",
      error: error.message,
    });
  }
};

module.exports = {
  transfer,
  getTransactionStatus,
  getTransactions,
};