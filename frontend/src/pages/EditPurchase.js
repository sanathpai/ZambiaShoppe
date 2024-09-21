import React, { useState, useEffect } from 'react';
import axiosInstance from '../AxiosInstance';
import { Container, TextField, Button, MenuItem, Grid, Card, CardContent, Typography, Snackbar, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

const EditPurchase = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState([]);
  const [shops, setShops] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [markets, setMarkets] = useState([]);
  
  const [offeringId, setOfferingId] = useState('');
  const [shopName, setShopName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [marketName, setMarketName] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offeringsResponse = await axiosInstance.get('/productOfferings');
        const shopsResponse = await axiosInstance.get('/shops');
        const suppliersResponse = await axiosInstance.get('/suppliers');
        const marketsResponse = await axiosInstance.get('/markets');
        const purchaseResponse = await axiosInstance.get(`/purchases/${id}`);

        setOfferings(offeringsResponse.data);
        setShops(shopsResponse.data);
        setSuppliers(suppliersResponse.data);
        setMarkets(marketsResponse.data);

        const purchase = purchaseResponse.data;
        setOfferingId(purchase.offering_id);
        setShopName(purchase.shop_name);
        setSupplierName(purchase.supplier_name);
        setMarketName(purchase.market_name);
        setOrderPrice(purchase.order_price);
        setQuantity(purchase.quantity);
        setPurchaseDate(purchase.purchase_date.split('T')[0]);
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
      await axiosInstance.put(`/purchases/${id}`, {
        offering_id: offeringId,
        shop_name: shopName,
        supplier_name: supplierName,
        market_name: marketName,
        order_price: orderPrice,
        quantity: quantity,
        purchase_date: purchaseDate,
      });
      setSnackbarMessage('Purchase updated successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      navigate('/dashboard/purchases/view'); // Redirect to view purchases page after update
    } catch (error) {
      console.error('Error updating purchase:', error);
      setSnackbarMessage('Error updating purchase');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Container maxWidth="md">
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Edit Purchase
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
                  value={shopName || ''}
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
                  label="Supplier"
                  variant="outlined"
                  fullWidth
                  value={supplierName || ''}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                >
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier.supplier_id} value={supplier.name}>
                      {supplier.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Market"
                  variant="outlined"
                  fullWidth
                  value={marketName || ''}
                  onChange={(e) => setMarketName(e.target.value)}
                  required
                >
                  {markets.map((market) => (
                    <MenuItem key={market.market_id} value={market.market_name}>
                      {market.market_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Order Price"
                  variant="outlined"
                  fullWidth
                  value={orderPrice || ''}
                  onChange={(e) => setOrderPrice(e.target.value)}
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
                  label="Purchase Date"
                  variant="outlined"
                  fullWidth
                  value={purchaseDate || ''}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  type="date"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary">
                  Update Purchase
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

export default EditPurchase;
