import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { ContentCopy, Send } from '@mui/icons-material';
import axiosInstance from '../../AxiosInstance';

const PasswordResetTool = () => {
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleGenerateReset = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axiosInstance.post('/admin/generate-password-reset', {
        username: username.trim(),
        reason: reason.trim() || 'Admin-generated reset for user without email'
      });

      setResult(response.data);
      setUsername('');
      setReason('');
    } catch (error) {
      console.error('Error generating reset link:', error);
      setError(error.response?.data?.error || 'Failed to generate reset link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom color="primary">
          🔧 Password Reset Tool
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Generate password reset links for users who don't have email addresses.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box component="form" onSubmit={handleGenerateReset} sx={{ mb: 4 }}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            helperText="Enter the username of the user who needs password reset"
          />
          
          <TextField
            fullWidth
            label="Reason (Optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            margin="normal"
            multiline
            rows={2}
            helperText="Brief description of why this reset is needed"
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Send />}
            sx={{ mt: 3, mb: 2 }}
          >
            {loading ? 'Generating...' : 'Generate Reset Link'}
          </Button>
        </Box>

        {result && (
          <Paper elevation={1} sx={{ p: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Typography variant="h6" gutterBottom>
              ✅ Reset Link Generated Successfully!
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                User Information:
              </Typography>
              <Typography variant="body2">
                • Username: {result.userInfo.username}
              </Typography>
              <Typography variant="body2">
                • Shop: {result.userInfo.shopName || 'Not provided'}
              </Typography>
              <Typography variant="body2">
                • Contact: {result.userInfo.contact || 'Not provided'}
              </Typography>
              <Typography variant="body2">
                • Email on file: {result.userInfo.hasEmail ? 'Yes' : 'No'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Reset Link (expires in {result.expiresIn}):
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
                color: 'text.primary'
              }}>
                <TextField
                  fullWidth
                  value={result.resetURL}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  onClick={() => copyToClipboard(result.resetURL)}
                  sx={{ minWidth: 'auto' }}
                >
                  Copy
                </Button>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              📧 <strong>Email sent to:</strong> {result.sentTo}
              <br />
              ⏰ <strong>Link expires:</strong> {result.expiresIn}
              <br />
              💬 <strong>Next step:</strong> Contact the user and share this reset link
            </Alert>
          </Paper>
        )}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            📋 How to Use:
          </Typography>
          <Typography variant="body2" component="div">
            1. <strong>User contacts you:</strong> "I forgot my password and have no email"
            <br />
            2. <strong>Enter their username</strong> in the form above
            <br />
            3. <strong>Click "Generate Reset Link"</strong>
            <br />
            4. <strong>Copy the reset link</strong> and share it with the user
            <br />
            5. <strong>User clicks link</strong> and resets their password ✅
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PasswordResetTool; 