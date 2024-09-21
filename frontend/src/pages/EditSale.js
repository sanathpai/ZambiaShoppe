import React, { useState, useEffect } from 'react';
import axiosInstance from '../AxiosInstance';
import { Container, TextField, Button, MenuItem, Grid, Card, CardContent, Typography, Snackbar, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

const EditSale = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState([]);
  const [shops, setShops] = useState([]);
  const [offeringId, setOfferingId] = useState('');
  const [shopId, setShopId] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offeringsResponse = await axiosInstance.get('/productOfferings');
        const shopsResponse = await axiosInstance.get('/shops');
        const saleResponse = await axiosInstance.get(`/sales/${id}`);
        
        setOfferings(offeringsResponse.data);
        setShops(shopsResponse.data);
        
        const sale = saleResponse.data;
        setOfferingId(sale.offering_id);
        setShopId(sale.shop_id);
        setRetailPrice(sale.retail_price);
        setQuantity(sale.quantity);
        setSaleDate(sale.sale_date.split('T')[0]);
      } catch (error) {
        console.error('Error fetching data:', error);
        setSnackbarMessage('Error fetching data');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.put(`/sales/${id}`, {
        offering_id: offeringId,
        shop_id: shopId,
        retail_price: retailPrice,
        quantity: quantity,
        sale_date: saleDate,
      });
      setSnackbarMessage('Sale updated successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      navigate('/dashboard/sales/view'); // Redirect to view sales page after update
    } catch (error) {
      console.error('Error updating sale:', error);
      setSnackbarMessage('Error updating sale');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Container maxWidth="md">
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Edit Sale
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Offering"
                  variant="outlined"
                  fullWidth
                  value={offeringId || ''}
                  onChange={(e) => setOfferingId(e.target.value)}
                  required
                >
                  {offerings.map((offering) => (
                    <MenuItem key={offering.offering_id} value={offering.offering_id}>
                      {offering.product_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Shop"
                  variant="outlined"
                  fullWidth
                  value={shopId || ''}
                  onChange={(e) => setShopId(e.target.value)}
                  required
                >
                  {shops.map((shop) => (
                    <MenuItem key={shop.shop_id} value={shop.shop_id}>
                      {shop.shop_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Retail Price"
                  variant="outlined"
                  fullWidth
                  value={retailPrice || ''}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  required
                  type="number"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Quantity"
                  variant="outlined"
                  fullWidth
                  value={quantity || ''}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  type="number"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Sale Date"
                  variant="outlined"
                  fullWidth
                  value={saleDate || ''}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                  type="date"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary">
                  Update Sale
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EditSale;
