const sectorsData = require('../../public/assets/sectors.json');

function getSectorAirports(positionId) {
  const airports = new Set();
  const addAirports = (key) => {
    const sector = sectorsData[key];
    if (sector?.airports) sector.airports.forEach((airport) => airports.add(airport));
  };

  addAirports(positionId);
  if (positionId.includes(':')) positionId.split(':').forEach(addAirports);
  return airports;
}

module.exports = { getSectorAirports };
