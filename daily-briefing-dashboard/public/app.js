// Client-side Application Controller

// State Management
const STATE = {
  location: {
    name: "Bengaluru",
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: "Asia/Kolkata"
  },
  weather: null,
  calendarEvents: [],
  stocks: [],
  activeBrokerFilter: "all",
  mcpConnected: false,
  stocksSort: {
    key: null,
    direction: "asc"
  }
};

// DOM Elements
const DOM = {
  greetingText: document.getElementById("greeting-text"),
  dateText: document.getElementById("date-text"),
  digitalClock: document.getElementById("digital-clock"),
  clockPeriod: document.getElementById("clock-period"),
  refreshBtn: document.getElementById("refresh-btn"),
  mcpStatusDot: document.getElementById("mcp-status-dot"),
  mcpStatusText: document.getElementById("mcp-status-text"),
  
  // Weather
  locationName: document.getElementById("location-name"),
  changeLocationBtn: document.getElementById("change-location-btn"),
  weatherContent: document.getElementById("weather-content"),
  
  // Settings Button and Dialog
  settingsBtn: document.getElementById("settings-btn"),
  settingsDialog: document.getElementById("settings-dialog"),
  settingsLocationForm: document.getElementById("settings-location-form"),
  settingsCityInput: document.getElementById("settings-city-input"),
  tabGeneral: document.getElementById("tab-general"),
  tabContentGeneral: document.getElementById("settings-tab-content-general"),

  // Calendar
  calendarContent: document.getElementById("calendar-content"),
  calendarCount: document.getElementById("calendar-count"),
  
  // Stocks
  stocksRefreshBtn: document.getElementById("stocks-refresh-btn"),
  stocksRefreshIcon: document.getElementById("stocks-refresh-icon"),
  stocksSummary: document.getElementById("stocks-summary"),
  stocksContent: document.getElementById("stocks-content"),
  stocksFooter: document.getElementById("stocks-footer"),
  totalInvested: document.getElementById("total-invested"),
  totalValue: document.getElementById("total-value"),
  totalPnl: document.getElementById("total-pnl"),
  brokerFilterBar: document.getElementById("broker-filter-bar"),
  
  // Celebrations
  celebrationsContent: document.getElementById("celebrations-content"),
  celebrationsCount: document.getElementById("celebrations-count"),
};

// ─── Event Listeners ────────────────────────────────────────────────────────
function setupEventListeners() {
  if (DOM.refreshBtn) {
    DOM.refreshBtn.addEventListener("click", refreshData);
  }
  
  if (DOM.stocksRefreshBtn) {
    DOM.stocksRefreshBtn.addEventListener("click", refreshStocks);
  }
  
  if (DOM.changeLocationBtn) {
    DOM.changeLocationBtn.addEventListener("click", () => {
      if (DOM.settingsDialog) DOM.settingsDialog.showModal();
    });
  }
  
  if (DOM.settingsBtn) {
    DOM.settingsBtn.addEventListener("click", () => {
      if (DOM.settingsDialog) DOM.settingsDialog.showModal();
    });
  }
  
  if (DOM.settingsLocationForm) {
    DOM.settingsLocationForm.addEventListener("submit", handleLocationChange);
  }
  
  if (DOM.settingsDialog) {
    DOM.settingsDialog.querySelectorAll(".close-dialog-btn").forEach(btn => {
      btn.addEventListener("click", () => DOM.settingsDialog.close());
    });
    DOM.settingsDialog.addEventListener("click", (e) => {
      if (e.target === DOM.settingsDialog) {
        DOM.settingsDialog.close();
      }
    });
  }
}

// ─── Clock & Greeting ───────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const period = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  if (DOM.digitalClock) {
    DOM.digitalClock.textContent = `${hoursStr}:${minutes}:${seconds}`;
  }
  if (DOM.clockPeriod) {
    DOM.clockPeriod.textContent = period;
  }
  
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  try {
    DOM.dateText.textContent = new Intl.DateTimeFormat([], dateOptions).format(now);
  } catch (e) {
    DOM.dateText.textContent = now.toLocaleDateString(undefined, dateOptions);
  }
}

function updateGreeting() {
  const hr = new Date().getHours();
  let text = "Welcome back";
  if (hr >= 5 && hr < 12) text = "Good morning";
  else if (hr >= 12 && hr < 17) text = "Good afternoon";
  else if (hr >= 17 && hr < 22) text = "Good evening";
  else text = "Good night";
  
  if (DOM.greetingText) {
    DOM.greetingText.textContent = text;
  }
}

// ─── Location & Geocoding ───────────────────────────────────────────────────
async function loadLocation() {
  const saved = localStorage.getItem("dashboard-location");
  if (saved) {
    try {
      STATE.location = JSON.parse(saved);
      if (DOM.locationName) DOM.locationName.textContent = STATE.location.name;
      updateGreeting();
      refreshData();
      return;
    } catch (e) {}
  }
  
  try {
    if (DOM.locationName) DOM.locationName.textContent = "Detecting IP location...";
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("Location service unavailable");
    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      STATE.location = {
        name: `${data.city}, ${data.country_code}`,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone || "Asia/Kolkata"
      };
      localStorage.setItem("dashboard-location", JSON.stringify(STATE.location));
    }
  } catch (error) {
    console.warn("IP Geolocation failed. Using default location:", error);
  } finally {
    if (DOM.locationName) DOM.locationName.textContent = STATE.location.name;
    updateGreeting();
    refreshData();
  }
}

