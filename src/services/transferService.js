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

const transferFunds = async (from, to, amount) => {
  const token = await getNIBSSToken();

  const response = await axios.post(
    `${NIBSS_BASE_URL}/api/transfer`,
    {
      from,
      to,
      amount,
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

module.exports = { transferFunds };