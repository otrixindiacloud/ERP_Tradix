# Customer Creation Debug Guide

## Common Issues and Solutions

### 1. **Database Constraint Violations**

The most common cause is duplicate name or email constraints:

**Database Constraints:**
- `customers_name_unique` - Customer name must be unique
- `customers_email_unique` - Customer email must be unique (if provided)

**Error Messages:**
- `Customer with name "X" already exists`
- `Customer with email "X" already exists`

### 2. **Schema Validation Issues**

**Required Fields:**
- `name` (string, required)
- `customerType` (enum: "Retail" | "Wholesale")
- `classification` (enum: "Internal" | "Corporate" | "Individual" | "Family" | "Ministry")

**Optional Fields:**
- `email` (string, optional, must be valid email if provided)
- `phone` (string, optional)
- `address` (text, optional)
- `taxId` (string, optional)
- `creditLimit` (decimal, optional)
- `paymentTerms` (string, optional)
- `isActive` (boolean, defaults to true)

### 3. **Frontend Validation Issues**

**Client-side validation checks:**
- Name is required and not empty
- Email format validation (if provided)
- Credit limit must be a valid number (if provided)

### 4. **Backend Error Handling**

The backend returns different error codes:
- `400` - Invalid customer data (Zod validation errors)
- `409` - Duplicate customer (name or email already exists)
- `500` - Server error

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Try to create a customer
4. Look for error messages in the console

### Step 2: Check Network Tab
1. Open browser developer tools (F12)
2. Go to Network tab
3. Try to create a customer
4. Look for the POST request to `/api/customers`
5. Check the response status and error message

### Step 3: Check Server Logs
1. Look at the server console output
2. Look for "Error creating customer:" messages
3. Check for database connection issues

### Step 4: Test with Minimal Data
Try creating a customer with only required fields:
```json
{
  "name": "Test Customer",
  "customerType": "Retail",
  "classification": "Individual"
}
```

## Quick Fixes

### Fix 1: Clear Duplicate Data
If you're getting duplicate errors, check existing customers:
```sql
SELECT name, email FROM customers WHERE name = 'Your Customer Name';
SELECT name, email FROM customers WHERE email = 'your@email.com';
```

### Fix 2: Check Database Connection
Ensure the database is running and accessible.

### Fix 3: Validate Form Data
Make sure all required fields are filled and data types are correct.

## Common Error Scenarios

### Scenario 1: Duplicate Name
**Error:** `Customer with name "John Doe" already exists`
**Solution:** Use a different name or update the existing customer

### Scenario 2: Duplicate Email
**Error:** `Customer with email "john@example.com" already exists`
**Solution:** Use a different email or leave email field empty

### Scenario 3: Invalid Email Format
**Error:** `Invalid customer data`
**Solution:** Check email format (must be valid email address)

### Scenario 4: Missing Required Fields
**Error:** `Invalid customer data`
**Solution:** Ensure name, customerType, and classification are provided

### Scenario 5: Invalid Enum Values
**Error:** `Invalid customer data`
**Solution:** Use valid values:
- customerType: "Retail" or "Wholesale"
- classification: "Internal", "Corporate", "Individual", "Family", or "Ministry"

## Testing the Fix

1. **Test with valid data:**
   - Name: "Test Customer"
   - Email: "test@example.com"
   - Customer Type: "Retail"
   - Classification: "Individual"

2. **Test with duplicate data:**
   - Try creating the same customer twice
   - Should get duplicate error

3. **Test with invalid data:**
   - Try with invalid email format
   - Try with missing required fields
   - Should get validation error

## If Issues Persist

1. Check server logs for detailed error messages
2. Verify database connection
3. Check if all required database tables exist
4. Ensure proper permissions for database operations
5. Check if there are any database migration issues
