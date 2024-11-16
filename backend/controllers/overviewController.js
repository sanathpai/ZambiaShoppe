const moment = require('moment');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const convertUnits = require('../utils/unitConversion');

exports.getProfitsData = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Fetch all purchases, sales, and inventories for the user
    const [purchases, sales, inventories] = await Promise.all([
      Purchase.findAllByUser(user_id),
      Sale.findAllByUser(user_id),
      Inventory.findAllByUser(user_id),
    ]);

    // Group purchases, sales, and inventory data by product_id
    const groupedPurchases = groupByProduct(purchases);
    const groupedSales = groupByProduct(sales);
    const groupedInventory = groupByProduct(inventories);

    // Calculate final profits and total quantities
    const { profitsForWeek, profitsForPrevWeek } = await calculateFinalProfits(groupedInventory, groupedPurchases, groupedSales);
    const totalQuantities = await calculateTotalQuantities(groupedInventory, groupedPurchases, groupedSales);

    res.status(200).json({
      message: "Successful",
      finalProfits: { profitsForWeek, profitsForPrevWeek },
      totalQuantities: totalQuantities // Include total quantities in the response
    });

  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Failed"
    });
  }
};

// Calculate final profits for the current and previous week
const calculateFinalProfits = async (groupedInventory, groupedPurchases, groupedSales) => {
  let finalProfits = {
    profitsForWeek: [],
    profitsForPrevWeek: []
  };

  for (const [productId, inventoryArray] of groupedInventory.entries()) {
    console.log("Processing product:", productId);

    let purArr = groupedPurchases.get(productId);
    if (!purArr || purArr.length === 0) continue; // Skip if no purchases are found for this product

    // Get product_name and unit_type from the inventoryArray (since it should be present in inventories)
    const productName = inventoryArray[0].product_name || 'Unknown Product';
    const unitType = inventoryArray[0].unit_type || 'undefined';
    const variety = inventoryArray[0].variety || 'Unknown Variety'; // Extract variety here

    let inventoryStock = parseFloat(inventoryArray[0].current_stock);
    let purchaseSum = 0, purchaseCost = 0;

    // Accumulate purchase quantities and costs
    for (let i = 0; i < purArr.length; i++) {
      if (purchaseSum >= inventoryStock) break;

      let convertedPurchaseQuantity = await convertUnits(purArr[i].quantity, purArr[i].unit_id, inventoryArray[0].unit_id);
      purchaseSum += parseFloat(convertedPurchaseQuantity);
      purchaseCost= purchaseCost + purArr[i].order_price*purArr[i].quantity;
    }

    let avgPurchase = purchaseSum > 0 ? parseFloat(purchaseCost) / parseFloat(purchaseSum) : 0;

    // Calculate sales for the current week
    let salesForWeek = calculateSalesForWeek(groupedSales, productId);
    let salesForPrevWeek = calculateSalesForPrevWeek(groupedSales, productId);

    // Calculate average sales and check for sales presence
    let { avgSalesWeek, avgSalesPrevWeek, salesQuantityForWeek, salesQuantityForPrevWeek } = await calculateAverageSales(
      salesForWeek,
      salesForPrevWeek,
      inventoryArray[0].unit_id
    );

    // Set profit to zero if there are no sales
    let profitForWeek = salesQuantityForWeek > 0 ? avgSalesWeek - avgPurchase : 0;
    let profitForPrevWeek = salesQuantityForPrevWeek > 0 ? avgSalesPrevWeek - avgPurchase : 0;

    // Store the profits, product name, and unit type in the final object
    finalProfits.profitsForWeek.push({ productId, variety, productName, unitType, profit: profitForWeek });
    finalProfits.profitsForPrevWeek.push({ productId, variety, productName, unitType, profit: profitForPrevWeek });
  }

  console.log('Final profits:', finalProfits);
  return finalProfits;
};

