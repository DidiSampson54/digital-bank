const pool = require("../config/database");

// Generate a unique 11-digit demo NIN
const generateDemoNin = async (req, res) => {
  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  try {
    const existingCustomer = await pool.query(
      `SELECT demo_nin
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (existingCustomer.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const existingNin = existingCustomer.rows[0].demo_nin;

    if (existingNin) {
      return res.status(200).json({
        message: "Demo NIN already exists",
        demo_nin: existingNin,
      });
    }

    let demoNin;
    let isUnique = false;

    while (!isUnique) {
      demoNin = Math.floor(
        10000000000 + Math.random() * 90000000000
      ).toString();

      const duplicateCheck = await pool.query(
        `SELECT id
         FROM customers
         WHERE demo_nin = $1`,
        [demoNin]
      );

      if (duplicateCheck.rows.length === 0) {
        isUnique = true;
      }
    }

    const result = await pool.query(
      `UPDATE customers
       SET demo_nin = $1
       WHERE id = $2
       RETURNING id, name, demo_nin`,
      [demoNin, customerId]
    );

    return res.status(201).json({
      message: "Demo NIN generated successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Demo NIN generation error:", error);

    return res.status(500).json({
      message: "Failed to generate demo NIN",
    });
  }
};


// Generate a unique 11-digit demo BVN
const generateDemoBvn = async (req, res) => {
  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  try {
    const existingCustomer = await pool.query(
      `SELECT demo_bvn
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (existingCustomer.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const existingBvn = existingCustomer.rows[0].demo_bvn;

    if (existingBvn) {
      return res.status(200).json({
        message: "Demo BVN already exists",
        demo_bvn: existingBvn,
      });
    }

    let demoBvn;
    let isUnique = false;

    while (!isUnique) {
      demoBvn = Math.floor(
        10000000000 + Math.random() * 90000000000
      ).toString();

      const duplicateCheck = await pool.query(
        `SELECT id
         FROM customers
         WHERE demo_bvn = $1`,
        [demoBvn]
      );

      if (duplicateCheck.rows.length === 0) {
        isUnique = true;
      }
    }

    const result = await pool.query(
      `UPDATE customers
       SET demo_bvn = $1
       WHERE id = $2
       RETURNING id, name, demo_bvn`,
      [demoBvn, customerId]
    );

    return res.status(201).json({
      message: "Demo BVN generated successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Demo BVN generation error:", error);

    return res.status(500).json({
      message: "Failed to generate demo BVN",
    });
  }
};

// GET LOGGED-IN CUSTOMER PROFILE
const getCustomerProfile = async (req, res) => {
  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c.address,
         c.demo_nin,
         c.demo_bvn,
         o.verification_dob
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT verification_dob
         FROM onboarding
         WHERE customer_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) o ON true
       WHERE c.id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      message: "Customer profile retrieved successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Customer profile error:",
      error
    );

    return res.status(500).json({
      message: "Failed to retrieve customer profile",
    });
  }
};


module.exports = {
  generateDemoNin,
  generateDemoBvn,
  getCustomerProfile,
};