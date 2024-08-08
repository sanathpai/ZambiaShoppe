import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  MenuItem,
  Card,
  CardContent,
  Snackbar,
  Alert,
  FormControlLabel,
  Switch
} from '@mui/material';
import axiosInstance from '../AxiosInstance';

const AddUnit = () => {
  const [product_id, setProductId] = useState('');
  const [unit_size, setUnitSize] = useState('');
  const [buying_unit_type, setBuyingUnitType] = useState('');
  const [selling_unit_type, setSellingUnitType] = useState('');
  const [prepackaged, setPrepackaged] = useState(false);
  const [products, setProducts] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const unitTypes = ['kg', 'grams', 'lbs', 'ounces'];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axiosInstance.get('/products');
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/units', {
        product_id,
        unit_size,
        buying_unit_type,
        selling_unit_type,
        prepackaged,
      });
      setSnackbarMessage('Unit added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setProductId('');
      setUnitSize('');
      setBuyingUnitType('');
      setSellingUnitType('');
      setPrepackaged(false);
    } catch (error) {
      setSnackbarMessage('Error adding unit: ' + (error.response ? error.response.data.error : error.message));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Add Unit
        </Typography>
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Product"
                    variant="outlined"
                    fullWidth
                    value={product_id}
                    onChange={(e) => setProductId(e.target.value)}
                    required
                  >
                    {products.map((product) => (
                      <MenuItem key={product.product_id} value={product.product_id}>
                        {product.product_name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Unit Size"
                    variant="outlined"
                    fullWidth
                    value={unit_size}
                    onChange={(e) => setUnitSize(e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Buying Unit Type"
                    variant="outlined"
                    fullWidth
                    value={buying_unit_type}
                    onChange={(e) => setBuyingUnitType(e.target.value)}
                    required
                  >
                    {unitTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Selling Unit Type"
                    variant="outlined"
                    fullWidth
                    value={selling_unit_type}
                    onChange={(e) => setSellingUnitType(e.target.value)}
                    required
                  >
                    {unitTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={prepackaged}
                        onChange={(e) => setPrepackaged(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Prepackaged"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button type="submit" variant="contained" color="primary">
                    Add Unit
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Box>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddUnit;
