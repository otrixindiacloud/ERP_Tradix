# Quick Fix for Customer Creation Issues

## Immediate Solutions

### 1. **Check for Duplicate Data**
The most common issue is duplicate customer names or emails. Run this query to check:

```sql
-- Check for duplicate names
SELECT name, COUNT(*) as count 
FROM customers 
GROUP BY name 
HAVING COUNT(*) > 1;

-- Check for duplicate emails
SELECT email, COUNT(*) as count 
FROM customers 
WHERE email IS NOT NULL 
GROUP BY email 
HAVING COUNT(*) > 1;
```

### 2. **Clear Test Data**
If you have test data causing conflicts:

```sql
-- Delete test customers (be careful!)
DELETE FROM customers WHERE name LIKE '%Test%' OR name LIKE '%Debug%';
```

### 3. **Check Database Constraints**
Verify the unique constraints exist:

```sql
-- Check constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'customers'::regclass;
```

### 4. **Test with Minimal Data**
Try creating a customer with only required fields:

```json
{
  "name": "Test Customer " + Date.now(),
  "customerType": "Retail",
  "classification": "Individual"
}
```

## Common Error Messages and Solutions

### Error: "Customer with name 'X' already exists"
**Solution:** Use a different name or update the existing customer

### Error: "Customer with email 'X' already exists"  
**Solution:** Use a different email or leave email field empty

### Error: "Invalid customer data"
**Solution:** Check that all required fields are provided:
- `name` (required)
- `customerType` (required: "Retail" or "Wholesale")
- `classification` (required: "Internal", "Corporate", "Individual", "Family", or "Ministry")

### Error: "Failed to create customer" (500 error)
**Solution:** Check server logs for detailed error message

## Quick Test Steps

1. **Open browser developer tools (F12)**
2. **Go to Console tab**
3. **Try to create a customer**
4. **Check for error messages in console**
5. **Go to Network tab and check the POST request to /api/customers**
6. **Look at the response status and error message**

## If All Else Fails

1. **Restart the server**
2. **Check database connection**
3. **Verify all required tables exist**
4. **Check server logs for detailed error messages**

## Debug Tool

Use the debug tool at `/customer-debug` to run comprehensive diagnostics.
