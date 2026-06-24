/**
 * safetyScoring.js — SafeRoute's Core Differentiator
 *
 * Formula:
 *   SafetyScore(route) =
 *     0.40 × incidentScore      (proximity to reported incidents, weighted by confidence + recency)
 *   + 0.30 × lightingScore      (road type proxy for street lighting)
 *   + 0.20 × timeOfDayScore     (hour-based multiplier — worst at 3am, best at noon)
 *   + 0.10 × routeTypeScore     (main roads score better than alleys/footways)
 *
 * All sub-scores are normalized 0.0–1.0 (1.0 = safest).
 * Final output: 0.0–10.0 (presented to user as X/10).
 */

const Incident = require('../models/Incident');

// ─── Time-of-Day Weight ───────────────────────────────────────────────────────
// Returns 0.0 (least safe: ~3am) to 1.0 (safest: noon)
const getTimeOfDayScore = (hour) => {
  // Piecewise linear approximation
  if (hour >= 6 && hour < 10) return 0.90;  // Morning commute
  if (hour >= 10 && hour < 16) return 1.00; // Daytime — safest
  if (hour >= 16 && hour < 20) return 0.85; // Evening commute
  if (hour >= 20 && hour < 22) return 0.70; // Early night
  if (hour >= 22 && hour < 24) return 0.55; // Late night
  if (hour >= 0 && hour < 2) return 0.45;   // Midnight
  if (hour >= 2 && hour < 4) return 0.35;   // Deepest night — riskiest
  if (hour >= 4 && hour < 6) return 0.50;   // Early morning
  return 0.80;
};

// ─── Road Type Score ──────────────────────────────────────────────────────────
// OSRM road type heuristic — based on route geometry step metadata
// OSRM doesn't always expose road class in the free API, so we proxy via
// road name patterns (common Chandigarh patterns used here)
const getRoadTypeScore = (legs) => {
  if (!legs || legs.length === 0) return 0.5;

  let totalSteps = 0;
  let weightedScore = 0;

  const roadTypeWeights = {
    motorway: 0.95,
    trunk: 0.90,
    primary: 0.85,
    secondary: 0.80,
    tertiary: 0.70,
    residential: 0.60,
    service: 0.45,
    footway: 0.30,
    path: 0.25,
    unclassified: 0.50,
    default: 0.55,
  };

  legs.forEach(leg => {
    (leg.steps || []).forEach(step => {
      const name = (step.name || '').toLowerCase();
      let score = roadTypeWeights.default;

      // Chandigarh-specific patterns
      if (name.includes('sector') || name.includes('main road') || name.includes('madhya marg') ||
          name.includes('dakshin marg') || name.includes('uttar marg') || name.includes('purv marg')) {
        score = roadTypeWeights.primary;
      } else if (name.includes('market') || name.includes('chowk') || name.includes('nagar')) {
        score = roadTypeWeights.secondary;
      } else if (name === '' || name.includes('lane') || name.includes('gali')) {
        score = roadTypeWeights.footway;
      }

      const stepDuration = step.duration || 1;
      weightedScore += score * stepDuration;
      totalSteps += stepDuration;
    });
  });

  return totalSteps > 0 ? weightedScore / totalSteps : 0.55;
};

// ─── Lighting Proxy Score ─────────────────────────────────────────────────────
// Approximation: main commercial roads are better lit than residential/alleys.
// Uses time-of-day modulation: same road scores lower at night.
const getLightingScore = (roadTypeScore, hour) => {
  // At night, lighting matters more and poorly-lit roads score much worse
  const isNight = hour < 6 || hour >= 20;
  if (!isNight) return roadTypeScore; // Daytime: full lighting score

  // Night penalty: compress poor scores downward, boost good scores slightly
  const nightPenalty = 0.7; // Roads lose 30% of their daytime score at night
  return roadTypeScore * nightPenalty + (1 - nightPenalty) * 0.2;
};

