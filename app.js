require("dotenv").config(); 
 
const express = require("express"); 
 
const crypto = require("crypto"); 
 
const {Pool}=require("pg"); 
 
const app = express(); 
 
app.use(express.json()); 
 
const pool = new Pool ({ 
  user: process.env.DB_USER, 
  host: process.env.DB_HOST, 
  database: process.env.DB_NAME, 
  password: process.env.DB_PASSWORD, 
  port: Number(process.env.DB_PORT) 
}); 
 
 
//test database connection 
pool.query("SELECT NOW()", (error, result) => { 
if (error){ 
  console.log("Database connection failed:", error); 
} 
else { 
  console.log("Database connected:", result.rows[0]); 
}   
}); 
 
 
app.post("/customers", async (req, res) => { 
  const { name, email, phone, address } = req.body; 
 
  if (!name || !email || !phone || !address) { 
    return res.status(400).json({ 
      message: "Name, email, phone and address are required" 
    }); 
  } 
 
  if (!email.includes("@")) { 
    return res.status(400).json({ 
      message: "Please provide a valid email address" 
    }); 
  } 
 
  const result = await pool.query ( 
     `INSERT INTO customers (name, email, phone, address) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`, 
    [name, email, phone, address] 
  ); 
 
   res.status(201).json({ 
    message: "Customer created successfully", 
    customer: result.rows[0] 
  }); 
}); 
 