async function handleLocationChange(e) {
  e.preventDefault();
  const city = DOM.settingsCityInput.value.trim();
  if (!city) return;
  
  if (DOM.locationName) DOM.locationName.textContent = "Searching...";
  
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!r.ok) throw new Error("Geocoding failed");
    const data = await r.json();
    if (!data.results || data.results.length === 0) throw new Error("Location not found");
    
    const result = data.results[0];
    STATE.location = {
      name: `${result.name}, ${result.country}`,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || "Asia/Kolkata"
    };
    
    localStorage.setItem("dashboard-location", JSON.stringify(STATE.location));
    DOM.settingsDialog.close();
  } catch (err) {
    alert(`Could not find location: ${err.message}`);
  } finally {
    if (DOM.locationName) DOM.locationName.textContent = STATE.location.name;
    updateGreeting();
    refreshData();
  }
}

// ─── Weather Card ──────────────────────────────────────────────────────────
async function fetchWeather() {
  try {
    const location = STATE.location.name || "Bengaluru";
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    const parsed = parseMcpWeatherResponse(data);
    renderWeather(parsed);
  } catch (error) {
    console.error("Error fetching weather:", error);
    if (DOM.weatherContent) {
      DOM.weatherContent.innerHTML = getMcpOfflineHTML("Weather");
    }
  }
}

function parseMcpWeatherResponse(rawResponse) {
  const text = rawResponse.content?.[0]?.text || "";
  
  const conditionMatch = text.match(/\*\*Condition:\*\* (.*)/i);
  const tempMatch = text.match(/\*\*Temperature:\*\* (.*)/i);
  const feelsMatch = text.match(/\*\*Feels Like:\*\* (.*)/i);
  const humidityMatch = text.match(/\*\*Humidity:\*\* (.*)/i);
  const precipMatch = text.match(/\*\*Precipitation:\*\* (.*)/i);
  const windMatch = text.match(/\*\*Wind Speed:\*\* (.*)/i);
  const locationMatch = text.match(/Weather for \*\*(.*?)\*\*/i);
  
  return {
    condition: conditionMatch ? conditionMatch[1].trim() : "Unknown",
    temp: tempMatch ? tempMatch[1].trim() : "--",
    feelsLike: feelsMatch ? feelsMatch[1].trim() : "--",
    humidity: humidityMatch ? humidityMatch[1].trim() : "--",
    precip: precipMatch ? precipMatch[1].trim() : "--",
    wind: windMatch ? windMatch[1].trim() : "--",
    location: locationMatch ? locationMatch[1].trim() : STATE.location.name
  };
}

function getWeatherDetailsFromDesc(descText, isDay) {
  const desc = descText.toLowerCase();
  
  const iconSunny = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="5" stroke="#f59e0b" stroke-width="2" fill="#fef08a" />
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  
  const iconNight = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#38bdf8" stroke-width="2" fill="#bae6fd" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;

  const iconCloudy = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#94a3b8" stroke-width="2" fill="#cbd5e1" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
  
  const iconPartlyCloudy = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.4 15.6A6 6 0 1 0 11 8H10.3A5 5 0 1 0 6 13h12a3 3 0 0 0 .4-2.6" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" />
    <circle cx="16" cy="7" r="3" stroke="#f59e0b" stroke-width="1.5" fill="#fef08a" />
  </svg>`;
  
  const iconRain = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" stroke-width="2" fill="#94a3b8" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M8 18v2M12 19v2M16 18v2" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
  </svg>`;
  
  const iconSnow = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" stroke-width="2" fill="#e2e8f0" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M8 18h.01M12 19h.01M16 18h.01" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
  </svg>`;
  
  const iconStorm = `<svg class="weather-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 10h-1.26A8 8 0 1 0 9 15h9a5 5 0 0 0 0-10z" stroke="#64748b" stroke-width="2" fill="#94a3b8" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M13 17l-2 3h3l-1 3" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;

  if (desc.includes("thunder") || desc.includes("storm")) return { icon: iconStorm };
  if (desc.includes("snow") || desc.includes("sleet") || desc.includes("ice")) return { icon: iconSnow };
  if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower") || desc.includes("precipitation")) return { icon: iconRain };
  if (desc.includes("cloud") || desc.includes("overcast") || desc.includes("mist") || desc.includes("fog") || desc.includes("haze")) {
    return desc.includes("partly") ? { icon: iconPartlyCloudy } : { icon: iconCloudy };
  }
  if (desc.includes("clear") || desc.includes("sunny")) {
    return isDay ? { icon: iconSunny } : { icon: iconNight };
  }
  return { icon: isDay ? iconSunny : iconNight };
}

