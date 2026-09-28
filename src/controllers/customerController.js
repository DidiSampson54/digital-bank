const pool = require("../config/database");

const createCustomer = async (req, res) => {
  const { name, email, phone, address } = req.body;

  if (!name || !email || !phone || !address) {
    return res.status(400).json({
      message: "Name, email, phone and address are required",
    });
  }

  if (!email.includes("@")) {
    return res.status(400).json({
      message: "Please provide a valid email address",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO customers (name, email, phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, phone, address]
    );

    res.status(201).json({
      message: "Customer created successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Create customer error:", error);

    res.status(500).json({
      message: "Failed to create customer",
    });
  }
};

const getCustomer = async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query(
      "SELECT * FROM customers WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Get customer error:", error);

    res.status(500).json({
      message: "Failed to retrieve customer",
    });
  }
};

const updateCustomer = async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, phone, address } = req.body;

  try {
    const result = await pool.query(
      `UPDATE customers
       SET name = $1,
           email = $2,
           phone = $3,
           address = $4
       WHERE id = $5
       RETURNING *`,
      [name, email, phone, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json({
      message: "Customer updated successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Update customer error:", error);

    res.status(500).json({
      message: "Failed to update customer",
    });
  }
};

const deleteCustomer = async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query(
      "DELETE FROM customers WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json({
      message: "Customer deleted successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Delete customer error:", error);

    res.status(500).json({
      message: "Failed to delete customer",
    });
  }
};

module.exports = {
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
};