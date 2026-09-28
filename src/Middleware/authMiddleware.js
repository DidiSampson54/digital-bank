
const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication token is required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.customer = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
};

module.exports = authenticate;

