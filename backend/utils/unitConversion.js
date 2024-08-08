

const convertUnits = (quantity, fromUnitSize, toUnitSize) => {
  return (quantity * toUnitSize) / fromUnitSize;
};

module.exports = convertUnits;