// ─── Incident Score ───────────────────────────────────────────────────────────
// Queries MongoDB for incidents within ~250m of any route point.
// Weighted by: confidence × recency decay.
const getIncidentScore = async (routeCoords) => {
  // Sample route points (every 5th coord to avoid too many DB queries)
  const sampledCoords = routeCoords.filter((_, i) => i % 5 === 0);
  if (sampledCoords.length === 0) return 1.0;

  const RADIUS_METERS = 250;
  let totalPenalty = 0;

  // Query incidents near sampled route points
  for (const [lng, lat] of sampledCoords) {
    const nearbyIncidents = await Incident.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: RADIUS_METERS,
        },
      },
      isActive: true,
    }).select('confidence createdAt type');

    for (const incident of nearbyIncidents) {
      // Recency decay: incidents lose weight as they age (linear over 30 days)
      const ageMs = Date.now() - new Date(incident.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0, 1 - ageDays / 30);

      // High-severity types get a larger penalty
      const severityMultiplier = ['harassment', 'theft', 'suspicious_activity'].includes(incident.type) ? 1.5 : 1.0;

      totalPenalty += incident.confidence * recencyFactor * severityMultiplier;
    }
  }

  // Convert penalty to score: 0 incidents = 1.0, many incidents = ~0.1
  const score = Math.max(0.1, 1 - Math.min(1, totalPenalty / (sampledCoords.length * 0.5)));
  return score;
};

// ─── Main Scoring Function ────────────────────────────────────────────────────
/**
 * @param {number[][]} routeCoords - Array of [lng, lat] from OSRM geometry
 * @param {object[]} legs - OSRM route legs (for road type extraction)
 * @param {number} hour - Hour of day (0-23) for time-of-day weighting
 * @returns {number} Safety score 0.0–10.0
 */
const scoreRoute = async (routeCoords, legs, hour) => {
  const [incidentScore, roadTypeScore] = await Promise.all([
    getIncidentScore(routeCoords),
    Promise.resolve(getRoadTypeScore(legs)),
  ]);

  const timeScore = getTimeOfDayScore(hour);
  const lightingScore = getLightingScore(roadTypeScore, hour);

  // Weighted composite
  const composite = (
    0.40 * incidentScore +
    0.30 * lightingScore +
    0.20 * timeScore +
    0.10 * roadTypeScore
  );

  // Normalize to 0–10, keep 1 decimal
  return Math.round(composite * 100) / 10;
};

// ─── Score Label ──────────────────────────────────────────────────────────────
const getScoreLabel = (score) => {
  if (score >= 8.5) return { label: 'Very Safe', color: 'green' };
  if (score >= 7.0) return { label: 'Safe', color: 'green' };
  if (score >= 5.5) return { label: 'Moderate', color: 'yellow' };
  if (score >= 4.0) return { label: 'Use Caution', color: 'yellow' };
  return { label: 'High Risk', color: 'red' };
};

// ─── Score Explanation ────────────────────────────────────────────────────────
const getScoreExplanation = async (routeCoords, legs, hour) => {
  const incidentScore = await getIncidentScore(routeCoords);
  const roadTypeScore = getRoadTypeScore(legs);
  const timeScore = getTimeOfDayScore(hour);
  const lightingScore = getLightingScore(roadTypeScore, hour);

  const isNight = hour < 6 || hour >= 20;

  return {
    incident: { score: Math.round(incidentScore * 10) / 10, weight: '40%', label: 'Incident Reports' },
    lighting: { score: Math.round(lightingScore * 10) / 10, weight: '30%', label: `Street Lighting${isNight ? ' (night penalty applied)' : ''}` },
    timeOfDay: { score: Math.round(timeScore * 10) / 10, weight: '20%', label: `Time of Day (${hour}:00)` },
    roadType: { score: Math.round(roadTypeScore * 10) / 10, weight: '10%', label: 'Road Classification' },
  };
};

module.exports = { scoreRoute, getScoreLabel, getScoreExplanation, getTimeOfDayScore };
