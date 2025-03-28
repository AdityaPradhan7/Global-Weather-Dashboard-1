const BACKEND_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5001' // Local development
  : 'process.env.NEXT_PUBLIC_BACKEND_URL'; // Production

// DOM Elements
const cityInput = document.getElementById("city-input");
const voiceInputButton = document.getElementById("voice-input");
const searchButton = document.getElementById("search-button");
const autocompleteResults = document.getElementById("autocomplete-results");
const currentWeatherData = document.getElementById("current-weather-data");
const forecastData = document.getElementById("forecast-data");
const aqiData = document.getElementById("aqi-data");
const localTime = document.getElementById("local-time");
const mapElement = document.getElementById("map");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const fetchHistoryButton = document.getElementById("fetch-history");
const historicalWeatherData = document.getElementById("historical-weather-data");

// Variables
let map; // Leaflet map instance
let debounceTimeout; // For debouncing autocomplete

// Initialize the map
function initMap(lat, lon) {
  const mapElement = document.getElementById("map");

  if (map) map.remove(); // Remove existing map if any

  // Add the 'active' class to the map div
  mapElement.classList.add("active");

  // Initialize the Leaflet map
  map = L.map("map").setView([lat, lon], 10);

  // Add OpenStreetMap base layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  // Add OpenWeatherMap temperature overlay
  L.tileLayer("https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=aa8df9f67f60ea96f44926ebe7386386").addTo(map);

  // Add AQICN AQI overlay
  L.tileLayer("https://tiles.aqicn.org/tiles/usepa-aqi/{z}/{x}/{y}.png").addTo(map);
}

// Fetch data from SyncLoop endpoint
async function fetchWeatherData(city) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/weather?city=${encodeURIComponent(city)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

// Fetch autocomplete suggestions from GeoDB cities API
async function fetchAutocompleteSuggestions(query) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/autocomplete?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Autocomplete error:", error);
  }
}

// Display autocomplete suggestions
function displayAutocompleteSuggestions(suggestions) {
  autocompleteResults.innerHTML = "";
  suggestions.forEach((city) => {
    const div = document.createElement("div");
    div.textContent = `${city.city}, ${city.country}`;
    div.addEventListener("click", () => {
      cityInput.value = `${city.city}, ${city.country}`;
      autocompleteResults.innerHTML = "";
    });
    autocompleteResults.appendChild(div);
  });
}

// Debounce function for autocomplete
function debounce(func, delay) {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(func, delay);
}

// Handle city input with debounce
cityInput.addEventListener("input", () => {
  const query = cityInput.value.trim();
  if (query.length > 2) {
    debounce(async () => {
      const suggestions = await fetchAutocompleteSuggestions(query);
      displayAutocompleteSuggestions(suggestions);
    }, 200);
  } else {
    autocompleteResults.innerHTML = "";
  }
});

// Function to hide autocomplete results
function hideAutocompleteResults() {
  autocompleteResults.innerHTML = ""; // Clear the content
}

// Event listener for clicks on the document
document.addEventListener("click", (event) => {
  // Check if the click is outside the autocomplete-results div
  if (!autocompleteResults.contains(event.target)) {
    hideAutocompleteResults(); // Hide the div
  }
});



// Reset map height when the input is cleared
cityInput.addEventListener("input", () => {
  if (!cityInput.value.trim()) {
    const mapElement = document.getElementById("map");
    mapElement.classList.remove("active"); // Remove the 'active' class
    if (map) {
      map.remove(); // Remove the map instance
      map = null; // Reset the map variable
    }
  }
});

// voice input
voiceInputButton.addEventListener("click", () => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript; // Get the spoken text
    const cityName = extractCityName(transcript); // Extract the city name
    if (cityName) {
      cityInput.value = cityName; // Set the city name in the input field
    } else {
      alert("Could not detect a city name in your speech. Please try again.");
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    alert("Could not detect. Please try again.");
  };
});

