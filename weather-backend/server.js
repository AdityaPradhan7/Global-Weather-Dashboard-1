require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables (store these in .env)
const SYNCLOOP_URL = process.env.SYNCLOOP_URL;
const GEODB_API_KEY = process.env.GEODB_API_KEY;
const OPEN_METEO_URL = process.env.OPEN_METEO_URL;

// Proxy endpoint for weather data
app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    const response = await axios.get(`${SYNCLOOP_URL}?q=${city}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

// Proxy endpoint for autocomplete
app.get('/api/autocomplete', async (req, res) => {
  try {
    const { query } = req.query;
    const response = await axios.get(`https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${query}`, {
      headers: {
        "x-rapidapi-key": GEODB_API_KEY,
        "x-rapidapi-host": "wft-geo-db.p.rapidapi.com"
      }
    });
    res.json(response.data.data);
  } catch (error) {
    res.status(500).json({ error: "Autocomplete failed" });
  }
});

// Proxy endpoint for historical data
app.get('/api/history', async (req, res) => {
  try {
    const { lat, lon, startDate, endDate } = req.query;
    const response = await axios.get(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Historical data fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});