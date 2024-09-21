import React, { useState, useEffect } from 'react';
import axiosInstance from '../AxiosInstance';
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
  Alert
} from '@mui/material';

const AddInventory = () => {
  const [shopName, setShopName] = useState('');
  const [productName, setProductName] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const shopsResponse = await axiosInstance.get('/shops');
        const productsResponse = await axiosInstance.get('/products');
        setShops(shopsResponse.data);
        setProducts(productsResponse.data);
      } catch (error) {
        console.error('Error fetching shops or products:', error);
      }
    };

    fetchData();
  }, []);

  const handleProductChange = async (e) => {
    setProductName(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await axiosInstance.post('/inventories', {
        shop_name: shopName,
        product_name: productName,
        current_stock: currentStock
      });
      setSnackbarMessage('Inventory added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShopName('');
      setProductName('');
      setCurrentStock('');
    } catch (error) {
      console.error('Error adding inventory:', error);
      setSnackbarMessage('Error adding inventory');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container sx={{ marginTop: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Add Inventory
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Shop Name"
                  variant="outlined"
                  fullWidth
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                >
                  {shops.map((shop) => (
                    <MenuItem key={shop.shop_id} value={shop.shop_name}>
                      {shop.shop_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Product Name"
                  variant="outlined"
                  fullWidth
                  value={productName}
                  onChange={handleProductChange}
                  required
                >
                  {products.map((product) => (
                    <MenuItem key={product.product_id} value={product.product_name}>
                      {product.product_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Current Stock"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary">
                  Add Inventory
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddInventory;
