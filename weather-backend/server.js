require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const allowedOrigins = [
  'https://global-weather-dashboard-1-frontend.vercel.app', // Production frontend
  /\.vercel\.app$/, // All Vercel preview deployments
  process.env.NODE_ENV === 'development' 
    ? /^http:\/\/localhost(:\d+)?$/ // Any localhost port
    : null
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true // If using cookies/auth
}));

// Route 1: Main weather data (SyncLoop)
app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    const response = await axios.get(`${process.env.SYNCLOOP_URL}?q=${city}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Weather API failed" });
  }
});

// Route 2: Autocomplete (GeoDB Cities)
app.get('/api/autocomplete', async (req, res) => {
  try {
    const { query } = req.query;
    const response = await axios.get('https://wft-geo-db.p.rapidapi.com/v1/geo/cities', {
      params: { namePrefix: query },
      headers: {
        'x-rapidapi-key': process.env.GEODB_API_KEY,
        'x-rapidapi-host': 'wft-geo-db.p.rapidapi.com'
      }
    });
    res.json(response.data.data);
  } catch (error) {
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// Route 3: Historical data (Open-Meteo)
app.get('/api/history', async (req, res) => {
  try {
    const { lat, lon, start, end } = req.query;
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude: lat,
        longitude: lon,
        start_date: start,
        end_date: end,
        daily: 'temperature_2m_max,temperature_2m_min',
        timezone: 'auto'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Historical data failed" });
  }
});

module.exports = app;