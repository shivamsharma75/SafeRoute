/**
 * osrmService.js — OSRM Route Fetcher
 * Uses the public demo server (router.project-osrm.org) — free, no API key.
 * Limitation: shared public server, not for production scale.
 */

const axios = require('axios');

const OSRM_BASE = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';

/**
 * Get candidate routes between two points.
 * @param {number} originLng
 * @param {number} originLat
 * @param {number} destLng
 * @param {number} destLat
 * @returns {object[]} Array of OSRM route objects
 */
const getRoutes = async (originLng, originLat, destLng, destLat) => {
  const url = `${OSRM_BASE}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}`;

  const response = await axios.get(url, {
    params: {
      alternatives: true,       // Request multiple route options
      steps: true,               // Include road name steps for road type scoring
      geometries: 'geojson',     // GeoJSON for Leaflet polyline rendering
      overview: 'full',          // Full geometry (not simplified)
      annotations: false,
    },
    timeout: 10000, // 10s timeout — public server can be slow
    headers: {
      'User-Agent': 'SafeRoute-App/1.0 (demo project; contact: saferoute@demo.com)',
    },
  });

  if (!response.data || response.data.code !== 'Ok') {
    throw new Error(`OSRM error: ${response.data?.code || 'Unknown error'}`);
  }

  const routes = response.data.routes;
  if (!routes || routes.length === 0) {
    throw new Error('No routes found between these locations.');
  }

  return routes;
};

/**
 * Extract [lng, lat] coordinate array from OSRM GeoJSON geometry
 * @param {object} route - OSRM route object
 * @returns {number[][]} Array of [lng, lat] pairs
 */
const extractCoords = (route) => {
  return route.geometry?.coordinates || [];
};

/**
 * Geocode an address using Nominatim (free OSM geocoder)
 * @param {string} query - Address string
 * @returns {{ lat: number, lng: number, displayName: string }}
 */
const geocode = async (query) => {
  let q = query;
  if (!q.toLowerCase().includes('chandigarh')) {
    q = query + ', Chandigarh, India';
  }

  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q,
      format: 'json',
      limit: 1,
      addressdetails: 1,
    },
    headers: {
      'User-Agent': 'SafeRoute-App/1.0',
    },
    timeout: 8000,
  });

  if (!response.data || response.data.length === 0) {
    throw new Error(`Location not found: "${query}"`);
  }

  const place = response.data[0];
  return {
    lat: parseFloat(place.lat),
    lng: parseFloat(place.lon),
    displayName: place.display_name,
  };
};

module.exports = { getRoutes, extractCoords, geocode };
