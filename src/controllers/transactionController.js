
const pool = require("../config/database");

const getCustomerTransactions = async (req, res) => {
  const customerId = Number(req.params.customer_id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  try {
    const customerResult = await pool.query(
      `SELECT id
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const result = await pool.query(
      `SELECT
         t.transaction_reference,
         t.amount,
         t.transfer_type,
         t.status,
         t.narration,
         t.created_at,
         t.updated_at
       FROM transactions t
       JOIN accounts a
         ON t.sender_account_id = a.id
         OR t.receiver_account_id = a.id
       WHERE a.customer_id = $1
       ORDER BY t.created_at DESC`,
      [customerId]
    );

    return res.status(200).json({
      message: "Transaction history retrieved successfully",
      transactions: result.rows,
    });
  } catch (error) {
    console.error("Transaction history error:", error);

    return res.status(500).json({
      message: "Failed to retrieve transaction history",
    });
  }
};

const getTransactionStatus = async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({
      message: "Transaction reference is required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         transaction_reference,
         amount,
         transfer_type,
         status,
         narration,
         created_at,
         updated_at
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
      message: "Transaction status retrieved successfully",
      transaction: result.rows[0],
    });
  } catch (error) {
    console.error("Transaction status error:", error);

    return res.status(500).json({
      message: "Failed to retrieve transaction status",
    });
  }
};

module.exports = {
  getCustomerTransactions,
  getTransactionStatus,
};

