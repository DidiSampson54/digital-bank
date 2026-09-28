
const axios = require("axios");
const pool = require("../config/database");

const verifyCustomer = async (req, res) => {
  try {
    const { customer_id, bvn, nin } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        message: "Customer ID is required",
      });
    }

    if (!bvn && !nin) {
      return res.status(400).json({
        message: "BVN or NIN is required",
      });
    }

    if (bvn && nin) {
      return res.status(400).json({
        message: "Provide either BVN or NIN, not both",
      });
    }

    const customerId = Number(customer_id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        message: "Invalid customer ID",
      });
    }

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

    let response;
    let verificationType;
    let verificationNumber;
    let verificationDob;
    let providerReference;

    if (bvn) {
      response = await axios.post(
        `${process.env.NIBSS_BASE_URL}/api/validateBvn`,
        { bvn }
      );

      verificationType = "BVN";
      verificationNumber = bvn;
      verificationDob = response.data.data?.dob;
      providerReference = null;
    } else {
      response = await axios.post(
        `${process.env.NIBSS_BASE_URL}/api/validateNin`,
        { nin }
      );

      verificationType = "NIN";
      verificationNumber = nin;
      verificationDob = response.data.response?.dob;
      providerReference = response.data.response?._id || null;
    }

    if (!verificationDob) {
      return res.status(400).json({
        message: "Verification succeeded but date of birth was not provided",
      });
    }

    const existingOnboarding = await pool.query(
      `SELECT id
       FROM onboarding
       WHERE customer_id = $1`,
      [customerId]
    );

    if (existingOnboarding.rows.length > 0) {
      await pool.query(
        `UPDATE onboarding
         SET verification_type = $1,
             verification_number = $2,
             verification_dob = $3,
             status = $4,
             provider_reference = $5,
             verified_at = $6
         WHERE customer_id = $7`,
        [
          verificationType,
          verificationNumber,
          verificationDob,
          "VERIFIED",
          providerReference,
          new Date(),
          customerId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO onboarding
         (
           customer_id,
           verification_type,
           verification_number,
           verification_dob,
           status,
           provider_reference,
           verified_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customerId,
          verificationType,
          verificationNumber,
          verificationDob,
          "VERIFIED",
          providerReference,
          new Date(),
        ]
      );
    }

    return res.status(200).json({
      message: "Customer verification successful",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Verification error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 400).json({
      message: "Customer verification failed",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  verifyCustomer,
};

