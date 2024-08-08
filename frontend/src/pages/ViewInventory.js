import React, { useState, useEffect } from 'react';
import axiosInstance from '../AxiosInstance';
import { 
  Container, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Typography,
  TablePagination,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  Box
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.dark,
  color: theme.palette.common.white,
  fontWeight: 'bold',
}));

const unitTypes = ['kg', 'lb', 'oz', 'g'];

const convertUnits = (quantity, fromUnit, toUnit) => {
  const conversionFactors = {
    kg: {
      kg: 1,
      lb: 2.20462,
      oz: 35.274,
      g: 1000,
    },
    lb: {
      kg: 0.453592,
      lb: 1,
      oz: 16,
      g: 453.592,
    },
    oz: {
      kg: 0.0283495,
      lb: 0.0625,
      oz: 1,
      g: 28.3495,
    },
    g: {
      kg: 0.001,
      lb: 0.00220462,
      oz: 0.035274,
      g: 1,
    },
  };
  
  if (!conversionFactors[fromUnit] || !conversionFactors[fromUnit][toUnit]) {
    throw new Error(`Conversion from ${fromUnit} to ${toUnit} not supported`);
  }
  return quantity * conversionFactors[fromUnit][toUnit];
};

const ViewInventories = () => {
  const [inventories, setInventories] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editOpen, setEditOpen] = useState(false);
  const [editInventory, setEditInventory] = useState({});
  const [openSuccessSnackbar, setOpenSuccessSnackbar] = useState(false);
  const [openErrorSnackbar, setOpenErrorSnackbar] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState('kg');

  useEffect(() => {
    const fetchInventories = async () => {
      try {
        const response = await axiosInstance.get('/inventories');
        setInventories(response.data);
      } catch (error) {
        console.error('Error fetching inventories:', error);
      }
    };

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

    fetchInventories();
    fetchData();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEditClick = (inventory) => {
    setEditInventory(inventory);
    setEditOpen(true);
  };

  const handleDeleteClick = async (inventoryId) => {
    try {
      await axiosInstance.delete(`/inventories/${inventoryId}`);
      setInventories(inventories.filter(inv => inv.inventory_id !== inventoryId));
      setOpenSuccessSnackbar(true);
    } catch (error) {
      console.error('Error deleting inventory:', error);
      setOpenErrorSnackbar(true);
    }
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditInventory({ ...editInventory, [name]: value });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    try {
      await axiosInstance.put(`/inventories/${editInventory.inventory_id}`, {
        shop_name: editInventory.shop_name,
        product_name: editInventory.product_name,
        current_stock: editInventory.current_stock
      });
      const updatedInventories = inventories.map(inv =>
        inv.inventory_id === editInventory.inventory_id ? editInventory : inv
      );
      setInventories(updatedInventories);
      setEditOpen(false);
      setOpenSuccessSnackbar(true);
    } catch (error) {
      console.error('Error updating inventory:', error);
      setOpenErrorSnackbar(true);
    }
  };

  const handleCloseSnackbar = () => {
    setOpenSuccessSnackbar(false);
    setOpenErrorSnackbar(false);
  };

  const handleUnitTypeChange = (event) => {
    setSelectedUnitType(event.target.value);
  };

  const convertStock = (stock, fromUnit) => {
    return convertUnits(stock, fromUnit, selectedUnitType);
  };

  return (
    <Container sx={{ marginTop: 4 }}>
      <Typography variant="h4" gutterBottom>
        Inventories
      </Typography>
      <FormControl fullWidth margin="normal">
        <InputLabel>Unit Type</InputLabel>
        <Select
          value={selectedUnitType}
          onChange={handleUnitTypeChange}
          label="Unit Type"
        >
          {unitTypes.map((unitType) => (
            <MenuItem key={unitType} value={unitType}>
              {unitType}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TableContainer component={Paper} sx={{ boxShadow: 3, marginBottom: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <StyledTableCell>Shop Name</StyledTableCell>
              <StyledTableCell>Product Name</StyledTableCell>
              <StyledTableCell>Current Stock</StyledTableCell>
              <StyledTableCell>Buying Unit</StyledTableCell>
              <StyledTableCell>Selling Unit</StyledTableCell>
              <StyledTableCell>Actions</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((inventory) => (
              <TableRow key={inventory.inventory_id}>
                <TableCell>{inventory.shop_name}</TableCell>
                <TableCell>{inventory.product_name}</TableCell>
                <TableCell>{convertStock(inventory.current_stock, inventory.selling_unit_type)}</TableCell>
                <TableCell>{inventory.buying_unit_type}</TableCell>
                <TableCell>{inventory.selling_unit_type}</TableCell>
                <TableCell>
                  <Button color="primary" onClick={() => handleEditClick(inventory)}>Edit</Button>
                  <Button color="secondary" onClick={() => handleDeleteClick(inventory.inventory_id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={inventories.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Edit Inventory</DialogTitle>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Shop Name</InputLabel>
              <Select
                name="shop_name"
                value={editInventory.shop_name}
                onChange={handleEditChange}
                label="Shop Name"
              >
                {shops.map((shop) => (
                  <MenuItem key={shop.shop_id} value={shop.shop_name}>
                    {shop.shop_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Product Name</InputLabel>
              <Select
                name="product_name"
                value={editInventory.product_name}
                onChange={handleEditChange}
                label="Product Name"
              >
                {products.map((product) => (
                  <MenuItem key={product.product_id} value={product.product_name}>
                    {product.product_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Current Stock"
              type="number"
              name="current_stock"
              value={editInventory.current_stock}
              onChange={handleEditChange}
              fullWidth
              margin="normal"
            />
            <DialogActions>
              <Button onClick={() => setEditOpen(false)} color="primary">
                Cancel
              </Button>
              <Button type="submit" color="primary">
                Save
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={openSuccessSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity="success">
          Inventory updated successfully!
        </MuiAlert>
      </Snackbar>
      <Snackbar
        open={openErrorSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity="error">
          Error updating inventory!
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default ViewInventories;
