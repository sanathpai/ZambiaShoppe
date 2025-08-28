import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
  RadioGroup,
  FormControl,
  Radio,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  InputLabel,
  Select,
  Paper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import axiosInstance from '../AxiosInstance';
import { useLocation, useNavigate } from 'react-router-dom';

const AddUnit = () => {
  const [product_id, setProductId] = useState('');
  const [buying_unit_type, setBuyingUnitType] = useState('');
  const [selling_unit_type, setSellingUnitType] = useState('');
  const [products, setProducts] = useState([]);
  const [existingUnits, setExistingUnits] = useState([]);
  const [productUnitTypes, setProductUnitTypes] = useState([]); // Store unit types for selected product only
  const [searchUnitTypes, setSearchUnitTypes] = useState([]); // Store unit types from all users for search functionality
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [newUnitType, setNewUnitType] = useState('');
  const [selectedExistingUnit, setSelectedExistingUnit] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [unitCategory, setUnitCategory] = useState('buying'); // Add state to handle buying or selling radio button
  const [addAnotherDialogOpen, setAddAnotherDialogOpen] = useState(false);
  const [fromProductFlow, setFromProductFlow] = useState(false);
  const [currentProductInfo, setCurrentProductInfo] = useState(null);
  const [firstTimeBuyingUnit, setFirstTimeBuyingUnit] = useState(''); // Track first buying unit name
  const [firstTimeSellingUnit, setFirstTimeSellingUnit] = useState(''); // Track first selling unit name
  
  // New state variables for pricing
  const [retailPrice, setRetailPrice] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [profitWarningOpen, setProfitWarningOpen] = useState(false);
  const [calculatedProfitMargin, setCalculatedProfitMargin] = useState(0);
  const [pendingFormData, setPendingFormData] = useState(null);

  // Search functionality states
  const [searchResults, setSearchResults] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [productName, setProductName] = useState('');
  const [productsLoading, setProductsLoading] = useState(false); // Set to false since we don't load all products

  // Refs for search functionality
  const justSelectedRef = useRef(false);
  const blurTimeoutRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Function to fetch all unit types for a product from all users (for search functionality)
  const fetchSearchUnitTypes = async (productName) => {
    try {
      console.log('🔍 FETCHING SEARCH UNIT TYPES for product:', productName);
      console.log('🔍 Making API call to:', `/units/search/product/${encodeURIComponent(productName)}`);
      
      const response = await axiosInstance.get(`/units/search/product/${encodeURIComponent(productName)}`);
      console.log('📡 Search units API response:', response.data);
      
      if (response.data.success) {
        // Filter out any null, undefined, or empty values to prevent Autocomplete errors
        const cleanUnitTypes = (response.data.unitTypes || [])
          .filter(unitType => unitType && typeof unitType === 'string' && unitType.trim() !== '');
        console.log('✅ SUCCESS: Setting searchUnitTypes to:', cleanUnitTypes);
        setSearchUnitTypes(cleanUnitTypes);
      } else {
        console.log('❌ API returned success=false');
        setSearchUnitTypes([]);
      }
    } catch (error) {
      console.error('💥 Error fetching search unit types:', error);
      console.error('💥 Error response:', error.response?.data);
      setSearchUnitTypes([]);
    }
  };

  // Remove the products loading useEffect entirely since we only use search now
  // useEffect(() => {
  //   const fetchProducts = async () => {
  //     try {
  //       setProductsLoading(true); // Set loading to true before fetching
  //       const response = await axiosInstance.get('/products');
  //       setProducts(response.data);
  //     } catch (error) {
  //       console.error('Error fetching products:', error);
  //     } finally {
  //       setProductsLoading(false); // Set loading to false after fetching
  //     }
  //   };

  //   fetchProducts();
  // }, []);

  // Search functionality for products when there are more than 5
  useEffect(() => {
    const updateSearchResults = async () => {
      // Enable search immediately without waiting for products.length check
      if (productName.length > 2 && isOnline && !justSelectedRef.current) {
        try {
          console.log(`🔍 Searching for products with query: "${productName}"`);
          const response = await axiosInstance.get(`/products/search?q=${productName}`);
          console.log('🔍 Raw search response:', response.data);
          
          const uniqueResults = response.data.reduce((acc, product) => {
            const key = `${product.product_name}-${product.variety || ''}-${product.brand || ''}`;
            if (!acc[key]) {
              acc[key] = product;
            }
            return acc;
          }, {});
          setSearchResults(Object.values(uniqueResults));
          console.log(`✅ Processed ${Object.values(uniqueResults).length} unique results`);
        } catch (error) {
          console.error('❌ Error fetching search results:', error);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
      
      // Reset the justSelected flag after the effect runs
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
      }
    };

    updateSearchResults();
  }, [productName, isOnline]); // Remove products.length dependency

  // Network status handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Clear any pending blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Get the product ID from query params if available
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const productIdFromParams = queryParams.get('product_id');
    const fromProduct = queryParams.get('from_product') === 'true';
    
    if (productIdFromParams) {
      // Fetch the specific product to validate and set the product name
      const fetchProductById = async () => {
        try {
          const response = await axiosInstance.get(`/products/${productIdFromParams}`);
          const product = response.data;
          setProductId(productIdFromParams);
          setProductName(formatProductDisplay(product));
        } catch (error) {
          console.warn('⚠️ Product ID from URL does not exist:', productIdFromParams);
        }
      };
      fetchProductById();
    }
    if (fromProduct) {
      setFromProductFlow(true);
    }
  }, [location]); // Remove products dependency

  // Handle product selection for searchable field
  const handleSelectProduct = (product) => {
    console.log('🔍 handleSelectProduct called with:', product);
    
    // Clear any pending blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    
    justSelectedRef.current = true; // Set flag to prevent immediate search
    
    // Check if product has the expected fields
    console.log('📦 Product object structure:', Object.keys(product));
    console.log('🔑 Product ID:', product.product_id);
    
    const productId = product.product_id;
    
    if (!productId) {
      console.error('❌ Product missing ID field:', product);
      setSnackbarMessage('Error: Product selection failed - missing ID');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Set the product ID and name
    setProductId(productId.toString());
    setProductName(formatProductDisplay(product));
    
    // Clear search results
    setSearchResults([]);
  };

  // Handle product name change for searchable field
  const handleProductNameChange = (value) => {
    setProductName(value);
    // Clear product_id if user is typing a new search
    if (product_id) {
      setProductId('');
    }
  };

  // Handle blur for searchable field
  const handleProductNameBlur = () => {
    // Clear search results after a small delay to allow clicking on results
    blurTimeoutRef.current = setTimeout(() => {
      setSearchResults([]);
    }, 150);
  };

  // Handle focus for searchable field
  const handleProductNameFocus = () => {
    // Clear any pending blur timeout when field gets focus again
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  // Render product selection component based on product count
  const renderProductSelection = () => {
    // Show loading state while products are being fetched
    if (productsLoading) {
      return (
        <TextField
          label="Loading products..."
          variant="outlined"
          fullWidth
          disabled
          helperText="Please wait while products are being loaded..."
        />
      );
    }

    // Always show searchable field once products are loaded
    return (
      <Box>
        <TextField
          label="Select Product"
          variant="outlined"
          fullWidth
          value={productName}
          onChange={(e) => handleProductNameChange(e.target.value)}
          onBlur={handleProductNameBlur}
          onFocus={handleProductNameFocus}
          required
          helperText="Start typing to search products..."
        />
        <List>
          {searchResults.map((product, resultIndex) => (
            <ListItem 
              button 
              key={resultIndex} 
              onClick={() => handleSelectProduct(product)}
            >
              <ListItemText 
                primary={product.product_name}
                secondary={`${product.brand ? `Brand: ${product.brand}` : 'No brand'}${product.variety ? ` | Variety: ${product.variety}` : ' | No variety'}${product.size ? ` | Size: ${product.size}` : ''}`}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  // Fetch units based on the selected product
  useEffect(() => {
    // Only proceed if we have a product_id
    if (product_id) {
      const fetchUnits = async () => {
        try {
          // Fetch the selected product to get its details
          const productResponse = await axiosInstance.get(`/products/${product_id}`);
          const selectedProduct = productResponse.data;
          
          console.log('🎯 SELECTED PRODUCT:', selectedProduct);
          console.log('🔍 SEARCHING FOR UNITS with product name:', selectedProduct.product_name);
          
          // Fetch search unit types from all users for this product (for autocomplete suggestions)
          await fetchSearchUnitTypes(selectedProduct.product_name);
          
          // Fetch units for this specific product
          const unitsResponse = await axiosInstance.get(`/units/product/${product_id}`);
          const specificProductUnits = unitsResponse.data;
          
          setExistingUnits(specificProductUnits);
          
          // Extract unique unit types for this product
          const uniqueUnitTypes = [...new Set(specificProductUnits.map(unit => unit.unit_type))];
          setProductUnitTypes(uniqueUnitTypes);

          // Check if units already exist for this specific product
          if (specificProductUnits.length > 0) {
            setIsAddingNewUnit(true); // This means there are existing units, so show the new unit form
          } else {
            setIsAddingNewUnit(false); // No existing units, show the full form for adding both buying and selling units
          }
        } catch (error) {
          console.error('Error fetching product or units:', error);
          // Clear unit types when product not found
          setSearchUnitTypes([]);
          setProductUnitTypes([]);
          setExistingUnits([]);
        }
      };
      fetchUnits();
    } else {
      // Clear unit types when no product is selected
      setProductUnitTypes([]);
      setSearchUnitTypes([]);
      setExistingUnits([]);
    }
  }, [product_id]); // Remove products dependency

  // Calculate profit margin when relevant values change
  useEffect(() => {
    if (retailPrice && orderPrice && conversionRate) {
      const margin = calculateProfitMargin(retailPrice, orderPrice, conversionRate);
      setCalculatedProfitMargin(margin || 0);
    } else {
      setCalculatedProfitMargin(0);
    }
  }, [retailPrice, orderPrice, conversionRate]);

  // Debug: Log when searchUnitTypes changes
  useEffect(() => {
    console.log('🎯 SEARCH UNIT TYPES UPDATED:', searchUnitTypes);
    console.log('🎯 Length:', searchUnitTypes.length);
  }, [searchUnitTypes]);

  // Function to calculate profit margin
  const calculateProfitMargin = (retailPriceValue, orderPriceValue, conversionRateValue) => {
    const retail = parseFloat(retailPriceValue);
    const order = parseFloat(orderPriceValue);
    const conversion = parseFloat(conversionRateValue);
    
    if (isNaN(retail) || isNaN(order) || isNaN(conversion) || conversion === 0 || order === 0) {
      return null;
    }
    
    // Cost per selling unit = Order Price / Conversion Rate
    const costPerSellingUnit = order / conversion;
    
    // Profit margin = (Retail Price - Cost per selling unit) / Cost per selling unit
    const profitMargin = (retail - costPerSellingUnit) / costPerSellingUnit;
    
    return profitMargin;
  };

  // Helper function to format product display with brand
  const formatProductDisplay = (product) => {
    let display = product.product_name;
    
    // Add brand in parentheses
    if (product.brand) {
      display += ` (${product.brand})`;
    } else {
      display += ` (No Brand)`;
    }
    
    // Add variety with dash if it exists
    if (product.variety) {
      display += ` - ${product.variety}`;
    }
    
    return display;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if ((!isAddingNewUnit && (!buying_unit_type || !selling_unit_type)) || !conversionRate) {
      setSnackbarMessage('Please enter all required fields');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // For the first-time unit addition, validate pricing if both prices are provided
    if (!isAddingNewUnit && retailPrice && orderPrice && conversionRate) {
      const profitMargin = calculateProfitMargin(retailPrice, orderPrice, conversionRate);
      
      if (profitMargin !== null && (profitMargin < 0 || profitMargin > 1)) {
        // Store form data and show warning dialog
        const unitData = {
          product_id,
          buying_unit_type,
          selling_unit_type,
          conversion_rate: conversionRate,
          retail_price: retailPrice,
          order_price: orderPrice
        };
        setPendingFormData(unitData);
        setCalculatedProfitMargin(profitMargin);
        setProfitWarningOpen(true);
        return;
      }
    }

    // For adding new units, validate pricing if both prices are provided
    if (isAddingNewUnit && retailPrice && orderPrice && conversionRate) {
      const profitMargin = calculateProfitMargin(retailPrice, orderPrice, conversionRate);
      
      if (profitMargin !== null && (profitMargin < 0 || profitMargin > 1)) {
        // Store form data and show warning dialog
        const unitData = {
          product_id,
          newUnitType,
          selectedExistingUnit,
          conversion_rate: conversionRate,
          unitCategory,
          retail_price: retailPrice,
          order_price: orderPrice
        };
        setPendingFormData(unitData);
        setCalculatedProfitMargin(profitMargin);
        setProfitWarningOpen(true);
        return;
      }
    }

    // Proceed with form submission
    await submitForm();
  };

  const submitForm = async (formData = null) => {
    try {
      // Construct unit data based on whether it's the first time adding or adding a new unit
      let unitData;
      
      if (formData) {
        // Use provided form data (from warning dialog)
        unitData = formData;
        
        // If this is first-time creation from warning dialog, store the unit names
        if (!isAddingNewUnit && formData.buying_unit_type && formData.selling_unit_type) {
          setFirstTimeBuyingUnit(formData.buying_unit_type);
          setFirstTimeSellingUnit(formData.selling_unit_type);
        }
      } else if (isAddingNewUnit) {
        // Subsequent unit addition - send data for adding one new unit
        unitData = {
          product_id,
          newUnitType,
          selectedExistingUnit,
          conversion_rate: conversionRate,
          unitCategory, // This is required for subsequent additions
          prepackaged: false, // Add missing prepackaged field
          retail_price: retailPrice || '', // Always send these fields
          order_price: orderPrice || ''     // Always send these fields
        };
      } else {
        // First-time unit creation - send data for creating both buying and selling units
        unitData = {
          product_id,
          buying_unit_type,
          selling_unit_type,
          conversion_rate: conversionRate,
          prepackaged_b: false, // Add missing prepackaged field for buying unit
          prepackaged: false,   // Add missing prepackaged field for selling unit
          retail_price: retailPrice || '', // Always send retail_price for selling unit
          order_price: orderPrice || ''    // Always send order_price for buying unit
          // Note: Don't send unitCategory for first-time creation
        };
        
        // Store the first-time unit names for the dialog
        setFirstTimeBuyingUnit(buying_unit_type);
        setFirstTimeSellingUnit(selling_unit_type);
      }

      // Send the data to the backend
      await axiosInstance.post('/units', unitData);
      
      // Show success message
      setSnackbarMessage('Unit added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // If coming from product flow, handle the next step
      if (fromProductFlow) {
        try {
          const productResponse = await axiosInstance.get(`/products/${product_id}`);
          const selectedProduct = productResponse.data;
          setCurrentProductInfo(selectedProduct);
          
          // Always show the dialog when coming from product flow (both first time and subsequent)
          setAddAnotherDialogOpen(true);
        } catch (error) {
          console.error('Error fetching product for dialog:', error);
          // Show dialog anyway
          setAddAnotherDialogOpen(true);
        }
      } else {
        // Reset the form fields for regular flow
        resetForm();
      }
    } catch (error) {
      console.error('Error adding unit:', error);
      // Show error message
      setSnackbarMessage('Error adding unit: ' + (error.response ? error.response.data.error : error.message));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const resetForm = () => {
    setProductId('');
    setBuyingUnitType('');
    setSellingUnitType('');
    setNewUnitType('');
    setSelectedExistingUnit('');
    setConversionRate('');
    setRetailPrice('');
    setOrderPrice('');
    setUnitCategory('buying');
    setCalculatedProfitMargin(0);
    setPendingFormData(null);
    setFirstTimeBuyingUnit('');
    setFirstTimeSellingUnit('');
  };

  const handleAddAnotherUnit = () => {
    setAddAnotherDialogOpen(false);
    // Reset only the unit-related fields, keep the product_id
    setBuyingUnitType('');
    setSellingUnitType('');
    setNewUnitType('');
    setSelectedExistingUnit('');
    setConversionRate('');
    setUnitCategory('buying');
    setRetailPrice('');
    setOrderPrice('');
    setCalculatedProfitMargin(0);
    setPendingFormData(null);
    
    // Refresh the units data for the current product without reloading the page
    if (product_id) {
      const fetchUnits = async () => {
        try {
          // Fetch the selected product to get its details
          const productResponse = await axiosInstance.get(`/products/${product_id}`);
          const selectedProduct = productResponse.data;
          
          if (selectedProduct) {
            // Fetch search unit types from all users for this product (for autocomplete suggestions)
            await fetchSearchUnitTypes(selectedProduct.product_name);
            
            // Fetch units for this specific product
            const unitsResponse = await axiosInstance.get(`/units/product/${product_id}`);
            const specificProductUnits = unitsResponse.data;
            
            setExistingUnits(specificProductUnits);
            
            // Extract unique unit types for this product
            const uniqueUnitTypes = [...new Set(specificProductUnits.map(unit => unit.unit_type))];
            setProductUnitTypes(uniqueUnitTypes);

            // Since we now have existing units, set to adding new unit mode
            setIsAddingNewUnit(true);
          }
        } catch (error) {
          console.error('Error fetching units:', error);
        }
      };
      fetchUnits();
    }
  };

  const handleFinishAddingUnits = async () => {
    setAddAnotherDialogOpen(false);
    // Fetch the selected product to get its details for navigation
    try {
      const productResponse = await axiosInstance.get(`/products/${product_id}`);
      const selectedProduct = productResponse.data;
      if (selectedProduct) {
        navigate(`/dashboard/inventories/stock-entry?product_id=${selectedProduct.product_id}&product_name=${encodeURIComponent(selectedProduct.product_name)}&variety=${encodeURIComponent(selectedProduct.variety || '')}`);
      }
    } catch (error) {
      console.error('Error fetching product for navigation:', error);
      // Navigate anyway with just the product_id
      navigate(`/dashboard/inventories/stock-entry?product_id=${product_id}`);
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
          {isAddingNewUnit ? 'Add New Unit' : 'Add Unit'}
        </Typography>
        <Card>
          <CardContent>
            <form onSubmit={handleFormSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  {renderProductSelection()}
                </Grid>
                {product_id && (
                  <>
                    {!isAddingNewUnit ? (
                      <>
                        <Grid item xs={12}>
                          <Typography variant="subtitle1">Buying Information</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Autocomplete
                            freeSolo
                            options={Array.isArray(searchUnitTypes) ? searchUnitTypes : []}
                            value={buying_unit_type}
                            onChange={(event, newValue) => {
                              setBuyingUnitType(newValue || '');
                            }}
                            onInputChange={(event, newInputValue) => {
                              setBuyingUnitType(newInputValue);
                            }}
                            onOpen={() => {
                              console.log('Autocomplete onOpen: Buying Unit Type');
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Buying Unit Type"
                                variant="outlined"
                                fullWidth
                                required
                                helperText="Search from all buying and selling units used by any user for this product"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Current Order Price of Buying Unit"
                            variant="outlined"
                            fullWidth
                            type="number"
                            inputProps={{ step: "0.01", min: "0" }}
                            value={orderPrice}
                            onChange={(e) => setOrderPrice(e.target.value)}
                            helperText={`Price per ${buying_unit_type || 'buying unit'}`}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle1">Selling Information</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Autocomplete
                            freeSolo
                            options={Array.isArray(searchUnitTypes) ? searchUnitTypes : []}
                            value={selling_unit_type}
                            onChange={(event, newValue) => {
                              setSellingUnitType(newValue || '');
                            }}
                            onInputChange={(event, newInputValue) => {
                              setSellingUnitType(newInputValue);
                            }}
                            onOpen={() => {
                              console.log('Autocomplete onOpen: Selling Unit Type');
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Selling Unit Type"
                                variant="outlined"
                                fullWidth
                                required
                                helperText="Search from all buying and selling units used by any user for this product"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Current Retail Price of Selling Unit"
                            variant="outlined"
                            fullWidth
                            type="number"
                            inputProps={{ step: "0.01", min: "0" }}
                            value={retailPrice}
                            onChange={(e) => setRetailPrice(e.target.value)}
                            helperText={`Price per ${selling_unit_type || 'selling unit'}`}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label={`Please Enter How many ${selling_unit_type || 'second unit type'} are there in ${buying_unit_type || 'first unit type'}?`}
                            variant="outlined"
                            fullWidth
                            InputLabelProps={{
                              style: {
                                whiteSpace: 'normal',
                                fontSize: '0.875rem', // Reduce the font size to fit the placeholder
                              },
                            }}
                            value={conversionRate}
                            onChange={(e) => setConversionRate(e.target.value)}
                            required
                          />
                        </Grid>
                        {/* Real-time Profit Margin Display */}
                        {retailPrice && orderPrice && conversionRate && (
                          <Grid item xs={12}>
                            <Box sx={{ 
                              p: 2, 
                              bgcolor: calculatedProfitMargin !== null && (calculatedProfitMargin < 0 || calculatedProfitMargin > 1) ? 'warning.light' : 'info.light',
                              borderRadius: 1,
                              border: 1,
                              borderColor: calculatedProfitMargin !== null && (calculatedProfitMargin < 0 || calculatedProfitMargin > 1) ? 'warning.main' : 'info.main'
                            }}>
                              <Typography variant="subtitle2" gutterBottom>
                                <strong>Profit Margin Calculation:</strong>
                              </Typography>
                              <Typography variant="body2">
                                Cost per {selling_unit_type || 'selling unit'}: {orderPrice && conversionRate ? (parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                Profit per {selling_unit_type || 'selling unit'}: {retailPrice && orderPrice && conversionRate ? (parseFloat(retailPrice) - parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                Profit Margin: {calculatedProfitMargin !== null ? `${(calculatedProfitMargin * 100).toFixed(1)}%` : 'N/A'}
                              </Typography>
                              {calculatedProfitMargin !== null && calculatedProfitMargin < 0 && (
                                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                                  ⚠️ This results in a loss
                                </Typography>
                              )}
                              {calculatedProfitMargin !== null && calculatedProfitMargin > 1 && (
                                <Typography variant="body2" color="warning.dark" sx={{ mt: 1 }}>
                                  ⚠️ Profit margin seems unusually high
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                        )}
                      </>
                    ) : (
                      <>
                        <Grid item xs={12}>
                          <Autocomplete
                            freeSolo
                            options={Array.isArray(searchUnitTypes) ? searchUnitTypes : []}
                            value={newUnitType}
                            onChange={(event, newValue) => {
                              setNewUnitType(newValue || '');
                            }}
                            onInputChange={(event, newInputValue) => {
                              setNewUnitType(newInputValue);
                            }}
                            onOpen={() => {
                              console.log('Autocomplete onOpen: New Unit Type');
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="New Unit Type"
                                variant="outlined"
                                fullWidth
                                required
                                helperText="Search from all buying and selling units used by any user for this product"
                              />
                            )}
                          />
                        </Grid>
                        {/* Radio Button for Buying or Selling Unit */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle1">Is the New Unit Buying or Selling?</Typography>
                          <FormControl component="fieldset">
                            <RadioGroup
                              row
                              value={unitCategory}
                              onChange={(e) => {
                                setUnitCategory(e.target.value);
                              }}
                            >
                              <FormControlLabel value="buying" control={<Radio />} label="Buying" />
                              <FormControlLabel value="selling" control={<Radio />} label="Selling" />
                            </RadioGroup>
                          </FormControl>
                        </Grid>
                        {/* Prepackaged Toggle for the New Unit */}
                        {/* <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={prepackaged}
                                onChange={(e) => setPrepackaged(e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Prepackaged (New Unit)"
                          />
                        </Grid> */}
                        <Grid item xs={12}>
                          <TextField
                            label={unitCategory === 'buying' ? "Current Order Price of New Unit" : "Current Retail Price of New Unit"}
                            variant="outlined"
                            fullWidth
                            type="number"
                            inputProps={{ step: "0.01", min: "0" }}
                            value={unitCategory === 'buying' ? orderPrice : retailPrice}
                            onChange={(e) => {
                              if (unitCategory === 'buying') {
                                setOrderPrice(e.target.value);
                              } else {
                                setRetailPrice(e.target.value);
                              }
                            }}
                            helperText={`Price per ${newUnitType || 'new unit'}`}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            select
                            label="Select Existing Unit for Comparison"
                            variant="outlined"
                            fullWidth
                            value={selectedExistingUnit}
                            onChange={(e) => setSelectedExistingUnit(e.target.value)}
                            required
                          >
                            {existingUnits.map((unit) => (
                              <MenuItem key={unit.unit_id} value={unit.unit_id}>
                                {unit.unit_type} ({unit.unit_category})
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12}>
                          {/* <TextField
                            label={unitCategory === 'buying' ? "Current Retail Price of Existing Selling Unit" : "Current Order Price of Existing Buying Unit"}
                            variant="outlined"
                            fullWidth
                            type="number"
                            inputProps={{ step: "0.01", min: "0" }}
                            value={unitCategory === 'buying' ? retailPrice : orderPrice}
                            onChange={(e) => {
                              if (unitCategory === 'buying') {
                                setRetailPrice(e.target.value);
                              } else {
                                setOrderPrice(e.target.value);
                              } 
                            }}
                            helperText={`Price per ${existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_type || 'selected unit'}`}
                          /> */}
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label={`Please Enter How many ${existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_type || 'selected unit type'} are there in ${newUnitType || 'new unit type'}?`}
                            variant="outlined"
                            fullWidth
                            InputLabelProps={{
                              style: {
                                whiteSpace: 'normal',
                                fontSize: '0.875rem', // Reduce the font size to fit the placeholder
                              },
                            }}
                            value={conversionRate}
                            onChange={(e) => setConversionRate(e.target.value)}
                            required
                          />
                        </Grid>
                        {/* Real-time Profit Margin Display for New Unit */}
                        {retailPrice && orderPrice && conversionRate && newUnitType && selectedExistingUnit && (
                          <Grid item xs={12}>
                            <Box sx={{ 
                              p: 2, 
                              bgcolor: calculatedProfitMargin !== null && (calculatedProfitMargin < 0 || calculatedProfitMargin > 1) ? 'warning.light' : 'info.light',
                              borderRadius: 1,
                              border: 1,
                              borderColor: calculatedProfitMargin !== null && (calculatedProfitMargin < 0 || calculatedProfitMargin > 1) ? 'warning.main' : 'info.main'
                            }}>
                              <Typography variant="subtitle2" gutterBottom>
                                <strong>Profit Margin Calculation:</strong>
                              </Typography>
                              <Typography variant="body2">
                                {unitCategory === 'buying' 
                                  ? `Cost per ${existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_type || 'selling unit'}: ${retailPrice && conversionRate ? (parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}`
                                  : `Cost per ${newUnitType}: ${orderPrice && conversionRate ? (parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}`
                                }
                              </Typography>
                              <Typography variant="body2">
                                {unitCategory === 'buying'
                                  ? `Profit per ${existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_type || 'selling unit'}: ${retailPrice && orderPrice && conversionRate ? (parseFloat(retailPrice) - parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}`
                                  : `Profit per ${newUnitType}: ${retailPrice && orderPrice && conversionRate ? (parseFloat(retailPrice) - parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}`
                                }
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                Profit Margin: {calculatedProfitMargin !== null ? `${(calculatedProfitMargin * 100).toFixed(1)}%` : 'N/A'}
                              </Typography>
                              {calculatedProfitMargin !== null && calculatedProfitMargin < 0 && (
                                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                                  ⚠️ This results in a loss
                                </Typography>
                              )}
                              {calculatedProfitMargin !== null && calculatedProfitMargin > 1 && (
                                <Typography variant="body2" color="warning.dark" sx={{ mt: 1 }}>
                                  ⚠️ Profit margin seems unusually high
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                        )}
                      </>
                    )}
                  </>
                )}
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

      {/* Profit Margin Warning Dialog */}
      <Dialog open={profitWarningOpen} onClose={() => setProfitWarningOpen(false)}>
        <DialogTitle>Profit Margin Warning</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {calculatedProfitMargin < 0 
              ? `The current pricing results in a loss of ${Math.abs(calculatedProfitMargin * 100).toFixed(1)}% per unit sold.`
              : `The current pricing results in a profit margin of ${(calculatedProfitMargin * 100).toFixed(1)}%, which seems unusually high.`
            }
            <br /><br />
            <strong>Current Calculation:</strong><br />
            {isAddingNewUnit ? (
              <>
                New Unit Type: {newUnitType} ({unitCategory})<br />
                Existing Unit: {existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_type} ({existingUnits.find(unit => unit.unit_id === selectedExistingUnit)?.unit_category})<br />
                {unitCategory === 'buying' ? 'Order' : 'Retail'} Price (New Unit): {unitCategory === 'buying' ? orderPrice : retailPrice}<br />
                {unitCategory === 'buying' ? 'Retail' : 'Order'} Price (Existing Unit): {unitCategory === 'buying' ? retailPrice : orderPrice}<br />
              </>
            ) : (
              <>
                Retail Price: {retailPrice}<br />
                Order Price: {orderPrice}<br />
              </>
            )}
            Conversion Rate: {conversionRate}<br />
            Cost per Selling Unit: {orderPrice && conversionRate ? (parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}<br />
            Profit per Unit: {retailPrice && orderPrice && conversionRate ? (parseFloat(retailPrice) - parseFloat(orderPrice) / parseFloat(conversionRate)).toFixed(2) : 'N/A'}
            <br /><br />
            Would you like to proceed anyway or update the conversion rate?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfitWarningOpen(false)} color="primary">
            Update Conversion Rate
          </Button>
          <Button 
            onClick={async () => {
              setProfitWarningOpen(false);
              await submitForm(pendingFormData);
            }} 
            color="primary" 
            variant="contained"
          >
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Another Unit Dialog */}
      <Dialog open={addAnotherDialogOpen} onClose={() => setAddAnotherDialogOpen(false)}>
        <DialogTitle>Add Additional Units?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to add additional units of sale or purchase to "{currentProductInfo?.product_name}" other than {firstTimeSellingUnit && firstTimeBuyingUnit ? `${firstTimeSellingUnit} and ${firstTimeBuyingUnit}` : 'the existing units'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishAddingUnits} color="primary">
            No, Proceed to Stock Entry
          </Button>
          <Button onClick={handleAddAnotherUnit} color="primary" variant="contained">
            Yes, Add Additional Units
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AddUnit; 