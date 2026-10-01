
const axios = require("axios");

const NIBSS_BASE_URL = process.env.NIBSS_BASE_URL;

const getNIBSSToken = async () => {
  const response = await axios.post(
    `${NIBSS_BASE_URL}/api/auth/token`,
    {
      apiKey: process.env.NIBSS_API_KEY,
      apiSecret: process.env.NIBSS_API_SECRET,
    }
  );

  return response.data.token;
};

const transferFunds = async (
  from,
  to,
  bankCode,
  amount
) => {
  const token = await getNIBSSToken();

  console.log("NIBSS transfer values:", {
    from,
    to,
    bankCode,
    amount,
    amountType: typeof amount,
  });

  const response = await axios.post(
    `${NIBSS_BASE_URL}/api/transfer`,
    {
      from,
      to,
      amount: Number(amount),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

module.exports = {
  transferFunds,
};