function renderWeather(data) {
  if (!DOM.weatherContent) return;
  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18;
  const { icon } = getWeatherDetailsFromDesc(data.condition, isDay);
  
  const tempVal = data.temp.replace(/[^\d.\-]/g, "");
  
  DOM.weatherContent.innerHTML = `
    <div class="weather-main-grid">
      <div class="weather-primary">
        <div class="weather-temp-row">
          <span class="weather-temp">${tempVal}</span>
          <span class="weather-unit">°C</span>
        </div>
        <div class="weather-desc">${escHtml(data.condition)}</div>
        <div class="weather-feels">Feels like ${escHtml(data.feelsLike)}</div>
      </div>
      <div class="weather-visual">
        ${icon}
      </div>
    </div>
    
    <div class="weather-metrics-grid">
      <div class="metric-item">
        <span class="metric-label">Wind Speed</span>
        <span class="metric-val">${escHtml(data.wind)}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">Humidity</span>
        <span class="metric-val">${escHtml(data.humidity)}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">Precipitation</span>
        <span class="metric-val">${escHtml(data.precip)}</span>
      </div>
    </div>
  `;
}

// ─── Calendar Card ──────────────────────────────────────────────────────────
async function fetchCalendar() {
  try {
    const response = await fetch("/api/calendar?daysAhead=1&maxResults=15");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    const events = parseMcpCalendarResponse(data);
    renderCalendar(events);
  } catch (error) {
    console.error("Error fetching calendar:", error);
    if (DOM.calendarContent) {
      DOM.calendarContent.innerHTML = getMcpOfflineHTML("Calendar");
    }
    if (DOM.calendarCount) DOM.calendarCount.textContent = "unavailable";
  }
}

function parseMcpCalendarResponse(rawResponse) {
  if (rawResponse.isError) {
    throw new Error(rawResponse.content?.[0]?.text || "Unknown MCP Error");
  }
  
  const text = rawResponse.content?.[0]?.text || "";
  if (text.includes("No events scheduled") || text.trim() === "") {
    return [];
  }
  
  const events = [];
  const rawEvents = text.split("• ").slice(1);
  
  for (const rawEv of rawEvents) {
    const lines = rawEv.split("\n");
    const titleMatch = lines[0].match(/\*\*(.*?)\*\*/);
    const title = titleMatch ? titleMatch[1] : "Untitled Event";
    
    let start = null;
    let end = null;
    let location = "";
    let description = "";
    
    for (const line of lines) {
      if (line.includes("**Start:**")) {
        const rawStart = line.replace(/.*?\*\*Start:\*\*\s*/, "").trim();
        start = parseIsoDateString(rawStart);
      }
      if (line.includes("**End:**")) {
        const rawEnd = line.replace(/.*?\*\*End:\*\*\s*/, "").trim();
        end = parseIsoDateString(rawEnd);
      }
      if (line.includes("**Location:**")) {
        location = line.replace(/.*?\*\*Location:\*\*\s*/, "").trim();
      }
      if (line.includes("**Description:**")) {
        description = line.replace(/.*?\*\*Description:\*\*\s*/, "").trim();
      }
    }
    
    events.push({
      title,
      start,
      end,
      location,
      description
    });
  }
  return events;
}