// Calculate total purchase and sales quantities for each product
const calculateTotalQuantities = async (groupedInventory, groupedPurchases, groupedSales) => {
  let totalQuantities = {
    purchases: [],
    sales: []
  };

  for (const [productId, inventoryArray] of groupedInventory.entries()) {
    console.log("Processing product for quantities:", productId);

    // Get product_name and unit_type from the inventoryArray (since it should be present in inventories)
    const productName = inventoryArray[0].product_name || 'Unknown Product';
    const unitType = inventoryArray[0].unit_type || 'undefined';
    const variety = inventoryArray[0].variety || 'undefined';
    // Calculate total purchase quantity in inventory units
    let totalPurchaseQuantity = 0;
    let purArr = groupedPurchases.get(productId);
    if (purArr && purArr.length > 0) {
      for (let i = 0; i < purArr.length; i++) {
        let convertedPurchaseQuantity = await convertUnits(purArr[i].quantity, purArr[i].unit_id, inventoryArray[0].unit_id);
        totalPurchaseQuantity += parseFloat(convertedPurchaseQuantity);
      }
    }

    // Calculate total sales quantity in inventory units
    let totalSalesQuantity = 0;
    let salesArr = groupedSales.get(productId);
    if (salesArr && salesArr.length > 0) {
      for (let i = 0; i < salesArr.length; i++) {
        let convertedSalesQuantity = await convertUnits(salesArr[i].quantity, salesArr[i].unit_id, inventoryArray[0].unit_id);
        totalSalesQuantity += parseFloat(convertedSalesQuantity);
      }
    }

    // Store the total quantities
    totalQuantities.purchases.push({ productId, productName, variety, unitType, totalQuantity: totalPurchaseQuantity });
    totalQuantities.sales.push({ productId, productName, variety, unitType, totalQuantity: totalSalesQuantity });
  }

  return totalQuantities;
};

// Calculate average sales for the current and previous week
const calculateAverageSales = async (salesForWeek, salesForPrevWeek, inventoryUnitId) => {
  let salesQuantityForWeek = 0, salePriceForWeek = 0;
  let salesQuantityForPrevWeek = 0, salePriceForPrevWeek = 0;

  // Calculate sales for the current week
  for (let i = 0; i < salesForWeek.length; i++) {
    let convertedSalesQuantity = await convertUnits(salesForWeek[i].quantity, salesForWeek[i].unit_id, inventoryUnitId);
    salesQuantityForWeek += parseFloat(convertedSalesQuantity);
    salePriceForWeek =salePriceForWeek+ salesForWeek[i].retail_price * salesForWeek[i].quantity;
  }

  // Calculate sales for the previous week
  for (let i = 0; i < salesForPrevWeek.length; i++) {
    let convertedSalesPrevQuantity = await convertUnits(salesForPrevWeek[i].quantity, salesForPrevWeek[i].unit_id, inventoryUnitId);
    salesQuantityForPrevWeek += parseFloat(convertedSalesPrevQuantity);
    salePriceForPrevWeek = salePriceForPrevWeek + salesForPrevWeek[i].retail_price * salesForPrevWeek[i].quantity;
  }

  let avgSalesWeek = salesQuantityForWeek > 0 ? parseFloat(salePriceForWeek) / parseFloat(salesQuantityForWeek) : 0;
  let avgSalesPrevWeek = salesQuantityForPrevWeek > 0 ? parseFloat(salePriceForPrevWeek) / parseFloat(salesQuantityForPrevWeek) : 0;

  return { avgSalesWeek, avgSalesPrevWeek, salesQuantityForWeek, salesQuantityForPrevWeek };
};

// Calculate sales for the current week
const calculateSalesForWeek = (groupedSales, productID) => {
  const salesArray = groupedSales.get(productID) || [];
  return salesArray.filter(sale => {
    return moment(sale.sale_date).isBetween(moment().startOf('week'), moment().endOf('week'), null, '[]');
  });
}

// Calculate sales for the previous week
const calculateSalesForPrevWeek = (groupedSales, productID) => {
  const salesArray = groupedSales.get(productID) || [];
  return salesArray.filter(sale => {
    const startOfPrevWeek = moment().subtract(1, 'weeks').startOf('week');
    const endOfPrevWeek = moment().subtract(1, 'weeks').endOf('week');
    return moment(sale.sale_date).isBetween(startOfPrevWeek, endOfPrevWeek, null, '[]');
  });
};

// Group data by product_id
const groupByProduct = (data) => {
  let acc = new Map();
  data.forEach(d1 => {
    if (!acc.has(d1?.product_id)) {
      acc.set(d1?.product_id, []);
    }
    acc.get(d1?.product_id).push(d1);
  });
  return acc;
};
