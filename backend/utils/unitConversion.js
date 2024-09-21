// unitConversion.js (Utils)
const db = require('../config/db');

// Function to fetch all conversion rates and build a graph
const buildConversionGraph = async () => {
  const [conversions] = await db.query('SELECT from_unit_id, to_unit_id, conversion_rate FROM Unit_Conversion');
  
  const graph = {};

  conversions.forEach(({ from_unit_id, to_unit_id, conversion_rate }) => {
    if (!graph[from_unit_id]) {
      graph[from_unit_id] = [];
    }
    if (!graph[to_unit_id]) {
      graph[to_unit_id] = [];
    }
    graph[from_unit_id].push({ unit_id: to_unit_id, rate: conversion_rate });
    graph[to_unit_id].push({ unit_id: from_unit_id, rate: 1 / conversion_rate });
  });

  return graph;
};

// BFS function to find the path between two units in the graph
const bfsConversionPath = (graph, fromUnitId, toUnitId) => {
  const queue = [{ unit_id: fromUnitId, rate: 1 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { unit_id, rate } = queue.shift();

    if (unit_id === toUnitId) {
      return rate;
    }

    if (visited.has(unit_id)) {
      continue;
    }
    
    visited.add(unit_id);

    if (graph[unit_id]) {
      for (const neighbor of graph[unit_id]) {
        if (!visited.has(neighbor.unit_id)) {
          queue.push({ unit_id: neighbor.unit_id, rate: rate * neighbor.rate });
        }
      }
    }
  }

  return null;  // No conversion path found
};

// Function to convert units using direct or transitive conversions
const convertUnits = async (quantity, fromUnitId, toUnitId) => {
  if (fromUnitId === toUnitId) {
    return quantity;
  }

  const graph = await buildConversionGraph();

  const conversionRate = bfsConversionPath(graph, fromUnitId, toUnitId);


  if (conversionRate === null) {
    throw new Error(`No conversion path found between units ${fromUnitId} and ${toUnitId}`);
  }

  return quantity * conversionRate;
};

module.exports = convertUnits;