// extract the city name from the transcript
function extractCityName(transcript) {
  // everything after city name is being interpreted as part of the city name...., can't be fixed due to regex's minimal greedy match
  const regex = /^(?:please\s*)?(?:show|get|find)?\s*(?:me\s*)?(?:weather\s*(?:of|for|in)?\s*)?(.+?)(?:\s*(?:'s)?\s*weather)?\s*$/i;
  const match = transcript.match(regex);

  if (match && match[1]) {
    const cityName = match[1].replace(/[^\w\s]/g, "").trim();
    return cityName;
  }
  return null;
}

let timeIntervalId;

function updateLocalTime(timeData) {
  if (timeIntervalId) clearInterval(timeIntervalId);

  if (timeData && timeData.formatted) {
    const initialTime = new Date(timeData.formatted).getTime();
    const timeZone = timeData.zoneName;

    timeIntervalId = setInterval(() => {
      const currentTime = new Date(initialTime + Date.now() - new Date(timeData.formatted).getTime());
      const formattedDate = currentTime.toLocaleDateString("en-US", {
        timeZone: timeZone,
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = currentTime.toLocaleString("en-US", {
        timeZone: timeZone,
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      });

      localTime.innerHTML = `
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>Place:</strong> ${timeData.cityName}, ${timeData.regionName}, ${timeData.countryName}</p>
        <p><strong>Timezone:</strong> ${timeData.zoneName} (${timeData.abbreviation})</p>
      `;
    }, 1000);
  } else {
    localTime.innerHTML = `<p>Local time data not available.</p>`;
  }
}

// Function to perform the search
async function performSearch() {
  historicalWeatherData.innerHTML = "";

  const city = cityInput.value.trim();
  if (city) {
    const weatherData = await fetchWeatherData(city);
    if (weatherData) {
      // Display current weather
      const current = weatherData.CurrentWeather;
      const iconUrl = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
      currentWeatherData.innerHTML = `
        <div class="current-weather">
          <img src="${iconUrl}" alt="${current.weather[0].description}">
          <p><strong>Temperature:</strong> ${current.main.temp}°C</p>
          <p><strong>Feels like:</strong> ${current.main.feels_like}°C</p>
          <p><strong>Condition:</strong> ${current.weather[0].main} (${current.weather[0].description})</p>
          <p><strong>Humidity:</strong> ${current.main.humidity}%</p>
          <p><strong>Wind Speed:</strong> ${current.wind.speed} m/s</p>
          <p><strong>Pressure:</strong> ${current.main.pressure} hPa</p>
        </div>
      `;

    // Function to group forecast data by day and calculate daily summary
    function getDailyForecastSummary(forecast) {
      // Group the forecast data by day (including current date now)
      const dailyForecast = forecast.reduce((acc, item) => {
        const date = item.dt_txt.split(" ")[0]; // Extract date (YYYY-MM-DD)
        if (!acc[date]) {
          acc[date] = {
            temps: [],
            weatherConditions: [],
            weatherIcons: [], // Store weather icons
            precipitationCount: 0, // Count of entries with precipitation
          };
        }
        acc[date].temps.push(item.main.temp);
        acc[date].weatherConditions.push(item.weather[0].main);
        acc[date].weatherIcons.push(item.weather[0].icon); // Add weather icon

        // Check for precipitation
        if (
          item.weather[0].main.toLowerCase().includes("rain") ||
          item.weather[0].main.toLowerCase().includes("drizzle") ||
          item.weather[0].main.toLowerCase().includes("snow")
        ) {
          acc[date].precipitationCount++;
        }

        return acc;
      }, {});

      // Calculate daily summary
      const dailySummary = Object.keys(dailyForecast).map((date) => {
        const temps = dailyForecast[date].temps;
        const weatherConditions = dailyForecast[date].weatherConditions;
        const weatherIcons = dailyForecast[date].weatherIcons;
        const precipitationCount = dailyForecast[date].precipitationCount;

        // Calculate average, min, and max temperature
        const avgTemp = (temps.reduce((sum, temp) => sum + temp, 0) / temps.length).toFixed(2);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);

        // Find dominant weather condition and icon
        const dominantWeather = weatherConditions.reduce((acc, condition) => {
          acc[condition] = (acc[condition] || 0) + 1;
          return acc;
        }, {});
        const dominantCondition = Object.keys(dominantWeather).reduce((a, b) =>
          dominantWeather[a] > dominantWeather[b] ? a : b
        );

        const dominantIcon = weatherIcons[weatherConditions.indexOf(dominantCondition)];
        const precipitationProbability = ((precipitationCount / temps.length) * 100).toFixed(0);

        // Format the date in long format
        const longDate = new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return {
          date: longDate,
          avgTemp,
          minTemp,
          maxTemp,
          dominantCondition,
          dominantIcon,
          precipitationProbability,
        };
      });

      return dailySummary;
    }

    // Display daily forecast summary
    const forecast = weatherData.Forecast_5days_3hrs.list;
    const dailySummary = getDailyForecastSummary(forecast);

    forecastData.innerHTML = dailySummary
      .map(
        (day) => `
          <div class="daily-forecast">
            <h3>${day.date}</h3>
            <img src="https://openweathermap.org/img/wn/${day.dominantIcon}@2x.png" alt="${day.dominantCondition}">
            <p>Avg Temp: ${day.avgTemp}°C</p>
            <p>Min Temp: ${day.minTemp}°C</p>
            <p>Max Temp: ${day.maxTemp}°C</p>
            <p>Condition: ${day.dominantCondition}</p>
            <p>Precipitation: ${day.precipitationProbability}%</p>
          </div>
        `
      )
      .join("");


        // Display complete AQI data with proper units
        const airPollutionData = weatherData.AirPollution.list[0];
        const aqi = airPollutionData.main.aqi;
        const components = airPollutionData.components;

        aqiData.innerHTML = `
          <p><strong>Air Quality Index (AQI):</strong> ${aqi} out of 5 (${getAQIDescription(aqi)})</p>
          <p><strong>Ozone (O₃):</strong> ${components.o3} µg/m³</p>
          <p><strong>Particulate Matter (PM2.5):</strong> ${components.pm2_5} µg/m³</p>
          <p><strong>Particulate Matter (PM10):</strong> ${components.pm10} µg/m³</p>
        `;

        // Function to describe AQI levels
        function getAQIDescription(aqi) {
          switch (aqi) {
            case 1:
              return "Good ✅ - Air quality is satisfactory with little or no risk";
            case 2:
              return "Fair 🙂 - Acceptable air quality, minor risks for sensitive individuals";
            case 3:
              return "Moderate 😐 - Sensitive groups may experience health effects";
            case 4:
              return "Poor 😷 - Health effects for general public, serious for sensitive groups";
            case 5:
              return "Very Poor 🛑 - Serious health effects, everyone may be affected";
            default:
              return "Unknown";
          }
        }
        
      // Display and update local time dynamically
      const timeData = weatherData.Time;
      updateLocalTime(timeData);


      // Initialize map with coordinates
      const { lat, lon } = weatherData.AirPollution.coord;
      initMap(lat, lon);
    }
  }
};

// Handle search button click
searchButton.addEventListener("click",async () => {
  await performSearch();
});

// Handle "Enter" key press in the input field
cityInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    await performSearch();
  }
});

