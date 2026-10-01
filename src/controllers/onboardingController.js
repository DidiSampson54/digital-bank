const axios = require("axios");
const pool = require("../config/database");

const verifyCustomer = async (req, res) => {
  const { bvn, nin, dob } = req.body;

  const customerId = req.user.customer_id;

  if (!customerId) {
    return res.status(401).json({
      message: "Authenticated customer not found",
    });
  }

  if (!bvn && !nin) {
    return res.status(400).json({
      message: "BVN or NIN is required",
    });
  }

  if (bvn && nin) {
    return res.status(400).json({
      message: "Please provide either BVN or NIN, not both",
    });
  }

  if (!dob) {
    return res.status(400).json({
      message: "Date of birth is required",
    });
  }

  try {
    const customerResult = await pool.query(
      `SELECT
         id,
         demo_nin,
         demo_bvn
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const customer = customerResult.rows[0];

    let verificationType;
    let verificationNumber;
    let isDemoIdentity = false;

    if (nin) {
      verificationType = "NIN";
      verificationNumber = nin;

      if (customer.demo_nin === nin) {
        isDemoIdentity = true;
      }
    }

    if (bvn) {
      verificationType = "BVN";
      verificationNumber = bvn;

      if (customer.demo_bvn === bvn) {
        isDemoIdentity = true;
      }
    }

    if (isDemoIdentity) {
      await pool.query(
        `INSERT INTO onboarding (
          customer_id,
          verification_type,
          verification_number,
          verification_dob,
          status,
          provider_reference,
          verified_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (customer_id)
        DO UPDATE SET
          verification_type = EXCLUDED.verification_type,
          verification_number = EXCLUDED.verification_number,
          verification_dob = EXCLUDED.verification_dob,
          status = EXCLUDED.status,
          provider_reference = EXCLUDED.provider_reference,
          verified_at = NOW()`,
        [
          customerId,
          verificationType,
          verificationNumber,
          dob,
          "VERIFIED",
          "PAYASAP-DEMO",
        ]
      );

      return res.status(200).json({
        message: "Demo customer verification successful",
        verification_type: verificationType,
        verification_number: verificationNumber,
        date_of_birth: dob,
        status: "VERIFIED",
        demo: true,
      });
    }

    let response;

    if (nin) {
      response = await axios.post(
        `${process.env.NIBSS_BASE_URL}/api/validateNin`,
        { nin }
      );
    }

    if (bvn) {
      response = await axios.post(
        `${process.env.NIBSS_BASE_URL}/api/validateBvn`,
        { bvn }
      );
    }

    const providerData = response.data;

    await pool.query(
      `INSERT INTO onboarding (
        customer_id,
        verification_type,
        verification_number,
        verification_dob,
        status,
        provider_reference,
        verified_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (customer_id)
      DO UPDATE SET
        verification_type = EXCLUDED.verification_type,
        verification_number = EXCLUDED.verification_number,
        verification_dob = EXCLUDED.verification_dob,
        status = EXCLUDED.status,
        provider_reference = EXCLUDED.provider_reference,
        verified_at = NOW()`,
      [
        customerId,
        verificationType,
        verificationNumber,
        dob,
        "VERIFIED",
        providerData?.reference ||
          providerData?.provider_reference ||
          providerData?.data?.reference ||
          providerData?.data?.provider_reference ||
          null,
      ]
    );

    return res.status(200).json({
      message: "Customer verification successful",
      data: providerData,
    });
  } catch (error) {
    console.error(
      "Customer verification error:",
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