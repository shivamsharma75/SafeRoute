const express = require('express');
const router = express.Router();
const localHavens = require('../config/chandigarhSafeHavens.json');

// Haversine formula to compute distance in km between two coordinates
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// GET /api/safe-havens
router.get('/', async (req, res) => {
  try {
    const latVal = parseFloat(req.query.lat);
    const lngVal = parseFloat(req.query.lng);

    if (isNaN(latVal) || isNaN(lngVal)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required.' });
    }

    console.log(`🔒 Loading safe havens from local database around: ${latVal}, ${lngVal}`);

    // Calculate distances to all local safe havens
    const safeHavensWithDistance = localHavens.map(haven => ({
      ...haven,
      distance: getDistanceKm(latVal, lngVal, haven.lat, haven.lng)
    }));

    // Sort by proximity
    const sortedHavens = safeHavensWithDistance.sort((a, b) => a.distance - b.distance);

    // Format to match exact client expectations
    const safeHavens = sortedHavens.map(({ id, name, lat, lng, type }) => ({ id, name, lat, lng, type }));

    res.json({ success: true, safeHavens });
  } catch (err) {
    console.error('Safe havens local retrieval failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve safe havens.' });
  }
});

module.exports = router;
