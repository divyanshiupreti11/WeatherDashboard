// Switched to Open-Meteo (no API key required)
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const cityName = document.getElementById("cityName");
const date = document.getElementById("date");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const forecastContainer = document.getElementById("forecastContainer");
const errorMsg = document.getElementById("errorMsg");
const feelsLike = document.getElementById("feelsLike");
const visibility = document.getElementById("visibility");
const pressure = document.getElementById("pressure");
const clouds = document.getElementById("clouds");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const travelAdvice = document.getElementById("travelAdvice");

async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.results || json.results.length === 0) throw new Error("City not found");
  const r = json.results[0];
  return { name: r.name, country: r.country_code, lat: r.latitude, lon: r.longitude, timezone: r.timezone };
}

async function getWeatherAndForecast(lat, lon, placeLabel) {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: [
        "temperature_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "relative_humidity_2m",
        "pressure_msl",
        "visibility"
      ].join(','),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "sunrise",
        "sunset"
      ].join(','),
      timezone: "auto",
      windspeed_unit: "kmh",
      temperature_unit: "celsius"
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.current) throw new Error("Weather unavailable");
    errorMsg.textContent = "";
    displayWeatherFromOpenMeteo(data, placeLabel);
    displayForecastFromOpenMeteo(data);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "❌ " + (err.message || "Failed to fetch weather");
  }
}

function displayWeatherFromOpenMeteo(apiData, placeLabel) {
  // Labels
  cityName.textContent = placeLabel;
  date.textContent = new Date().toDateString();

  // Current
  const c = apiData.current;
  const daily = apiData.daily;

  temperature.textContent = `${Math.round(c.temperature_2m)} °C`;
  const conditionText = mapWeatherCodeToText(c.weather_code);
  condition.textContent = conditionText;
  humidity.textContent = (c.relative_humidity_2m ?? '-') + "%";
  wind.textContent = Math.round(c.wind_speed_10m) + " km/h";

  // Icon
  weatherIcon.src = svgEmojiIconSrc(mapWeatherCodeToEmoji(c.weather_code));
  weatherIcon.alt = conditionText;

  // Extra details
  feelsLike.textContent = `${Math.round(c.apparent_temperature)} °C`;
  if (typeof c.visibility === 'number') {
    visibility.textContent = (c.visibility / 1000).toFixed(1) + " km";
  } else {
    visibility.textContent = "-- km";
  }
  pressure.textContent = (c.pressure_msl ?? '-') + " hPa";
  clouds.textContent = apiData.current.cloud_cover ? apiData.current.cloud_cover + "%" : "--%";

  // Sunrise/Sunset
  if (daily && daily.sunrise && daily.sunrise.length) {
    sunrise.textContent = new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    sunset.textContent = new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Travel recommendation
  travelAdvice.textContent = getTravelAdviceFromOpenMeteo(c);
  travelAdvice.className = "advice " + getAdviceSeverityClassFromOpenMeteo(c);
}

function displayForecastFromOpenMeteo(apiData) {
  forecastContainer.innerHTML = "";
  const d = apiData.daily;
  if (!d || !d.time) return;

  for (let i = 0; i < Math.min(5, d.time.length); i++) {
    const day = new Date(d.time[i]);
    const div = document.createElement("div");
    div.classList.add("forecast-item");
    const emoji = mapWeatherCodeToEmoji(d.weather_code[i]);
    const icon = svgEmojiIconSrc(emoji);
    div.innerHTML = `
      <p>${day.toDateString().split(" ")[0]}</p>
      <img src="${icon}" alt="${mapWeatherCodeToText(d.weather_code[i])}">
      <p>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</p>
    `;
    forecastContainer.appendChild(div);
  }
}

// Search by city
searchBtn.addEventListener("click", async () => {
  const city = cityInput.value.trim();
  if (!city) {
    errorMsg.textContent = "⚠️ Please enter a city name!";
    return;
  }
  try {
    const geo = await geocodeCity(city);
    await getWeatherAndForecast(geo.lat, geo.lon, `${geo.name}, ${geo.country}`);
  } catch (e) {
    errorMsg.textContent = "❌ " + (e.message || "City not found");
  }
});

// Enter to search
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchBtn.click();
  }
});

// Auto-detect OR fallback to Delhi
window.addEventListener("load", async () => {
  const fallbackCity = "Delhi";
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        await getWeatherAndForecast(latitude, longitude, "Your location");
      }, async () => {
        const geo = await geocodeCity(fallbackCity);
        await getWeatherAndForecast(geo.lat, geo.lon, `${geo.name}, ${geo.country}`);
      });
    } else {
      const geo = await geocodeCity(fallbackCity);
      await getWeatherAndForecast(geo.lat, geo.lon, `${geo.name}, ${geo.country}`);
    }
  } catch (e) {
    errorMsg.textContent = "❌ " + (e.message || "Failed to load weather");
  }
});

// --- Utilities ---
function mapWeatherCodeToText(code) {
  const m = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
  };
  return m[code] || "Unknown";
}

function mapWeatherCodeToEmoji(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function svgEmojiIconSrc(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>
      <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-size='64'>${emoji}</text>
    </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

function getTravelAdviceFromOpenMeteo(c) {
  const temp = c.temperature_2m;
  const windKmh = c.wind_speed_10m;
  const thunder = false; // not directly provided
  const veryWindy = windKmh >= 50;
  const freezing = temp <= 0;
  const veryHot = temp >= 38;

  if (thunder || veryWindy) return "Not recommended: Stormy or very windy conditions expected.";
  if (freezing) return "Caution: Freezing temperatures may cause icy roads.";
  if (veryHot) return "Caution: Very hot. Stay hydrated and limit sun exposure.";
  return "Good to go: Weather looks favorable for travel.";
}

function getAdviceSeverityClassFromOpenMeteo(c) {
  const text = getTravelAdviceFromOpenMeteo(c);
  if (text.startsWith("Not recommended") || text.startsWith("Avoid")) return "bad";
  if (text.startsWith("Caution")) return "warn";
  return "good";
}
