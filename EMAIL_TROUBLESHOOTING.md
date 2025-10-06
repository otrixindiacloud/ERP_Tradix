# Email Sending Troubleshooting Guide

## Quick Diagnosis

### 1. **Check Browser Console**
Open browser developer tools (F12) and look for error messages when trying to send emails.

### 2. **Test EmailJS Directly**
Visit `/email-debug` page to test EmailJS integration directly.

### 3. **Check Server Logs**
Look at the server console for any errors when preparing documents for email.

## Common Issues and Solutions

### Issue 1: "Failed to send email" - EmailJS Not Initialized
**Symptoms:** Console shows "emailjs is not defined" or similar errors
**Solution:**
1. Check if EmailJS script is loaded in `client/index.html`
2. Verify the script URL is correct
3. Check browser network tab for failed script loads

### Issue 2: "Template not found" Error
**Symptoms:** EmailJS returns template not found error
**Solution:**
1. The system now uses the default template `template_3i2972k`
2. Verify this template exists in your EmailJS dashboard
3. Check template ID in `client/src/lib/emailjs-config.ts`

### Issue 3: "Service not found" Error
**Symptoms:** EmailJS returns service not found error
**Solution:**
1. Verify service ID `service_b7vwpdh` exists in your EmailJS dashboard
2. Check if the service is active
3. Verify the service is connected to your email provider

### Issue 4: "Invalid public key" Error
**Symptoms:** EmailJS returns invalid public key error
**Solution:**
1. Verify public key `Py17HAlLnrbB4HGhw` is correct
2. Check if the key is active in your EmailJS dashboard
3. Ensure the key has proper permissions

### Issue 5: "Failed to prepare document" Error
**Symptoms:** Error occurs before EmailJS is called
**Solution:**
1. Check if the server is running (`npm run dev`)
2. Verify the API endpoint `/api/email/invoice/:id` is working
3. Check server logs for specific errors

## Step-by-Step Debugging

### Step 1: Test EmailJS Configuration
```javascript
// Open browser console and run:
console.log('EmailJS loaded:', typeof emailjs !== 'undefined');
console.log('EmailJS version:', emailjs.version);
```

### Step 2: Test EmailJS Service
```javascript
// Test if EmailJS can send a simple email:
emailjs.send('service_b7vwpdh', 'template_3i2972k', {
  to_email: 'test@example.com',
  to_name: 'Test User',
  from_name: 'Golden Tag WLL',
  subject: 'Test',
  message: 'Test message',
  reply_to: 'dheerajprajapat561@gmail.com'
}).then(console.log).catch(console.error);
```

### Step 3: Check API Endpoints
```bash
# Test if email API is working:
curl http://localhost:5000/api/email/health
```

### Step 4: Test Document Preparation
```bash
# Test invoice preparation (replace with real invoice ID):
curl -X POST http://localhost:5000/api/email/invoice/REAL_INVOICE_ID \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## EmailJS Dashboard Setup

### Required Templates
You need these templates in your EmailJS dashboard:

1. **Default Template** (`template_3i2972k`)
   - Subject: `{{subject}}`
   - Body: `Dear {{to_name}},\n\n{{message}}\n\nBest regards,\n{{from_name}}`

### Template Variables
Make sure your template includes these variables:
- `{{to_email}}` - Recipient email
- `{{to_name}}` - Recipient name
- `{{from_name}}` - Sender name
- `{{subject}}` - Email subject
- `{{message}}` - Email message
- `{{reply_to}}` - Reply-to email

## Testing Tools

### 1. EmailJS Test Page
Visit `/email-debug` to test EmailJS integration with detailed logging.

### 2. Standalone HTML Test
Open `test-emailjs.html` in your browser to test EmailJS independently.

### 3. API Test Script
Run `node test-email-api.js` to test the server-side email preparation.

## Common Error Messages

### "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
- **Cause:** Server returning HTML instead of JSON
- **Solution:** Check if server is running and routes are registered

### "Failed to prepare document"
- **Cause:** Server-side error in document preparation
- **Solution:** Check server logs and API endpoint

### "Template not found"
- **Cause:** EmailJS template doesn't exist
- **Solution:** Create template in EmailJS dashboard or use default template

### "Service not found"
- **Cause:** EmailJS service doesn't exist or is inactive
- **Solution:** Check service configuration in EmailJS dashboard

### "Invalid public key"
- **Cause:** EmailJS public key is incorrect or inactive
- **Solution:** Verify public key in EmailJS dashboard

## Quick Fixes

### Fix 1: Restart Everything
```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Restart server
npm run dev
```

### Fix 2: Clear Browser Cache
1. Open browser developer tools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### Fix 3: Check EmailJS Dashboard
1. Go to https://dashboard.emailjs.com/
2. Verify service `service_b7vwpdh` exists and is active
3. Verify template `template_3i2972k` exists
4. Check public key `Py17HAlLnrbB4HGhw` is active

### Fix 4: Test with Minimal Data
Try sending an email with just the required fields:
- Email address
- Document type
- Document number

## If All Else Fails

1. **Check server logs** for detailed error messages
2. **Test EmailJS independently** using the test page
3. **Verify EmailJS dashboard** configuration
4. **Check browser console** for JavaScript errors
5. **Test API endpoints** directly with curl or Postman

## Success Indicators

When everything is working correctly, you should see:
- ✅ "Email sent successfully!" message
- ✅ EmailJS response in console
- ✅ Email appears in recipient's inbox
- ✅ No errors in browser console or server logs
