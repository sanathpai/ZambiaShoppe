# Superuser Password Reset Tool for ZambiaShoppe

## What Professor Asked For

> "add a method to email a reset password link to an app superuser? Just in case we run into a situation where the respondent has not added an email but needs assistance in logging in?"

## How It Works

1. **Respondent contacts Professor** (WhatsApp/phone): "I forgot my password"
2. **Professor uses admin endpoint** to generate reset link for that user
3. **System emails ZambiaShoppe admin** the reset link (using existing email setup)
4. **Professor shares link** with respondent manually

## Email Configuration (Uses Your Existing Setup!)

**Good news: No additional email configuration needed!** 

The system automatically uses your existing ZambiaShoppe email infrastructure:
```bash
# Your existing .env setup already works:
EMAIL_RECEIVER=your-admin@zambiashoppe.com    # Gets the reset link notifications
EMAIL_USER=noreply@zambiashoppe.com           # Sends the emails
```

**That's it!** The password reset links will be sent to your existing `EMAIL_RECEIVER` address.

## Admin Endpoint (For Professor)

### Generate Reset Link for User
```
POST /api/admin/generate-password-reset
```

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "username": "respondent_username",
  "reason": "User contacted professor for password help"
}
```

**Response:**
```json
{
  "message": "Password reset link generated successfully",
  "resetURL": "https://frontend.shoppeappnow.com/reset-password/abc123...",
  "expiresIn": "1 hour",
  "sentTo": "admin@zambiashoppe.com",
  "userInfo": {
    "username": "respondent_username",
    "shopName": "User's Shop",
    "contact": "123456789"
  }
}
```

## Sample Email (Sent to EMAIL_RECEIVER)

```
To: admin@zambiashoppe.com
From: ZambiaShoppe Admin <noreply@zambiashoppe.com>
Subject: ZambiaShoppe - Password Reset Link Generated

User Information:
- Username: john_shop
- Shop Name: John's Electronics  
- Contact: +260771234567
- Email: No email address

Password Reset Link (Ready to Share):
https://frontend.shoppeappnow.com/reset-password/abc123...

⚠️ Action Required: Please contact this user and provide the password reset link above. 
Link expires in 1 hour.

Generated: 1/23/2025, 10:30:00 AM
ZambiaShoppe Admin System
```

## Usage Example

### Using curl (Terminal)
```bash
# 1. Get admin token first
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin_username", "password": "admin_password"}'

# 2. Generate reset link for user  
curl -X POST http://localhost:8000/api/admin/generate-password-reset \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "problematic_user", "reason": "User called for help"}'
```

## Typical Professor Workflow

```
📱 Respondent: "Professor, I forgot my password for ZambiaShoppe"
🔧 Professor: Uses admin tool to generate reset link for user
📧 ZambiaShoppe Admin: Receives email with reset link instantly  
💬 Professor: "Here's your reset link: https://frontend.shoppeappnow.com/reset-password/abc123"
✅ Respondent: Uses link to reset password
```

## Perfect for Research Context

- 🎯 **Zero additional setup** - uses existing email infrastructure
- 📊 **Admin oversight** for research integrity  
- 📧 **Familiar email addresses** - goes to your normal admin email
- 🔒 **Secure** - admin-only access
- ⚡ **Fast** - instant reset link generation
- 📝 **Audit trail** - all actions logged

## Security Features

- ✅ **Admin authentication required**
- ✅ **Reset links expire in 1 hour** 
- ✅ **Email notifications** to existing admin
- ✅ **Works for any user** (with or without email)
- ✅ **No frontend changes needed**
- ✅ **Uses existing ZambiaShoppe email infrastructure**

**Simple solution: Uses your existing ZambiaShoppe email setup - no extra configuration needed!** 🎯 