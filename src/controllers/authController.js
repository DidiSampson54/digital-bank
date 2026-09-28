
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const register = async (req, res) => {
  const { name, email, phone, address, password } = req.body;

  if (!name || !email || !phone || !address || !password) {
    return res.status(400).json({
      message: "Name, email, phone, address and password are required",
    });
  }

  try {
    const existingCustomer = await pool.query(
      `SELECT id
       FROM customers
       WHERE email = $1`,
      [email]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        message: "A customer with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO customers
       (name, email, phone, address, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, address, created_at`,
      [name, email, phone, address, passwordHash]
    );

    return res.status(201).json({
      message: "Customer registered successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Failed to register customer",
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM customers
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const customer = result.rows[0];

    if (!customer.password_hash) {
      return res.status(401).json({
        message:
          "This customer does not have a password yet. Please register again with a password.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      customer.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        customer_id: customer.id,
        email: customer.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Failed to login",
    });
  }
};

module.exports = {
  register,
  login,
};

