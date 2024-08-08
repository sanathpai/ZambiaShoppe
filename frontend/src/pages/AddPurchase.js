import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, TextField, Button, MenuItem, Grid, Card, CardContent, Typography, Snackbar, Alert } from '@mui/material';
import axiosInstance from '../AxiosInstance'; // Ensure this is your axios instance with authorization headers

const AddPurchase = () => {
  const [offerings, setOfferings] = useState([]);
  const [shops, setShops] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [unitTypes, setUnitTypes] = useState(['kg', 'lb', 'oz', 'g']);

  const [offeringId, setOfferingId] = useState('');
  const [shopName, setShopName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [marketName, setMarketName] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [selectedUnitType, setSelectedUnitType] = useState('');

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
        
        setOfferings(offeringsResponse.data);
        setShops(shopsResponse.data);
        setSuppliers(suppliersResponse.data);
        setMarkets(marketsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Find the selected supplier and market IDs based on the names
    const selectedSupplier = suppliers.find(supplier => supplier.name === supplierName);
    const selectedMarket = markets.find(market => market.market_name === marketName);
    const selectedOffering = offerings.find(offering => offering.offering_id === offeringId);
    const selectedShop = shops.find(shop => shop.shop_id === shopName);

    try {
      await axiosInstance.post('/purchases', {
        product_name: selectedOffering.product_name,
        shop_name: selectedShop.shop_name,
        supplier_id: selectedSupplier ? selectedSupplier.supplier_id : null,
        market_id: selectedMarket ? selectedMarket.market_id : null,
        order_price: orderPrice,
        quantity: quantity,
        purchase_date: purchaseDate,
        unit_type: selectedUnitType
      });
      setSnackbarMessage('Purchase added successfully!');
      setSnackbarSeverity('success');
      setOfferingId('');
      setShopName('');
      setSupplierName('');
      setMarketName('');
      setOrderPrice('');
      setQuantity('');
      setPurchaseDate('');
      setSelectedUnitType('');
    } catch (error) {
      console.error('Error adding purchase:', error);
      setSnackbarMessage('Error adding purchase');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  return (
    <Container maxWidth="md">
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Add Purchase
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Offering"
                  variant="outlined"
                  fullWidth
                  value={offeringId}
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
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
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
                  select
                  label="Supplier"
                  variant="outlined"
                  fullWidth
                  value={supplierName}
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
                  value={marketName}
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
                  value={orderPrice}
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
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  type="number"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Unit Type"
                  variant="outlined"
                  fullWidth
                  value={selectedUnitType}
                  onChange={(e) => setSelectedUnitType(e.target.value)}
                  required
                >
                  {unitTypes.map((unitType) => (
                    <MenuItem key={unitType} value={unitType}>
                      {unitType}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Purchase Date"
                  variant="outlined"
                  fullWidth
                  value={purchaseDate}
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
                  Add Purchase
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

export default AddPurchase;
