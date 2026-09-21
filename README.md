# Digital Banking System

A backend digital banking system built with Node.js, Express, and PostgreSQL.

## Features

- Customer registration
- BVN/NIN customer verification through the NIBSS By Phoenix test API
- Customer onboarding
- Bank account creation
- Maximum one account per customer
- Automatic initial account funding of N15,000
- Account name enquiry
- Account balance enquiry
- Intra-bank transfers
- Transaction reference generation
- Transaction status enquiry
- Transfer validation and error handling
- PostgreSQL database integration

## Technologies Used

- Node.js
- Express.js
- PostgreSQL
- NIBSS By Phoenix test API
- Postman
- Git and GitHub

## API Endpoints

### Customers

**Create customer**

`POST /customers`

**Get customer**

`GET /customers/:id`

**Update customer**

`PATCH /customers/:id`

**Delete customer**

`DELETE /customers/:id`

### Onboarding

**Verify customer with BVN or NIN**

`POST /onboarding`

### Accounts

**Create account**

`POST /accounts`

**Name enquiry**

`POST /name_enquiry`

**Check balance**

`GET /accounts/:account_number/balance`

### Transfers

**Intra-bank transfer**

`POST /transfers/intra-bank`

### Transactions

**Check transaction status**

`GET /transactions/:reference`

## Environment Variables

Create a `.env` file in the project root and add the required database and NIBSS configuration.

Do not commit the `.env` file to GitHub because it contains sensitive credentials.

## Running the Application

Start the server with:

```bash
node app.js

```

The server runs on:

```text
http://localhost:3000
```

## Testing

The API can be tested using Postman.

The NIBSS integration uses the test/sandbox environment provided for the assignment. No real banking transactions or real customer funds are involved.

## Database

The application uses PostgreSQL with the following main tables:

- `customers`
- `onboarding`
- `accounts`
- `transactions`

Database constraints are used to maintain data integrity, including unique customer emails, unique account numbers, and a maximum of one account per customer.

## Security

Sensitive environment variables such as database credentials are stored in `.env` and excluded from Git using `.gitignore`.

## Project Status

The core backend requirements for the digital banking assignment have been implemented and tested successfully.