function renderCalendar(events) {
  const el = DOM.calendarContent;
  if (!el) return;
  
  if (!Array.isArray(events) || events.length === 0) {
    if (DOM.calendarCount) DOM.calendarCount.textContent = "0 events";
    el.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h4>Clear Day Ahead</h4>
        <p>No calendar events scheduled for today.</p>
      </div>
    `;
    return;
  }
  
  if (DOM.calendarCount) {
    DOM.calendarCount.textContent = `${events.length} event${events.length > 1 ? 's' : ''}`;
  }
  
  const now = new Date();
  let html = `<div class="calendar-timeline">`;
  
  events.forEach(event => {
    let statusClass = "upcoming";
    let statusLabel = "Upcoming";
    
    if (event.start && event.end) {
      if (now > event.end) {
        statusClass = "passed";
        statusLabel = "Passed";
      } else if (now >= event.start && now <= event.end) {
        statusClass = "ongoing";
        statusLabel = "Ongoing";
      }
    }
    
    const timeStr = event.start && event.end
      ? `${formatEventTime(event.start)} - ${formatEventTime(event.end)}`
      : "All Day";
      
    const locationHTML = event.location
      ? `<div class="event-loc">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="12" height="12">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span>${escHtml(event.location)}</span>
        </div>`
      : "";
      
    const descHTML = event.description
      ? `<div class="event-desc">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="12" height="12">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>${escHtml(event.description)}</span>
        </div>`
      : "";
      
    html += `
      <div class="event-item ${statusClass}">
        <span class="event-dot"></span>
        <div class="event-time">
          <span>${timeStr}</span>
          <span class="event-status-tag">${statusLabel}</span>
        </div>
        <div class="event-title">${escHtml(event.title)}</div>
        ${locationHTML}
        ${descHTML}
      </div>
    `;
  });
  
  html += `</div>`;
  el.innerHTML = html;
}

// ─── Stocks Card ────────────────────────────────────────────────────────────
async function fetchStocks() {
  try {
    const response = await fetch("/api/stocks");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    STATE.stocks = parseMcpStocksResponse(data);
    renderBrokerTabs();
    renderStocksGrid();
  } catch (error) {
    console.error("Error fetching stocks:", error);
    if (DOM.stocksContent) {
      DOM.stocksContent.innerHTML = getMcpOfflineHTML("Stocks Portfolio");
    }
    if (DOM.stocksSummary) DOM.stocksSummary.textContent = "unavailable";
    if (DOM.stocksFooter) DOM.stocksFooter.style.display = "none";
  }
}

async function refreshStocks() {
  if (!DOM.stocksRefreshBtn || DOM.stocksRefreshBtn.disabled) return;

  DOM.stocksRefreshBtn.disabled = true;
  if (DOM.stocksRefreshIcon) DOM.stocksRefreshIcon.classList.add("spin");

  try {
    await fetchStocks();
  } finally {
    DOM.stocksRefreshBtn.disabled = false;
    if (DOM.stocksRefreshIcon) DOM.stocksRefreshIcon.classList.remove("spin");
  }
}

function parseMcpStocksResponse(rawResponse) {
  if (rawResponse.isError) {
    throw new Error(rawResponse.content?.[0]?.text || "Unknown MCP Error");
  }

  const text = rawResponse.content?.[0]?.text || "";

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
  if (lines.length < 3) return [];

  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("broker")) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx === -1) return [];

  const headers = lines[headerLineIdx]
    .split("|")
    .map(h => h.trim().toLowerCase())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

  const colIdx = {
    broker:       findColIndex(headers, ["broker"]),
    investDate:   findColIndex(headers, ["invest date", "date", "purchase date", "buy date"]),
    symbol:       findColIndex(headers, ["exchange:symbol", "symbol", "stock", "ticker"]),
    qty:          findColIndex(headers, ["qty", "quantity", "shares", "units"]),
    rate:         findColIndex(headers, ["rate"]),
    buy:          findColIndex(headers, ["buy"]),
    currentPrice: findColIndex(headers, ["current price", "current"]),
    pnlAmt:       findColIndex(headers, ["p&l", "pnl"]),
    pnlPct:       findColIndex(headers, ["% change", "change", "%"]),
  };

  const dataStart = headerLineIdx + 2;
  const stocks = [];

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i]
      .split("|")
      .map(c => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length === 0) continue;

    const get = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : "");
    const toNum = (s) => parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0;

    const broker = get(colIdx.broker);
    if (!broker || broker === "") continue;

    const rawSymbol = get(colIdx.symbol);
    const symbol = rawSymbol.includes(":") ? rawSymbol.split(":")[1] : rawSymbol;
    const exchange = rawSymbol.includes(":") ? rawSymbol.split(":")[0] : "NSE";
    if (!symbol) continue;

    const qty          = toNum(get(colIdx.qty));
    const rate         = toNum(get(colIdx.rate));
    const buyTotal     = toNum(get(colIdx.buy));
    const currentPrice = toNum(get(colIdx.currentPrice));
    const pnlAmtRaw    = toNum(get(colIdx.pnlAmt));
    const pnlPctRaw    = toNum(get(colIdx.pnlPct));

    const rawDate    = get(colIdx.investDate);
    const investDate = parseSheetDate(rawDate);
    const investedDays = investDate
      ? Math.floor((Date.now() - investDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const invested = buyTotal   > 0 ? buyTotal   : qty * rate;
    const current  = currentPrice > 0 ? qty * currentPrice : 0;
    const pnlAmt   = pnlAmtRaw  !== 0 ? pnlAmtRaw  : current - invested;
    const pnlPct   = pnlPctRaw  !== 0 ? pnlPctRaw  : (invested > 0 ? (pnlAmt / invested) * 100 : 0);

    let priceStatus = "neutral";
    if (currentPrice > rate && rate > 0) priceStatus = "up";
    if (currentPrice < rate && rate > 0) priceStatus = "down";

    stocks.push({
      broker, symbol, exchange, qty, rate, currentPrice,
      invested, current, pnlAmt, pnlPct, priceStatus, investedDays
    });
  }

  return stocks;
}

function renderBrokerTabs() {
  const bar = DOM.brokerFilterBar;
  if (!bar) return;
  
  const brokers = Array.from(new Set(STATE.stocks.map(s => s.broker))).filter(Boolean);
  
  let html = `<button class="broker-tab ${STATE.activeBrokerFilter === 'all' ? 'active' : ''}" data-broker="all">All Brokers</button>`;
  brokers.forEach(b => {
    html += `<button class="broker-tab ${STATE.activeBrokerFilter === b ? 'active' : ''}" data-broker="${escHtml(b)}">${escHtml(b)}</button>`;
  });
  
  bar.innerHTML = html;
  
  bar.querySelectorAll(".broker-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      STATE.activeBrokerFilter = btn.getAttribute("data-broker");
      renderBrokerTabs();
      renderStocksGrid();
    });
  });
}

function renderStocksGrid() {
  const el = DOM.stocksContent;
  if (!el) return;
  
  let filtered = STATE.activeBrokerFilter === "all"
    ? STATE.stocks
    : STATE.stocks.filter(s => s.broker === STATE.activeBrokerFilter);

  // Apply sorting
  if (STATE.stocksSort.key) {
    const key = STATE.stocksSort.key;
    const dir = STATE.stocksSort.direction === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      
      // Handle null/undefined values
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * dir;
      }
      return (valA - valB) * dir;
    });
  }
    
  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h4>No Holdings</h4>
        <p>No stock holdings found for this selection.</p>
      </div>
    `;
    if (DOM.stocksFooter) DOM.stocksFooter.style.display = "none";
    return;
  }

  const getSortIndicator = (key) => {
    if (STATE.stocksSort.key !== key) return "";
    return STATE.stocksSort.direction === "asc" ? " ▲" : " ▼";
  };
  
  let html = `
    <div class="stocks-table-wrapper">
      <table class="stocks-table">
        <thead>
          <tr>
            <th onclick="sortStocks('broker')" class="sortable-header">Broker${getSortIndicator('broker')}</th>
            <th onclick="sortStocks('symbol')" class="sortable-header">Symbol${getSortIndicator('symbol')}</th>
            <th onclick="sortStocks('qty')" class="sortable-header">Qty${getSortIndicator('qty')}</th>
            <th onclick="sortStocks('currentPrice')" class="sortable-header">Current Price${getSortIndicator('currentPrice')}</th>
            <th onclick="sortStocks('pnlPct')" class="sortable-header">P&amp;L %${getSortIndicator('pnlPct')}</th>
            <th onclick="sortStocks('investedDays')" class="sortable-header">Invested Days${getSortIndicator('investedDays')}</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  filtered.forEach(stock => {
    const pnlSign = stock.pnlAmt >= 0 ? "+" : "";
    const pnlClass = stock.pnlAmt > 0 ? "pnl-up" : stock.pnlAmt < 0 ? "pnl-down" : "pnl-neutral";
    const priceClass = stock.priceStatus === "up" ? "price-up" : stock.priceStatus === "down" ? "price-down" : "price-neutral";
    const priceArrow = stock.priceStatus === "up" ? "▲" : stock.priceStatus === "down" ? "▼" : "•";
    
    html += `
      <tr class="stock-row">
        <td><span class="broker-badge">${escHtml(stock.broker)}</span></td>
        <td>
          <div class="symbol-cell">
            <span class="symbol-text">${escHtml(stock.symbol)}</span>
            ${stock.exchange ? `<span class="exchange-tag">${escHtml(stock.exchange)}</span>` : ""}
          </div>
        </td>
        <td class="qty-cell">${formatNum(stock.qty, 0)}</td>
        <td>
          <div class="price-cell">
            <span class="price-chip ${priceClass}">
              <span class="price-arrow">${priceArrow}</span> ${formatCurrency(stock.currentPrice)}
            </span>
            <span class="buy-rate-label">Avg: ${formatCurrency(stock.rate)}</span>
          </div>
        </td>
        <td>
          <div class="pnl-cell">
            <span class="pnl-pct ${pnlClass}">${pnlSign}${formatNum(stock.pnlPct, 2)}%</span>
            <span class="pnl-abs-val ${pnlClass}">${pnlSign}${formatCurrency(Math.abs(stock.pnlAmt))}</span>
          </div>
        </td>
        <td class="days-cell">
          ${stock.investedDays !== null
            ? `<span class="days-chip">${stock.investedDays} days</span>`
            : '<span class="days-na">—</span>'}
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  el.innerHTML = html;
  
  if (DOM.stocksSummary) {
    DOM.stocksSummary.textContent = `${STATE.stocks.length} holding${STATE.stocks.length > 1 ? 's' : ''}`;
  }
  
  renderStocksFooter(STATE.stocks);
}