// Handle historical data fetch
fetchHistoryButton.addEventListener("click", async () => {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  historicalWeatherData.innerHTML = "";

  if (!startDate || !endDate) {
    historicalWeatherData.innerHTML = "<p>Please select both start and end dates.</p>";
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    historicalWeatherData.innerHTML = "<p>Start date must be before the end date.</p>";
    return;
  }

  try {
    historicalWeatherData.innerHTML = "<p>Loading historical data...</p>";
    const weatherData = await fetchWeatherData(cityInput.value.trim());
    const { lat, lon } = weatherData.AirPollution.coord;

    const response = await fetch(
      `${BACKEND_URL}/api/history?lat=${lat}&lon=${lon}&start=${startDate}&end=${endDate}`
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    // Render historical data horizontally
    historicalWeatherData.innerHTML = `
      <div class="historical-container">
        ${data.daily.time
          .map((date, index) => {
            const longDate = new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return `
              <div class="historical-entry">
                <p><strong>${longDate}</strong></p>
                <p><strong>Max Temp:</strong> ${data.daily.temperature_2m_max[index]}°C</p>
                <p><strong>Min Temp:</strong> ${data.daily.temperature_2m_min[index]}°C</p>
                <p><strong>Precipitation:</strong> ${data.daily.precipitation_sum[index]} mm</p>
                <p><strong>Max Wind Speed:</strong> ${data.daily.windspeed_10m_max[index]} km/h</p>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  } catch (error) {
    console.error(error);
    historicalWeatherData.innerHTML = "<p>Error fetching historical data. Please try again later.</p>";
  }
});