app.get("/customers/:id", async (req, res) => { 
  const id = Number(req.params.id); 
 
  const result = await pool.query( 
    "SELECT * FROM customers WHERE id = $1", 
    [id] 
  ); 
 
  if (result.rows.length === 0) { 
    return res.status(404).json({ 
      message: "Customer not found" 
    }); 
  } 
 
  res.status(200).json(result.rows[0]); 
}); 
 
 
app.patch("/customers/:id", async (req, res) => { 
  const id = Number(req.params.id); 
  const {name, email, phone, address} = req.body; 
 
 
const result = await pool.query ( 
  `UPDATE CUSTOMERS 
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
    message: "Customer not found" 
  }); 
} 
 
res.status(200).json({ 
  message: "Customer updated successfully", 
  customer: result.rows[0] 
}); 
}); 
 
app.delete("/customers/:id", async (req, res) => { 
const id= Number(req.params.id) 
 
 
const result = await pool.query ( 
  "DELETE FROM CUSTOMERS WHERE id = $1 RETURNING *", [id] 
); 
 
if (result.rows.length===0){ 
  return res.status(404).json( 
    { 
      message: "Customer not found" 
    }); 
} 
 
res.status(200).json( 
  { 
    message: "Customer deleted successfully", 
    customer: result.rows[0] 
  }); 
 
}); 
 

app.post("/onboarding", async (req, res) => { 
  const { 
    customer_id, 
    verification_type, 
    verification_number 
  } = req.body; 

  if (!customer_id || !verification_type || !verification_number) { 
    return res.status(400).json({ 
      message: "customer_id, verification_type and verification_number are required" 
    }); 
  } 
 
  const type = verification_type.toUpperCase(); 
 
  if (type !== "BVN" && type !== "NIN") { 
    return res.status(400).json({ 
      message: "verification_type must be BVN or NIN" 
    }); 
  } 
 
  try { 
    const endpoint = 
      type === "BVN" 
        ? "/api/validateBvn" 
        : "/api/validateNin"; 
 
    const field = 
      type === "BVN" 
        ? { bvn: verification_number } 
        : { nin: verification_number }; 
 
    const nibssResponse = await fetch( 
      `${process.env.NIBSS_BASE_URL}${endpoint}`, 
      { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json" 
        }, 
        body: JSON.stringify(field) 
      } 
    ); 
 
    const nibssData = await nibssResponse.json(); 
 
    if (!nibssResponse.ok) { 
      return res.status(nibssResponse.status).json({ 
        message: "Identity verification failed", 
        provider_response: nibssData 
      }); 
    } 
 
    const providerReference = 
      type === "BVN" 
        ? nibssData.data?.bvn 
        : nibssData.response?.nin; 
 
    const result = await pool.query(
  `INSERT INTO onboarding
   (customer_id, verification_type, status, provider_reference, verified_at)
   VALUES ($1, $2, 'VERIFIED', $3, CURRENT_TIMESTAMP)
   RETURNING *`,
  [
    customer_id,
    type,
    providerReference || null
  ]
);

 
    res.status(201).json({ 
      message: "Customer verified successfully", 
      onboarding: result.rows[0], 
      nibss_response: nibssData 
    }); 
  } catch (error) { 
    console.error("Onboarding error:", error); 
 
    res.status(500).json({ 
      message: "An error occurred during identity verification" 
    }); 
  } 
}); 


 
app.post("/accounts", async (req, res) => { 
const {customer_id}= req.body; 
 
if (!customer_id) { 
  return res.status(400).json({ 
message: "Customer ID is required" 
  }); 
} 
 
const onboarding = await pool.query ( 
  `SELECT * FROM onboarding 
  Where customer_id = $1 
  AND status = 'VERIFIED'`, 
  [customer_id] 
); 
 
if (onboarding.rows.length=== 0) { 
  return res.status(403).json({ 
message: "Customer must complete and pass onboarding before account creation" 
}); 
} 
 
const existingAccount = await pool.query( 
  "SELECT * FROM accounts WHERE customer_id = $1", 
  [customer_id] 
); 
 
if (existingAccount.rows.length > 0) { 
  return res.status(409).json({ 
    message: "Customer already has an account" 
  }); 
} 
 
const accountNumber = String( 
  Math.floor(1000000000 + Math.random() * 9000000000) 
); 
 
const result = await pool.query ( 
  `INSERT INTO accounts 
  (customer_id, account_number) 
  VALUES ($1, $2) 
  RETURNING *`, 
  [customer_id, accountNumber] 
); 
 
res.status(201).json({ 
  message: "Account created successfully", 
  account: result.rows[0] 
}); 
 
}); 
 
app.post("/name_enquiry", async (req, res) => { 
  const {account_number} = req.body; 
 
  if (!account_number) { 
    return res.status(400).json({ 
message: "Account number is required" 
 
    }); 
  } 
 
const result = await pool.query ( 
`SELECT 
a.account_number, 
c.name 
FROM accounts a 
JOIN customers c ON a.customer_id = c.id 
     WHERE a.account_number = $1`, 
     [account_number] 
); 
 
if (result.rows.length=== 0) { 
  return res.status(404).json({ 
message: "Account not found", 
  }); 
} 
 
res.status(200).json({ 
message: "Name enquiry successful", 
account: result.rows[0] 
}); 
}); 
 
app.get ("/accounts/:account_number/balance", async (req, res) => { 
  const {account_number} = req.params; 
 
 const result = await pool.query ( 
  `SELECT account_number, balance 
  FROM accounts 
  WHERE account_number = $1`, 
  [account_number] 
 ) 
  
 if (result.rows.length=== 0) { 
  return res.status(404).json({ 
    message: "Account not found" 
  }) 
 } 
 
 res.status(200).json({ 
  message: "Balance retrieved successfully", 
  account: result.rows[0] 
 }) 
}); 
 
app.post("/transfers/intra-bank", async (req, res) => { 
  const { 
    customer_id, 
    sender_account_number, 
    receiver_account_number, 
    amount, 
    narration 
  } = req.body; 
 
  if ( 
    !customer_id || 
    !sender_account_number || 
    !receiver_account_number || 
    !amount 
  ) { 
    return res.status(400).json({ 
      message: 
        "Customer ID, sender account, receiver account and amount are required" 
    }); 
  } 
 
  if (sender_account_number === receiver_account_number) { 
    return res.status(400).json({ 
      message: "Sender and receiver accounts must be different" 
    }); 
  } 
 
  if (Number(amount) <= 0) { 
    return res.status(400).json({ 
      message: "Transfer amount must be greater than zero" 
    }); 
  } 
 
  const client = await pool.connect(); 
 
  try { 
    await client.query("BEGIN"); 
 
    const senderResult = await client.query( 
      `SELECT id, customer_id, account_number, balance 
       FROM accounts 
       WHERE account_number = $1 
       FOR UPDATE`, 
      [sender_account_number] 
    ); 
 
    if (senderResult.rows.length === 0) { 
      await client.query("ROLLBACK"); 
 
      return res.status(404).json({ 
        message: "Sender account not found" 
      }); 
    } 
 
    const sender = senderResult.rows[0]; 
 
    if (sender.customer_id !== Number(customer_id)) { 
      await client.query("ROLLBACK"); 
 
      return res.status(403).json({ 
        message: "You are not authorized to use this account" 
      }); 
    } 
 
    const receiverResult = await client.query( 
      `SELECT id, account_number, balance 
       FROM accounts 
       WHERE account_number = $1 
       FOR UPDATE`, 
      [receiver_account_number] 
    ); 
 
    if (receiverResult.rows.length === 0) { 
      await client.query("ROLLBACK"); 
 
      return res.status(404).json({ 
        message: "Receiver account not found" 
      }); 
    } 
 
    const receiver = receiverResult.rows[0]; 
 
    const transferAmount = Number(amount); 
    const senderBalance = Number(sender.balance); 
 
    if (senderBalance < transferAmount) { 
      await client.query("ROLLBACK"); 
 
      return res.status(400).json({ 
        message: "Insufficient balance" 
      }); 
    } 
 
    const transactionReference = crypto.randomUUID(); 
 
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
      VALUES ($1, $2, $3, $4, $5, 'INTRA_BANK', 'SUCCESS', $6) 
      RETURNING *`, 
      [ 
        transactionReference, 
        sender.id, 
        receiver.id, 
        receiver.account_number, 
        transferAmount, 
        narration || null 
      ] 
    ); 
 
    await client.query("COMMIT"); 
 
    res.status(201).json({ 
      message: "Transfer successful", 
      transaction: transactionResult.rows[0] 
    }); 
 
  } catch (error) { 
    await client.query("ROLLBACK"); 
 
    console.error("Transfer failed:", error); 
 
    res.status(500).json({ 
      message: "Transfer failed" 
    }); 
 
  } finally { 
    client.release(); 
  } 
}); 
 
app.get("/transactions/:reference", async (req, res) => { 
  const { reference } = req.params; 
 
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
      message: "Transaction not found" 
    }); 
  } 
 
  res.status(200).json({ 
    message: "Transaction status retrieved successfully", 
    transaction: result.rows[0] 
  }); 
}); 
 
app.listen(3000, () => { 
  console.log("Server running on port 3000"); 
}); 
 
 
