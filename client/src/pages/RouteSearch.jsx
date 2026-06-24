import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { routesAPI, incidentsAPI, safeHavensAPI, feedbackAPI } from '../services/api';
import { useGPS } from '../hooks/useGPS';
import { useAuth } from '../context/AuthContext';
import SOSButton from '../components/SOSButton';
import styles from './RouteSearch.module.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Chandigarh center
const CHD_CENTER = [30.7333, 76.7794];

// Color-coded route colors
const ROUTE_COLORS = {
  green:  '#6bdc96',
  yellow: '#ffb866',
  red:    '#ffb4ab',
};

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 1.2 });
  }, [center, map]);
  return null;
}

// Demo mode seed for Sector 17 → PGI route
const DEMO_ORIGIN = 'Sector 17 Plaza, Chandigarh';
const DEMO_DEST = 'PGI Chandigarh';
const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';

export default function RouteSearch() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [mapCenter, setMapCenter] = useState(CHD_CENTER);
  const [incidents, setIncidents] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(null);

  // Safe Havens states
  const [safeHavens, setSafeHavens] = useState([]);
  const [showSafeHavens, setShowSafeHavens] = useState(false);
  const [fetchingHavens, setFetchingHavens] = useState(false);

  // Feedback modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comments: '',
    encounteredIssues: [],
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Autocomplete states & coordinates storage
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);

  const originRef = useRef(null);
  const destRef = useRef(null);

  const { position, startWatch, stopWatch, getOnce: getGPSOnce } = useGPS();

  // Toast message state
  const [toastMessage, setToastMessage] = useState('');
  
  // Incident report modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    type: 'poor_lighting',
    severity: 'medium',
    description: '',
    locationType: 'gps',
    customAddress: '',
    customCoords: null,
  });
  const [modalSuggestions, setModalSuggestions] = useState([]);
  const [modalShowDropdown, setModalShowDropdown] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const modalCustomRef = useRef(null);

  // Load nearby incidents for map display & get location once
  useEffect(() => {
    incidentsAPI.getAll(CHD_CENTER[0], CHD_CENTER[1], 5000)
      .then(r => setIncidents(r.data.incidents || []))
      .catch(() => {});
    getGPSOnce();
  }, [getGPSOnce]);

  // Load nearby safe havens when toggled or mapCenter changes
  useEffect(() => {
    if (!showSafeHavens) {
      setSafeHavens([]);
      return;
    }

    const lat = mapCenter[0];
    const lng = mapCenter[1];
    if (!lat || !lng) return;

    setFetchingHavens(true);
    safeHavensAPI.getNearby(lat, lng)
      .then(res => {
        if (res.data.success) {
          setSafeHavens(res.data.safeHavens || []);
        }
      })
      .catch(err => console.error('Failed to load safe havens:', err))
      .finally(() => setFetchingHavens(false));
  }, [showSafeHavens, mapCenter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  const checkRateLimit = () => {
    const lastReportTime = localStorage.getItem('lastIncidentReportedTime');
    if (lastReportTime) {
      const diffMins = (Date.now() - parseInt(lastReportTime)) / (1000 * 60);
      if (diffMins < 10) {
        return Math.ceil(10 - diffMins);
      }
    }
    return 0;
  };

  const handleOpenReportModal = () => {
    setModalError('');
    setModalForm({
      type: 'poor_lighting',
      severity: 'medium',
      description: '',
      locationType: 'gps',
      customAddress: '',
      customCoords: null,
    });
    setModalSuggestions([]);
    setModalShowDropdown(false);
    
    const remaining = checkRateLimit();
    if (remaining > 0) {
      setModalError(`You can report again in ${remaining} minutes.`);
    }

    setShowReportModal(true);
    getGPSOnce();
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    const remaining = checkRateLimit();
    if (remaining > 0) {
      setModalError(`You can report again in ${remaining} minutes.`);
      return;
    }

    let reportLat, reportLng;

    if (modalForm.locationType === 'gps') {
      if (!position) {
        setModalError('Location access required to report. Please enable GPS or choose custom location.');
        return;
      }
      reportLat = position.lat;
      reportLng = position.lng;
    } else {
      if (!modalForm.customCoords) {
        setModalError('Please select a valid location from the search suggestions.');
        return;
      }
      reportLat = modalForm.customCoords.lat;
      reportLng = modalForm.customCoords.lng;
    }

    setModalSubmitting(true);
    try {
      const { data } = await incidentsAPI.create({
        type: modalForm.type,
        severity: modalForm.severity,
        description: modalForm.description,
        lat: reportLat,
        lng: reportLng,
      });

      localStorage.setItem('lastIncidentReportedTime', Date.now().toString());

      if (data.incident) {
        setIncidents((prev) => [data.incident, ...prev]);
      }

      setShowReportModal(false);
      showToast('Incident reported. Helping keep Chandigarh safe.');
    } catch (err) {
      console.error('Report submission error:', err);
      setModalError(err.response?.data?.message || 'Failed to submit report. Try again.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Debounced search for starting location
  useEffect(() => {
    if (!origin.trim() || origin === 'Your Current Location' || origin.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      setOriginSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origin)}&format=json&limit=5&countrycodes=in&viewbox=76.6,30.6,76.9,30.8&bounded=1`
        );
        const data = await res.json();
        setOriginSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Origin autocomplete search failed:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [origin]);

  // Debounced search for destination location
  useEffect(() => {
    if (!destination.trim() || destination === 'PGI Chandigarh' || destination === 'Sector 17 Plaza, Chandigarh' || destination.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      setDestSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=5&countrycodes=in&viewbox=76.6,30.6,76.9,30.8&bounded=1`
        );
        const data = await res.json();
        setDestSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Destination autocomplete search failed:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [destination]);

  // Click outside suggestions lists to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (originRef.current && !originRef.current.contains(event.target)) {
        setShowOriginDropdown(false);
      }
      if (destRef.current && !destRef.current.contains(event.target)) {
        setShowDestDropdown(false);
      }
      if (modalCustomRef.current && !modalCustomRef.current.contains(event.target)) {
        setModalShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for custom incident location in modal
  useEffect(() => {
    if (!modalForm.customAddress || !modalForm.customAddress.trim() || modalForm.customAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      setModalSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(modalForm.customAddress)}&format=json&limit=5&countrycodes=in&viewbox=76.6,30.6,76.9,30.8&bounded=1`
        );
        const data = await res.json();
        setModalSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Modal incident geocoding search failed:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [modalForm.customAddress]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {};
      if (originCoords) {
        payload.originCoords = originCoords;
        payload.origin = origin;
      } else {
        payload.origin = origin.trim();
      }

      if (destCoords) {
        payload.destCoords = destCoords;
        payload.destination = destination;
      } else {
        payload.destination = destination.trim();
      }

      const { data } = await routesAPI.getRoutes(payload);
      setResult(data);
      setSelectedRoute(data.safest);
      if (data.origin) setMapCenter([data.origin.lat, data.origin.lng]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch routes. Check your input.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Location access denied. Please type your starting point.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setOrigin('Your Current Location');
        setOriginCoords({ lat, lng });
        setMapCenter([lat, lng]);
      },
      (err) => {
        console.error('GPS error:', err);
        setError('Location access denied. Please type your starting point.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startNavigation = () => {
    setNavigating(true);
    startWatch();
  };

  const stopNavigation = () => {
    setNavigating(false);
    stopWatch();
    setFeedbackForm({
      rating: 5,
      comments: '',
      encounteredIssues: [],
    });
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoute) return;

    setFeedbackSubmitting(true);
    try {
      // 1. Submit feedback
      await feedbackAPI.submit({
        routeId: selectedRoute.id,
        rating: feedbackForm.rating,
        encounteredIssues: feedbackForm.encounteredIssues,
        comments: feedbackForm.comments,
      });

      // 2. Auto-report checked incidents if coordinates are available (current position or destination)
      const reportCoords = position || destCoords || (result?.destination ? { lat: result.destination.lat, lng: result.destination.lng } : null);
      if (reportCoords && feedbackForm.encounteredIssues.length > 0) {
        for (const issue of feedbackForm.encounteredIssues) {
          try {
            await incidentsAPI.create({
              type: issue,
              description: `Auto-reported via post-trip feedback: ${feedbackForm.comments || 'No comment provided.'}`,
              lat: reportCoords.lat,
              lng: reportCoords.lng,
            });
          } catch (reportErr) {
            console.error('Failed to auto-report feedback incident:', reportErr);
          }
        }
        // Refresh incidents on the map
        incidentsAPI.getAll(CHD_CENTER[0], CHD_CENTER[1], 5000)
          .then(r => setIncidents(r.data.incidents || []))
          .catch(() => {});
      }

      showToast('Thank you for your feedback!');
      setShowFeedbackModal(false);
    } catch (err) {
      console.error('Feedback submit error:', err);
      showToast('Failed to submit feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const getScoreColor = (color) => ROUTE_COLORS[color] || ROUTE_COLORS.yellow;

  return (
    <div className={styles.page}>
      {/* Left Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h1 className={styles.title}>Navigate Safely</h1>
          <p className={styles.subtitle}>Chandigarh · Score-ranked routes</p>
        </div>

        {/* Toggle Option for Safe Havens */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--surface-container-high)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--outline-variant)',
          marginTop: 4
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Show Safe Havens</div>
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>Show Police & Hospitals</div>
            </div>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={showSafeHavens}
              onChange={(e) => setShowSafeHavens(e.target.checked)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.inputGroup}>
            <div className={styles.inputRow} ref={originRef}>
              <span className={styles.inputDot} style={{ background: 'var(--tertiary)' }} />
              <input
                className="input"
                value={origin}
                onChange={e => {
                  setOrigin(e.target.value);
                  setOriginCoords(null);
                  setShowOriginDropdown(true);
                }}
                onFocus={() => setShowOriginDropdown(true)}
                placeholder="Enter starting point"
              />
              <button type="button" onClick={handleUseMyLocation} className={styles.locBtn} title="Use my location">
                🎯
              </button>

              {/* Autocomplete Dropdown */}
              {showOriginDropdown && originSuggestions.length > 0 && (
                <div className={styles.autocompleteDropdown}>
                  {originSuggestions.map((sug) => (
                    <div
                      key={sug.place_id}
                      className={styles.autocompleteItem}
                      onClick={() => {
                        setOrigin(sug.display_name);
                        setOriginCoords({ lat: parseFloat(sug.lat), lng: parseFloat(sug.lon) });
                        setShowOriginDropdown(false);
                      }}
                    >
                      {sug.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.divider} />
            <div className={styles.inputRow} ref={destRef}>
              <span className={styles.inputDot} style={{ background: 'var(--secondary)' }} />
              <input
                className="input"
                value={destination}
                onChange={e => {
                  setDestination(e.target.value);
                  setDestCoords(null);
                  setShowDestDropdown(true);
                }}
                onFocus={() => setShowDestDropdown(true)}
                placeholder="Enter destination"
              />

              {/* Autocomplete Dropdown */}
              {showDestDropdown && destSuggestions.length > 0 && (
                <div className={styles.autocompleteDropdown}>
                  {destSuggestions.map((sug) => (
                    <div
                      key={sug.place_id}
                      className={styles.autocompleteItem}
                      onClick={() => {
                        setDestination(sug.display_name);
                        setDestCoords({ lat: parseFloat(sug.lat), lng: parseFloat(sug.lon) });
                        setShowDestDropdown(false);
                      }}
                    >
                      {sug.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-gold" style={{ width: '100%' }} disabled={loading}>
            {loading ? '🔍 Calculating safety scores...' : '🛡️ Find Safe Routes'}
          </button>
        </form>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div className={styles.error} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              className={styles.results}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {!result.isSameRoute && (
                <div className={styles.scoreDiff}>
                  <span>🛡️</span>
                  <span>
                    Safest route scores <strong style={{ color: 'var(--tertiary)' }}>+{result.scoreDiff} pts higher</strong>
                    {result.timeDiffMin > 0 && ` · only ${result.timeDiffMin} min longer`}
                  </span>
                </div>
              )}

              {/* Safest Route Card */}
              <RouteCard
                route={result.safest}
                label={result.isSameRoute ? "Fastest & Safest Route" : "Safest Route"}
                labelColor="var(--tertiary)"
                isSelected={selectedRoute?.id === result.safest.id}
                onSelect={() => { setSelectedRoute(result.safest); setShowBreakdown(null); }}
                onBreakdown={() => setShowBreakdown(showBreakdown === 'safest' ? null : 'safest')}
                showBreakdown={showBreakdown === 'safest'}
              />

              {/* Fastest Route Card (if different) */}
              {!result.isSameRoute && (
                <RouteCard
                  route={result.fastest}
                  label="Fastest Route"
                  labelColor="var(--on-surface-variant)"
                  isSelected={selectedRoute?.id === result.fastest.id}
                  onSelect={() => { setSelectedRoute(result.fastest); setShowBreakdown(null); }}
                  onBreakdown={() => setShowBreakdown(showBreakdown === 'fastest' ? null : 'fastest')}
                  showBreakdown={showBreakdown === 'fastest'}
                />
              )}

              {/* Navigate Button */}
              {selectedRoute && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {!navigating ? (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={startNavigation}>
                      ▶ Start Navigation
                    </button>
                  ) : (
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopNavigation}>
                      ■ Stop Navigation
                    </button>
                  )}
                </div>
              )}

              {navigating && (
                <div className={styles.navStatus}>
                  <div className={styles.navDot} />
                  <span>Live tracking active · {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Acquiring GPS...'}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map */}
      <div className={styles.mapArea}>
        <MapContainer
          center={CHD_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapController center={mapCenter} />

          {/* Draw route polylines */}
          {result?.routes?.map(route => (
            <Polyline
              key={route.id}
              positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{
                color: selectedRoute?.id === route.id
                  ? getScoreColor(route.safetyColor)
                  : 'rgba(100,120,150,0.4)',
                weight: selectedRoute?.id === route.id ? 5 : 3,
                opacity: selectedRoute?.id === route.id ? 0.95 : 0.4,
                dashArray: selectedRoute?.id === route.id ? undefined : '8, 8',
              }}
            />
          ))}

          {/* Origin marker */}
          {result?.origin && (
            <Marker position={[result.origin.lat, result.origin.lng]}>
              <Popup>📍 Start: {result.origin.name?.split(',')[0]}</Popup>
            </Marker>
          )}

          {/* Destination marker */}
          {result?.destination && (
            <Marker position={[result.destination.lat, result.destination.lng]}>
              <Popup>🏁 Destination: {result.destination.name?.split(',')[0]}</Popup>
            </Marker>
          )}

          {/* Incident markers */}
          {incidents.map(inc => (
            <Marker
              key={inc._id}
              position={[inc.location.coordinates[1], inc.location.coordinates[0]]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width:24px;height:24px;border-radius:50%;
                  background:rgba(255,184,102,0.15);
                  border:2px solid rgba(255,184,102,0.6);
                  display:flex;align-items:center;justify-content:center;
                  font-size:12px;cursor:pointer;
                ">⚠️</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            >
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)', color: '#ffffff', minWidth: 200 }}>
                  <strong style={{ color: 'var(--secondary, #ffb866)' }}>
                    {inc.title || inc.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </strong>
                  <span style={{
                    fontSize: 10, marginLeft: 8, padding: '2px 6px', borderRadius: 4,
                    background: inc.severity === 'high' ? 'rgba(255,180,171,0.2)' : inc.severity === 'medium' ? 'rgba(255,184,102,0.2)' : 'rgba(107,220,150,0.2)',
                    color: inc.severity === 'high' ? '#ffb4ab' : inc.severity === 'medium' ? '#ffb866' : '#6bdc96'
                  }}>
                    {inc.severity?.toUpperCase() || 'MEDIUM'}
                  </span>
                  <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>{inc.description || 'No description provided.'}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 8, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--outline-variant)', paddingTop: 6 }}>
                    <span>Source: {inc.source || 'Community'}</span>
                    <span>{new Date(inc.reportedAt || inc.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Safe Havens markers */}
          {showSafeHavens && safeHavens.map(haven => {
            const havenColor = haven.type === 'police' ? '#adc7f7' : haven.type === 'hospital' ? '#6bdc96' : '#80cbc4';
            const havenEmoji = haven.type === 'police' ? '👮' : haven.type === 'hospital' ? '🏥' : '💊';
            const havenLabel = haven.type === 'police' ? 'Police Station' : haven.type === 'hospital' ? 'Hospital' : 'Pharmacy';
            return (
              <Marker
                key={haven.id}
                position={[haven.lat, haven.lng]}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="
                    width:26px;height:26px;border-radius:50%;
                    background:rgba(255,255,255,0.05);
                    border:2px solid ${havenColor};
                    display:flex;align-items:center;justify-content:center;
                    font-size:13px;cursor:pointer;
                    box-shadow:0 0 6px ${havenColor};
                  ">${havenEmoji}</div>`,
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                })}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', color: '#ffffff', minWidth: 180 }}>
                    <strong style={{ color: havenColor }}>{haven.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                      🛡️ Safe Haven · {havenLabel}
                    </div>
                    <button
                      className="btn btn-sm btn-gold"
                      style={{ marginTop: 10, width: '100%', fontSize: 11, padding: '4px 8px' }}
                      onClick={() => {
                        setDestination(haven.name);
                        setDestCoords({ lat: haven.lat, lng: haven.lng });
                        setMapCenter([haven.lat, haven.lng]);
                      }}
                    >
                      📍 Route Here
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Live position marker */}
          {navigating && position && (
            <Marker
              position={[position.lat, position.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width:16px;height:16px;border-radius:50%;
                  background:var(--primary, #adc7f7);
                  border:3px solid white;
                  box-shadow:0 0 12px rgba(173,199,247,0.8);
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Popup>📍 You are here</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating Action Button for reporting incidents */}
        <button
          className={styles.fab}
          onClick={handleOpenReportModal}
          title="Report Safety Incident"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        {/* SOS overlay button (during navigation) */}
        {navigating && <SOSButton position={position} />}

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className={styles.toast}
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Post-Trip Feedback Modal */}
        <AnimatePresence>
          {showFeedbackModal && (
            <div className={styles.modalOverlay}>
              <motion.div
                className={styles.modalCard}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    top: 20, right: 20,
                    background: 'none', border: 'none',
                    fontSize: 20, color: 'var(--on-surface-variant)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowFeedbackModal(false)}
                >
                  ✕
                </button>
                
                <div className={styles.modalTitle}>🎉 Trip Completed!</div>
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 20 }}>
                  Help us make Chandigarh safer by sharing your feedback.
                </p>

                <form onSubmit={handleFeedbackSubmit}>
                  {/* Rating Selector (Stars) */}
                  <div className={styles.formGroup}>
                    <span className={styles.formLabel}>Rate your route safety</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 24, margin: '8px 0' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          style={{
                            cursor: 'pointer',
                            color: star <= feedbackForm.rating ? 'var(--secondary, #ffb866)' : 'var(--outline-variant)'
                          }}
                          onClick={() => setFeedbackForm(f => ({ ...f, rating: star }))}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Safety Concerns Checklist */}
                  <div className={styles.formGroup} style={{ marginTop: 8 }}>
                    <span className={styles.formLabel}>Did you encounter any safety issues?</span>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 10,
                      marginTop: 8
                    }}>
                      {[
                        { val: 'poor_lighting', label: '💡 Poor Lighting' },
                        { val: 'poor_road_condition', label: '🚧 Bad Road' },
                        { val: 'isolated_area', label: '🌑 Isolated Area' },
                        { val: 'suspicious_activity', label: '👁️ Suspicious Act' },
                      ].map((issue) => {
                        const isChecked = feedbackForm.encounteredIssues.includes(issue.val);
                        return (
                          <label
                            key={issue.val}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              padding: '8px 10px',
                              background: isChecked ? 'rgba(255, 184, 102, 0.1)' : 'var(--surface-container-high)',
                              border: `1px solid ${isChecked ? 'var(--secondary)' : 'var(--outline-variant)'}`,
                              borderRadius: 'var(--radius)',
                              cursor: 'pointer',
                              userSelect: 'none',
                              color: isChecked ? 'var(--secondary)' : 'var(--on-surface-variant)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFeedbackForm(f => {
                                  const list = [...f.encounteredIssues];
                                  if (checked) {
                                    list.push(issue.val);
                                  } else {
                                    const idx = list.indexOf(issue.val);
                                    if (idx > -1) list.splice(idx, 1);
                                  }
                                  return { ...f, encounteredIssues: list };
                                });
                              }}
                            />
                            {issue.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comments */}
                  <div className={styles.formGroup} style={{ marginTop: 12 }}>
                    <span className={styles.formLabel}>Additional Comments</span>
                    <textarea
                      className={styles.textarea}
                      placeholder="Share details (optional)..."
                      value={feedbackForm.comments}
                      onChange={e => setFeedbackForm(f => ({ ...f, comments: e.target.value }))}
                      rows={3}
                      maxLength={300}
                    />
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setShowFeedbackModal(false)}
                    >
                      Skip
                    </button>
                    <button
                      type="submit"
                      className="btn btn-gold"
                      style={{ flex: 2 }}
                      disabled={feedbackSubmitting}
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Report Incident Modal */}
        <AnimatePresence>
          {showReportModal && (
            <div className={styles.modalOverlay}>
              <motion.div
                className={styles.modalCard}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.modalTitle}>🛡️ Report Safety Incident</div>
                <form onSubmit={handleReportSubmit}>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Incident Type</label>
                    <select
                      className={styles.select}
                      value={modalForm.type}
                      onChange={e => setModalForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="poor_lighting">💡 Poor Lighting</option>
                      <option value="theft">💰 Theft / Snatching</option>
                      <option value="harassment">🛑 Harassment</option>
                      <option value="isolated_area">🌑 Isolated Area</option>
                      <option value="suspicious_activity">👁️ Suspicious Activity</option>
                      <option value="road_hazard">🚧 Road Hazard</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Severity Level</label>
                    <div className={styles.severityGroup}>
                      {['low', 'medium', 'high'].map(sev => {
                        const styleClass = sev === 'low' ? styles.severitySelectedLow : sev === 'medium' ? styles.severitySelectedMedium : styles.severitySelectedHigh;
                        const isSelected = modalForm.severity === sev;
                        return (
                          <button
                            key={sev}
                            type="button"
                            className={`${styles.severityRadio} ${isSelected ? styleClass : ''}`}
                            onClick={() => setModalForm(f => ({ ...f, severity: sev }))}
                          >
                            {sev.charAt(0).toUpperCase() + sev.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Description (max 200 chars)</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="e.g. Broken streetlamp near the park corner lane..."
                      rows={3}
                      maxLength={200}
                      value={modalForm.description}
                      onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Location Source</label>
                    
                    <div className={styles.locationSelector}>
                      <button
                        type="button"
                        className={`${styles.locationTab} ${modalForm.locationType === 'gps' ? styles.locationTabActive : ''}`}
                        onClick={() => setModalForm(f => ({ ...f, locationType: 'gps' }))}
                      >
                        📍 Live GPS
                      </button>
                      <button
                        type="button"
                        className={`${styles.locationTab} ${modalForm.locationType === 'custom' ? styles.locationTabActive : ''}`}
                        onClick={() => setModalForm(f => ({ ...f, locationType: 'custom' }))}
                      >
                        🔍 Search Location
                      </button>
                    </div>

                    {modalForm.locationType === 'gps' && (
                      <div className={styles.readOnlyLoc}>
                        {position 
                          ? `📍 GPS Coordinates: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` 
                          : '⏳ Acquiring GPS Location...'}
                      </div>
                    )}

                    {modalForm.locationType === 'custom' && (
                      <div className={styles.searchGroup} ref={modalCustomRef}>
                        <input
                          type="text"
                          className="input"
                          placeholder="Search location in Chandigarh..."
                          value={modalForm.customAddress}
                          onChange={e => {
                            setModalForm(f => ({ ...f, customAddress: e.target.value, customCoords: null }));
                            setModalShowDropdown(true);
                          }}
                          onFocus={() => setModalShowDropdown(true)}
                          style={{
                            background: 'rgba(11, 19, 38, 0.5)',
                            border: '1px solid var(--outline-variant)',
                            color: '#ffffff',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            width: '100%',
                          }}
                        />
                        
                        <AnimatePresence>
                          {modalShowDropdown && modalSuggestions.length > 0 && (
                            <motion.div
                              className={styles.autocompleteDropdown}
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                            >
                              {modalSuggestions.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={styles.autocompleteItem}
                                  onClick={() => {
                                    setModalForm(f => ({
                                      ...f,
                                      customAddress: item.display_name,
                                      customCoords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
                                    }));
                                    setModalShowDropdown(false);
                                  }}
                                >
                                  {item.display_name}
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {modalForm.customCoords && (
                          <div className={styles.readOnlyLoc} style={{ marginTop: 6, borderStyle: 'dashed' }}>
                            🎯 Selected: {modalForm.customCoords.lat.toFixed(5)}, {modalForm.customCoords.lng.toFixed(5)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {modalError && <div className={styles.error} style={{ marginTop: 12 }}>⚠️ {modalError}</div>}

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setShowReportModal(false)}
                      disabled={modalSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-gold"
                      style={{ flex: 1 }}
                      disabled={modalSubmitting || (modalForm.locationType === 'gps' && !position) || (modalForm.locationType === 'custom' && !modalForm.customCoords) || !!checkRateLimit()}
                    >
                      {modalSubmitting ? 'Reporting...' : '🛡️ Submit'}
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Route Card Component ─────────────────────────────────────────────────────
function RouteCard({ route, label, labelColor, isSelected, onSelect, onBreakdown, showBreakdown }) {
  const scoreColor = { green: 'var(--tertiary)', yellow: 'var(--secondary)', red: 'var(--error)' }[route.safetyColor] || 'var(--on-surface-variant)';
  const fillPct = `${(route.safetyScore / 10) * 100}%`;

  return (
    <motion.div
      className={`${styles.routeCard} ${isSelected ? styles.selectedCard : ''}`}
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className={styles.routeCardHeader}>
        <span className={styles.routeLabel} style={{ color: labelColor }}>{label}</span>
        <span className={styles.routeScore} style={{ color: scoreColor }}>
          {route.safetyScore}/10 {route.safetyLabel}
        </span>
      </div>

      {/* Score bar */}
      <div className="score-bar-track" style={{ margin: '8px 0' }}>
        <motion.div
          className={`score-bar-fill-${route.safetyColor}`}
          style={{ height: '100%', borderRadius: 9999 }}
          initial={{ width: 0 }}
          animate={{ width: fillPct }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className={styles.routeStats}>
        <span>🕐 {route.durationMin} min</span>
        <span>📏 {route.distanceKm} km</span>
        {route.summary && <span>📍 {route.summary}</span>}
      </div>

      <button
        className={styles.breakdownBtn}
        onClick={e => { e.stopPropagation(); onBreakdown(); }}
      >
        {showBreakdown ? '▲ Hide breakdown' : '▼ Why this score?'}
      </button>

      <AnimatePresence>
        {showBreakdown && route.scoreBreakdown && (
          <motion.div
            className={styles.breakdown}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {Object.entries(route.scoreBreakdown).map(([key, val]) => (
              <div key={key} className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>{val.label}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="score-bar-track" style={{ flex: 1 }}>
                    <div
                      className={`score-bar-fill-${val.score >= 0.7 ? 'green' : val.score >= 0.5 ? 'yellow' : 'red'}`}
                      style={{ height: '100%', width: `${val.score * 100}%`, borderRadius: 9999 }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', minWidth: 30 }}>{val.score.toFixed(1)}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', minWidth: 28 }}>{val.weight}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