window.sortStocks = function(key) {
  if (STATE.stocksSort.key === key) {
    STATE.stocksSort.direction = STATE.stocksSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    STATE.stocksSort.key = key;
    STATE.stocksSort.direction = 'asc';
  }
  renderStocksGrid();
};

function renderStocksFooter(stocks) {
  const footer = DOM.stocksFooter;
  if (!footer) return;
  
  const totalInvested = stocks.reduce((sum, s) => sum + s.invested, 0);
  const totalCurrent = stocks.reduce((sum, s) => sum + s.current, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  
  const pnlSign = totalPnl >= 0 ? "+" : "";
  const pnlClass = totalPnl > 0 ? "val-up" : totalPnl < 0 ? "val-down" : "";
  
  if (DOM.totalInvested) DOM.totalInvested.textContent = formatCurrency(totalInvested);
  if (DOM.totalValue) DOM.totalValue.textContent = formatCurrency(totalCurrent);
  
  if (DOM.totalPnl) {
    DOM.totalPnl.textContent = `${pnlSign}${formatCurrency(Math.abs(totalPnl))} (${pnlSign}${formatNum(totalPnlPct, 2)}%)`;
    DOM.totalPnl.className = `pnl-value ${pnlClass}`;
  }
  
  footer.style.display = "flex";
}

// ─── Celebrations Card ────────────────────────────────────────────────────────

const BIRTHDAY_GIFS = [
  "https://media.giphy.com/media/26xBI74a9wVMYFNCY/giphy.gif",
  "https://media.giphy.com/media/l4FGuhL4U2Ap5DQKY/giphy.gif",
  "https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif",
];
const ANNIVERSARY_GIFS = [
  "https://media.giphy.com/media/3oz8xRtfn10QxuFPdC/giphy.gif",
  "https://media.giphy.com/media/l0HlMSvdSJQT3TUNI/giphy.gif",
];

function getBirthdayMessages(name) {
  return [
    `🎂 Happy Birthday, ${name}! 🎉\nWishing you a day filled with joy, laughter, and love. May this new year of your life bring you endless happiness and all your dreams come true! 🌟`,
    `🎈 Many happy returns of the day, ${name}! 🥳\nHope your special day is absolutely amazing! Wishing you all the love, fun, and celebration you deserve. Enjoy every moment! 🎁✨`,
    `🎂 Wishing you a very Happy Birthday, ${name}!\nMay all your birthday wishes come true and may this year be your best one yet. Have a wonderful, joy-filled day! 🥂🎊`,
  ];
}

function getAnniversaryMessages(name, subType) {
  if (subType === "work-anniversary") {
    return [
      `🎉 Happy Work Anniversary, ${name}! 👏\nYour dedication and hard work make such a difference every single day. Wishing you continued success and many more wonderful years ahead!`,
      `🏆 Congratulations on your work anniversary, ${name}!\nThank you for everything you bring to the table. Here's to many more years of growth and achievement! 💫`,
      `⭐ Happy work milestone, ${name}! 🎊\nTime flies when you're making an impact. Wishing you more success, growth, and amazing opportunities ahead!`,
    ];
  }
  return [
    `💕 Happy Anniversary, ${name}! 🥂\nWishing you a beautiful day filled with love and cherished memories. May your bond grow stronger and more beautiful with each passing year! ❤️`,
    `🌹 Congratulations on your anniversary, ${name}!\nMay your love story continue to inspire everyone around you. Here's to many more wonderful years together! 👑`,
    `💖 Happy Anniversary, ${name}! 🎊\nMay this special day be filled with beautiful moments and blessings for the beautiful journey ahead together! 🌊`,
  ];
}

function renderCelebrations(celebrations) {
  const el = DOM.celebrationsContent;
  const countEl = DOM.celebrationsCount;
  if (!el) return;

  if (!Array.isArray(celebrations) || celebrations.length === 0) {
    if (countEl) countEl.textContent = "none today";
    el.innerHTML = `
      <div class="no-celebrations">
        <span class="no-cel-icon">🌞</span>
        <p>No birthdays or anniversaries today.</p>
        <p class="no-cel-sub">Enjoy your day!</p>
      </div>`;
    return;
  }

  if (countEl) countEl.textContent = `${celebrations.length} today`;

  el.innerHTML = celebrations.map((cel, idx) => {
    const isBirthday = cel.type === "birthday";
    const gifs = isBirthday ? BIRTHDAY_GIFS : ANNIVERSARY_GIFS;
    const gif = gifs[idx % gifs.length];
    const messages = isBirthday
      ? getBirthdayMessages(cel.name)
      : getAnniversaryMessages(cel.name, cel.subType);
    const emoji = isBirthday ? "🎂" : (cel.subType === "work-anniversary" ? "🏆" : "💝");
    const typeLabel = isBirthday ? "Birthday"
      : (cel.subType === "work-anniversary" ? "Work Anniversary" : "Anniversary");
    const typeClass = isBirthday ? "cel-birthday" : "cel-anniversary";
    const gifSearch = `https://giphy.com/search/${encodeURIComponent(isBirthday ? "happy birthday" : "happy anniversary")}`;

    return `
    <div class="celebration-item" id="cel-item-${idx}">
      <div class="cel-header">
        <div class="cel-person">
          <span class="cel-emoji">${emoji}</span>
          <span class="cel-name">${escHtml(cel.name)}</span>
          <span class="cel-type-badge ${typeClass}">${typeLabel}</span>
        </div>
        <a href="${gifSearch}" target="_blank" rel="noopener" class="gif-search-btn" title="Find a GIF to share on Giphy">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Find GIF
        </a>
      </div>

      <div class="cel-gif-wrap">
        <img src="${gif}"
             alt="${typeLabel} GIF for ${escHtml(cel.name)}"
             class="cel-gif"
             loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="cel-gif-fallback" style="display:none">
          <span>${emoji}</span>
        </div>
      </div>

      <div class="cel-messages">
        <div class="cel-messages-header">
          <span class="cel-messages-label">📋 Ready Wishes:</span>
          <div class="cel-wish-tabs">
            <button class="wish-tab-btn active" onclick="switchWishTab(${idx}, 0)" type="button">Wish 1</button>
            <button class="wish-tab-btn" onclick="switchWishTab(${idx}, 1)" type="button">Wish 2</button>
            <button class="wish-tab-btn" onclick="switchWishTab(${idx}, 2)" type="button">Wish 3</button>
          </div>
        </div>
        ${messages.map((msg, mi) => `
          <div class="cel-message-item ${mi === 0 ? 'active' : ''}" id="cel-msg-${idx}-${mi}">
            <pre class="cel-message-text">${escHtml(msg)}</pre>
            <button class="cel-copy-btn" onclick="copyMessage('cel-msg-${idx}-${mi}')" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              Copy
            </button>
          </div>`).join("")}
      </div>
    </div>
    \${idx < celebrations.length - 1 ? '<div class="cel-divider"></div>' : ''}`;
  }).join("");
}

window.switchWishTab = function(celIdx, wishIdx) {
  const celItem = document.getElementById(`cel-item-${celIdx}`);
  if (!celItem) return;

  const tabs = celItem.querySelectorAll(".wish-tab-btn");
  const panes = celItem.querySelectorAll(".cel-message-item");

  tabs.forEach((tab, index) => {
    if (index === wishIdx) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  panes.forEach((pane, index) => {
    if (index === wishIdx) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
};

function copyMessage(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  const text = item.querySelector(".cel-message-text")?.textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    const btn = item.querySelector(".cel-copy-btn");
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!`;
    btn.classList.add("copied");
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
  });
}

async function fetchCelebrations() {
  try {
    const response = await fetch("/api/celebrations");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    renderCelebrations(data);
  } catch (error) {
    console.error("Error fetching celebrations:", error);
    if (DOM.celebrationsContent) {
      DOM.celebrationsContent.innerHTML = getMcpOfflineHTML("Celebrations");
    }
    if (DOM.celebrationsCount) DOM.celebrationsCount.textContent = "unavailable";
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────────
function findColIndex(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    for (const kw of keywords) {
      if (headers[i].includes(kw)) return i;
    }
  }
  return -1;
}

function parseIsoDateString(dateStr) {
  if (!dateStr || dateStr === "Unknown") return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

function parseSheetDate(raw) {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();

  const m = s.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = m[2];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(`${month} ${day}, ${year}`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatEventTime(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function getMcpOfflineHTML(serviceName) {
  return `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h4>Connection Offline</h4>
      <p>Failed to retrieve ${escHtml(serviceName)} from MCP gateway.</p>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return "₹0.00";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value);
}

function formatNum(value, decimals = 2) {
  if (value === undefined || value === null || isNaN(value)) return "0";
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// ─── Dashboard Core Refresh ──────────────────────────────────────────────────
async function refreshData() {
  showSkeletons();
  await checkMcpConnection();
  await Promise.allSettled([
    fetchWeather(),
    fetchCalendar(),
    fetchStocks(),
    fetchCelebrations()
  ]);
}

async function checkMcpConnection() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Status API offline");
    const data = await response.json();
    
    STATE.mcpConnected = data.connected;
    if (DOM.mcpStatusDot) {
      if (STATE.mcpConnected) {
        DOM.mcpStatusDot.classList.add("online");
        DOM.mcpStatusText.textContent = "MCP Gateway Online";
      } else {
        DOM.mcpStatusDot.classList.remove("online");
        DOM.mcpStatusText.textContent = "MCP Gateway Offline";
      }
    }
  } catch (error) {
    STATE.mcpConnected = false;
    if (DOM.mcpStatusDot) {
      DOM.mcpStatusDot.classList.remove("online");
      DOM.mcpStatusText.textContent = "MCP Gateway Offline";
    }
  }
}

function showSkeletons() {
  const weatherLoader = `
    <div class="skeleton-loader">
      <div class="skeleton-circle"></div>
      <div class="skeleton-lines">
        <div class="skeleton-line w-full"></div>
        <div class="skeleton-line w-2/3"></div>
      </div>
    </div>
  `;
  const calendarLoader = `
    <div class="skeleton-loader">
      <div class="skeleton-line w-3/4 mb-3"></div>
      <div class="skeleton-line w-full mb-3"></div>
      <div class="skeleton-line w-2/3"></div>
    </div>
  `;
  const celebrationsLoader = `
    <div class="skeleton-loader">
      <div class="skeleton-line w-3/4 mb-3"></div>
      <div class="skeleton-line w-full mb-3"></div>
    </div>
  `;
  const stocksLoader = `
    <div class="skeleton-loader">
      <div class="skeleton-line w-full mb-3"></div>
      <div class="skeleton-line w-4/5 mb-3"></div>
      <div class="skeleton-line w-3/4 mb-3"></div>
      <div class="skeleton-line w-full"></div>
    </div>
  `;

  if (DOM.weatherContent) DOM.weatherContent.innerHTML = weatherLoader;
  if (DOM.calendarContent) DOM.calendarContent.innerHTML = calendarLoader;
  if (DOM.celebrationsContent) DOM.celebrationsContent.innerHTML = celebrationsLoader;
  if (DOM.stocksContent) DOM.stocksContent.innerHTML = stocksLoader;
  if (DOM.stocksFooter) DOM.stocksFooter.style.display = "none";
}

// ─── Settings Tab Navigation ─────────────────────────────────────────────────
function setupSettingsTabs() {
  const tabs = [
    { btn: "tab-general", content: "settings-tab-content-general" },
    { btn: "tab-google",  content: "settings-tab-content-google" },
    { btn: "tab-stocks",  content: "settings-tab-content-stocks" },
  ];

  tabs.forEach(({ btn, content }) => {
    const btnEl = document.getElementById(btn);
    if (!btnEl) return;
    btnEl.addEventListener("click", () => {
      tabs.forEach(({ btn: b, content: c }) => {
        document.getElementById(b)?.classList.remove("active");
        document.getElementById(c)?.classList.remove("active");
      });
      btnEl.classList.add("active");
      document.getElementById(content)?.classList.add("active");

      if (btn === "tab-google")  loadAuthStatus();
      if (btn === "tab-stocks")  loadStocksSheetStatus();
    });
  });
}

// ─── Google Auth Tab ──────────────────────────────────────────────────────────
async function loadAuthStatus() {
  const dot   = document.getElementById("auth-status-icon");
  const label = document.getElementById("auth-status-label");
  const btnConnect    = document.getElementById("btn-connect-google");
  const btnDisconnect = document.getElementById("btn-disconnect-google");

  if (dot)   dot.className   = "auth-dot auth-dot--checking";
  if (label) label.textContent = "Checking…";
  btnConnect?.setAttribute("style", "display:none");
  btnDisconnect?.setAttribute("style", "display:none");

  try {
    const r    = await fetch("/api/config/auth/status");
    const data = await r.json();

    // Gateway offline or dashboard proxy error
    if (!r.ok || data.error) {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "Gateway offline — start the MCP gateway first";
      return;
    }

    if (data.authenticated) {
      if (dot)   dot.className = "auth-dot auth-dot--ok";
      if (label) label.textContent = "Connected — Google services authorised";
      btnDisconnect?.removeAttribute("style");
    } else if (!data.google_configured) {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "GOOGLE_CLIENT_ID / SECRET not set in gateway .env";
      // No connect button — credentials must be set first
    } else {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "Not connected — click Connect Google to authorise";
      btnConnect?.removeAttribute("style");
    }
  } catch {
    if (dot)   dot.className = "auth-dot auth-dot--err";
    if (label) label.textContent = "Could not reach the MCP gateway";
  }
}

function setupGoogleAuthButtons() {
  document.getElementById("btn-refresh-auth")?.addEventListener("click", loadAuthStatus);

  document.getElementById("btn-connect-google")?.addEventListener("click", () => {
    // Open directly to the gateway — it will redirect to Google and handle the callback
    const gatewayBase = window._MCP_GATEWAY_URL || "http://127.0.0.1:8000";
    window.open(`${gatewayBase}/auth/google`, "_blank", "noopener,noreferrer");
  });

  document.getElementById("btn-disconnect-google")?.addEventListener("click", async () => {
    if (!confirm("Disconnect Google? You will need to re-authorise to use Gmail, Calendar and Sheets.")) return;
    await fetch("/api/config/auth/token", { method: "DELETE" });
    loadAuthStatus();
  });
}

// ─── Stocks Sheet Tab ─────────────────────────────────────────────────────────
async function loadStocksSheetStatus() {
  const dot   = document.getElementById("stocks-sheet-dot");
  const label = document.getElementById("stocks-sheet-label");

  if (dot)   dot.className = "auth-dot auth-dot--checking";
  if (label) label.textContent = "Loading…";

  try {
    const r    = await fetch("/api/config/auth/status");
    const data = await r.json();

    if (data.spreadsheet_id) {
      if (dot)   dot.className = "auth-dot auth-dot--ok";
      if (label) label.textContent = data.spreadsheet_name
        ? `Sheet: ${data.spreadsheet_name}`
        : `Sheet ID: ${data.spreadsheet_id}`;
    } else {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "No sheet configured — click Browse Sheets";
    }
  } catch {
    if (dot)   dot.className = "auth-dot auth-dot--err";
    if (label) label.textContent = "Could not reach the MCP gateway";
  }
}

function setupSheetPicker() {
  document.getElementById("btn-load-sheets")?.addEventListener("click", async () => {
    const wrap  = document.getElementById("sheet-picker-wrap");
    const sel   = document.getElementById("sheet-select");
    const btnLoad = document.getElementById("btn-load-sheets");

    if (btnLoad) btnLoad.textContent = "Loading…";

    try {
      const r     = await fetch("/api/config/sheets");
      const sheets = await r.json();

      if (!r.ok || !Array.isArray(sheets)) {
        if (r.status === 401) {
          alert("Google session expired.\n\nGo to Settings → Google tab and click Connect Google to re-authenticate.");
        } else {
          const msg = sheets?.message || sheets?.error || "Unknown error";
          alert(`Could not load sheets: ${msg}`);
        }
        return;
      }

      if (sheets.length === 0) {
        alert("No Google Sheets found in your Drive.");
        return;
      }

      if (sel) {
        sel.innerHTML = `<option value="">-- Choose a sheet --</option>` +
          sheets.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`).join("");
      }
      if (wrap) wrap.style.display = "block";
    } catch (err) {
      alert(`Failed to load sheets: ${err.message}`);
    } finally {
      if (btnLoad) btnLoad.textContent = "Browse Sheets";
    }
  });

  document.getElementById("btn-save-sheet")?.addEventListener("click", async () => {
    const sel = document.getElementById("sheet-select");
    const id  = sel?.value;
    if (!id) { alert("Please select a sheet first."); return; }

    const btnSave = document.getElementById("btn-save-sheet");
    if (btnSave) btnSave.textContent = "Saving…";

    try {
      const r = await fetch(`/api/config/sheets/${encodeURIComponent(id)}`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).message || "Save failed");
      await loadStocksSheetStatus();
      document.getElementById("sheet-picker-wrap").style.display = "none";
      // Refresh stocks card immediately
      fetchStocks();
    } catch (err) {
      alert(`Could not save sheet: ${err.message}`);
    } finally {
      if (btnSave) btnSave.textContent = "Save Sheet";
    }
  });
}

// ─── Initialize Application ──────────────────────────────────────────────────
async function init() {
  // Fetch gateway URL so auth redirect can target it directly
  try {
    const r = await fetch("/api/config/gateway-url");
    const d = await r.json();
    window._MCP_GATEWAY_URL = d.url || "http://127.0.0.1:8000";
  } catch {
    window._MCP_GATEWAY_URL = "http://127.0.0.1:8000";
  }

  setupEventListeners();
  setupSettingsTabs();
  setupGoogleAuthButtons();
  setupSheetPicker();
  updateClock();
  setInterval(updateClock, 1000);
  loadLocation();
}

document.addEventListener("DOMContentLoaded", init);
