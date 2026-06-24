const express = require('express');
const { protect } = require('../middleware/auth');
const { getRoutes, extractCoords, geocode } = require('../services/osrmService');
const { scoreRoute, getScoreLabel, getScoreExplanation } = require('../services/safetyScoring');

const router = express.Router();

// POST /api/routes
// Body: { origin: "Sector 17, Chandigarh", destination: "PGI Chandigarh" }
//    OR { originCoords: { lat, lng }, destCoords: { lat, lng } }
router.post('/', protect, async (req, res) => {
  try {
    const { origin, destination, originCoords, destCoords } = req.body;

    let oLat, oLng, dLat, dLng, originName, destName;

    // Resolve coordinates independently
    if (originCoords) {
      oLat = originCoords.lat; oLng = originCoords.lng;
      originName = origin || `${oLat.toFixed(4)}, ${oLng.toFixed(4)}`;
    } else if (origin) {
      const oGeo = await geocode(origin);
      oLat = oGeo.lat; oLng = oGeo.lng; originName = oGeo.displayName;
    } else {
      return res.status(400).json({ success: false, message: 'Provide starting point text or coordinates.' });
    }

    if (destCoords) {
      dLat = destCoords.lat; dLng = destCoords.lng;
      destName = destination || `${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;
    } else if (destination) {
      const dGeo = await geocode(destination);
      dLat = dGeo.lat; dLng = dGeo.lng; destName = dGeo.displayName;
    } else {
      return res.status(400).json({ success: false, message: 'Provide destination text or coordinates.' });
    }

    // Validate Chandigarh bounding box (roughly)
    // Lat: 30.60 – 30.80, Lng: 76.68 – 76.90
    // (skip strict validation for demo — OSRM will fail gracefully if out of bounds)

    // Fetch routes from OSRM
    const osrmRoutes = await getRoutes(oLng, oLat, dLng, dLat);

    const hour = new Date().getHours();

    // Score all returned routes in parallel
    const scoredRoutes = await Promise.all(
      osrmRoutes.map(async (route, idx) => {
        const coords = extractCoords(route);
        const score = await scoreRoute(coords, route.legs, hour);
        const { label, color } = getScoreLabel(score);
        const breakdown = await getScoreExplanation(coords, route.legs, hour);

        return {
          id: idx,
          geometry: route.geometry, // GeoJSON LineString for Leaflet
          distance: route.distance, // metres
          duration: route.duration, // seconds
          distanceKm: (route.distance / 1000).toFixed(1),
          durationMin: Math.ceil(route.duration / 60),
          safetyScore: score,
          safetyLabel: label,
          safetyColor: color,
          scoreBreakdown: breakdown,
          summary: route.legs?.[0]?.summary || `Route ${idx + 1}`,
        };
      })
    );

    // Sort by safety score descending
    const sorted = [...scoredRoutes].sort((a, b) => b.safetyScore - a.safetyScore);

    // Identify "fastest" (shortest duration) and "safest" (highest score)
    const fastest = scoredRoutes.reduce((min, r) => r.duration < min.duration ? r : min, scoredRoutes[0]);
    let safest = sorted[0];

    // If the safest route's score is equal to or lower than the fastest route's score,
    // then the fastest route is also one of the safest, making it the optimal choice.
    if (safest.safetyScore <= fastest.safetyScore) {
      safest = fastest;
    }

    const isSameRoute = fastest.id === safest.id;

    res.json({
      success: true,
      origin: { name: originName, lat: oLat, lng: oLng },
      destination: { name: destName, lat: dLat, lng: dLng },
      routes: scoredRoutes,
      fastest: { ...fastest, tag: 'fastest' },
      safest: { ...safest, tag: 'safest' },
      isSameRoute, // true = only 1 route found or identical paths/scores
      scoreDiff: isSameRoute ? 0 : (safest.safetyScore - fastest.safetyScore).toFixed(1),
      timeDiffMin: isSameRoute ? 0 : Math.abs(safest.durationMin - fastest.durationMin),
      hour,
    });
  } catch (err) {
    console.error('Route error:', err.message);
    if (err.message.includes('not found') || err.message.includes('No routes')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.includes('OSRM')) {
      return res.status(503).json({ success: false, message: 'Routing service temporarily unavailable. Try again.' });
    }
    res.status(500).json({ success: false, message: 'Failed to compute routes.' });
  }
});

// GET /api/routes/geocode?q=Sector 17 Chandigarh
router.get('/geocode', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) {
      return res.status(400).json({ success: false, message: 'Query must be at least 3 characters.' });
    }
    const result = await geocode(q);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

module.exports = router;
