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
  stocksLastSync: null,
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
  mcpStatusTime: document.getElementById("mcp-status-time"),
  
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
      if (!DOM.settingsDialog) return;
      DOM.settingsDialog.showModal();
      const activeTab = DOM.settingsDialog.querySelector(".tab-btn.active")?.id;
      if (activeTab === "tab-google")   loadAuthStatus();
      if (activeTab === "tab-stocks")   loadStocksSheetStatus();
      if (activeTab === "tab-indmoney") loadIndMoneyStatus();
    });
  }
  
  if (DOM.settingsBtn) {
    DOM.settingsBtn.addEventListener("click", () => {
      if (!DOM.settingsDialog) return;
      DOM.settingsDialog.showModal();
      const activeTab = DOM.settingsDialog.querySelector(".tab-btn.active")?.id;
      if (activeTab === "tab-google")   loadAuthStatus();
      if (activeTab === "tab-stocks")   loadStocksSheetStatus();
      if (activeTab === "tab-indmoney") loadIndMoneyStatus();
      if (activeTab === "tab-layout")   _renderLayoutTab();
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
    STATE.stocksLastSync = new Date();
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

  const syncEl = document.getElementById("stocks-sync-time");
  if (syncEl && STATE.stocksLastSync) {
    syncEl.textContent = `Synced ${STATE.stocksLastSync.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
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
    fetchCelebrations(),
    fetchIndMoney(),
  ]);
}

async function checkMcpConnection() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Status API offline");
    const data = await response.json();

    STATE.mcpConnected = data.connected;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    const footerEl = document.getElementById("mcp-footer-status");
    if (STATE.mcpConnected) {
      if (DOM.mcpStatusDot) { DOM.mcpStatusDot.textContent = "✅"; DOM.mcpStatusDot.className = "mcp-status-icon"; }
      if (DOM.mcpStatusText) DOM.mcpStatusText.textContent = "MCP Gateway Online";
      if (footerEl) footerEl.className = "connection-status online";
    } else {
      if (DOM.mcpStatusDot) { DOM.mcpStatusDot.textContent = "🔴"; DOM.mcpStatusDot.className = "mcp-status-icon"; }
      if (DOM.mcpStatusText) DOM.mcpStatusText.textContent = "MCP Gateway Offline";
      if (footerEl) footerEl.className = "connection-status offline";
    }
    if (DOM.mcpStatusTime) DOM.mcpStatusTime.textContent = `as of ${timeStr}`;
  } catch (error) {
    STATE.mcpConnected = false;
    if (DOM.mcpStatusDot) { DOM.mcpStatusDot.textContent = "🔴"; DOM.mcpStatusDot.className = "mcp-status-icon"; }
    if (DOM.mcpStatusText) DOM.mcpStatusText.textContent = "MCP Gateway Offline";
    if (DOM.mcpStatusTime) DOM.mcpStatusTime.textContent = "";
    const footerEl = document.getElementById("mcp-footer-status");
    if (footerEl) footerEl.className = "connection-status offline";
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

// ─── Card Layout ─────────────────────────────────────────────────────────────

const CARD_DEFS = [
  { id: "weather-card",       label: "Weather",                   icon: "🌤" },
  { id: "celebrations-card",  label: "Birthdays & Anniversaries", icon: "🎉" },
  { id: "calendar-card",      label: "Calendar",                  icon: "📅" },
  { id: "indmoney-card",      label: "My Networth",               icon: "💰" },
  { id: "stocks-card",        label: "Stocks",                    icon: "📈" },
];

const _DEFAULT_ORDER = CARD_DEFS.map(c => c.id);
let _cardLayout = { order: [..._DEFAULT_ORDER], hidden: new Set() };

function _loadCardLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem("dashboard_card_layout") || "null");
    if (!saved) return;
    const allIds = _DEFAULT_ORDER;
    const savedOrder = (saved.order || []).filter(id => allIds.includes(id));
    const missing = allIds.filter(id => !savedOrder.includes(id));
    _cardLayout = {
      order: [...savedOrder, ...missing],
      hidden: new Set((saved.hidden || []).filter(id => allIds.includes(id))),
    };
  } catch {}
}

function _saveCardLayout() {
  try {
    localStorage.setItem("dashboard_card_layout", JSON.stringify({
      order: _cardLayout.order,
      hidden: [..._cardLayout.hidden],
    }));
  } catch {}
}

function _applyCardLayout() {
  const col1 = document.querySelector(".grid-column:first-child");
  const col2 = document.querySelector(".grid-column:last-child");
  if (!col1 || !col2) return;

  const visible = _cardLayout.order.filter(id => !_cardLayout.hidden.has(id));
  const half = Math.ceil(visible.length / 2);

  visible.slice(0, half).forEach(id => {
    const card = document.getElementById(id);
    if (card) { card.style.display = ""; col1.appendChild(card); }
  });
  visible.slice(half).forEach(id => {
    const card = document.getElementById(id);
    if (card) { card.style.display = ""; col2.appendChild(card); }
  });

  _cardLayout.hidden.forEach(id => {
    const card = document.getElementById(id);
    if (card) card.style.display = "none";
  });
}

function _renderLayoutTab() {
  const list = document.getElementById("layout-cards-list");
  if (!list) return;

  list.innerHTML = _cardLayout.order.map(id => {
    const def = CARD_DEFS.find(c => c.id === id);
    if (!def) return "";
    const checked = !_cardLayout.hidden.has(id);
    return `<div class="layout-item" draggable="true" data-card-id="${id}">
      <span class="layout-drag-handle" aria-hidden="true">⠿</span>
      <span class="layout-card-icon">${def.icon}</span>
      <span class="layout-card-label">${def.label}</span>
      <label class="layout-vis-toggle">
        <input type="checkbox" class="layout-vis-cb" data-card-id="${id}" ${checked ? "checked" : ""}>
        <span class="layout-vis-slider"></span>
      </label>
    </div>`;
  }).join("");

  let draggedId = null;
  list.querySelectorAll(".layout-item").forEach(item => {
    item.addEventListener("dragstart", e => {
      draggedId = item.dataset.cardId;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      list.querySelectorAll(".layout-item").forEach(r => r.classList.remove("drag-over"));
      draggedId = null;
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      if (!draggedId || item.dataset.cardId === draggedId) return;
      list.querySelectorAll(".layout-item").forEach(r => r.classList.remove("drag-over"));
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", e => {
      e.preventDefault();
      if (!draggedId || item.dataset.cardId === draggedId) return;
      const fromIdx = _cardLayout.order.indexOf(draggedId);
      const toIdx   = _cardLayout.order.indexOf(item.dataset.cardId);
      if (fromIdx === -1 || toIdx === -1) return;
      _cardLayout.order.splice(fromIdx, 1);
      _cardLayout.order.splice(toIdx, 0, draggedId);
      _saveCardLayout();
      _applyCardLayout();
      _renderLayoutTab();
    });
  });

  list.querySelectorAll(".layout-vis-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.cardId;
      if (cb.checked) _cardLayout.hidden.delete(id);
      else            _cardLayout.hidden.add(id);
      _saveCardLayout();
      _applyCardLayout();
    });
  });

  document.getElementById("btn-reset-layout")?.addEventListener("click", () => {
    _cardLayout = { order: [..._DEFAULT_ORDER], hidden: new Set() };
    _saveCardLayout();
    _applyCardLayout();
    _renderLayoutTab();
  });
}

// ─── Settings Tab Navigation ─────────────────────────────────────────────────
function setupSettingsTabs() {
  const tabs = [
    { btn: "tab-general",   content: "settings-tab-content-general" },
    { btn: "tab-google",    content: "settings-tab-content-google" },
    { btn: "tab-stocks",    content: "settings-tab-content-stocks" },
    { btn: "tab-indmoney",  content: "settings-tab-content-indmoney" },
    { btn: "tab-layout",    content: "settings-tab-content-layout" },
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

      if (btn === "tab-google")    loadAuthStatus();
      if (btn === "tab-stocks")    loadStocksSheetStatus();
      if (btn === "tab-indmoney")  loadIndMoneyStatus();
      if (btn === "tab-layout")    _renderLayoutTab();
    });
  });
}

// ─── Google Auth Tab ──────────────────────────────────────────────────────────
async function loadAuthStatus() {
  const dot   = document.getElementById("auth-status-icon");
  const label = document.getElementById("auth-status-label");
  const btnConnect    = document.getElementById("btn-connect-google");
  const btnDisconnect = document.getElementById("btn-disconnect-google");

  if (dot)   dot.className    = "auth-dot auth-dot--checking";
  if (label) label.textContent = "Checking…";
  btnConnect?.setAttribute("style",    "display:none");
  btnDisconnect?.setAttribute("style", "display:none");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);

  try {
    const r    = await fetch("/api/config/auth/status", { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await r.json();

    if (!r.ok || data.error) {
      if (dot)   dot.className    = "auth-dot auth-dot--err";
      if (label) label.textContent = "Gateway offline — start the MCP gateway first";
      btnConnect?.removeAttribute("style");
      return;
    }

    if (data.authenticated) {
      if (dot)   dot.className    = "auth-dot auth-dot--ok";
      if (label) label.textContent = "Connected — Google services authorised";
      btnDisconnect?.removeAttribute("style");
    } else if (!data.google_configured) {
      if (dot)   dot.className    = "auth-dot auth-dot--err";
      if (label) label.textContent = "Google credentials not set in gateway .env";
    } else {
      if (dot)   dot.className    = "auth-dot auth-dot--err";
      if (label) label.textContent = "Not connected — click Connect Google to authorise";
      btnConnect?.removeAttribute("style");
    }
  } catch (err) {
    clearTimeout(timer);
    if (dot)   dot.className    = "auth-dot auth-dot--err";
    if (label) label.textContent = err.name === "AbortError"
      ? "Status check timed out — is the gateway running?"
      : "Could not reach the MCP gateway";
    btnConnect?.removeAttribute("style");
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

  if (dot)   dot.className    = "auth-dot auth-dot--checking";
  if (label) label.textContent = "Checking…";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);

  try {
    const r    = await fetch("/api/config/auth/status", { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await r.json();

    if (!r.ok) {
      if (dot)   dot.className    = "auth-dot auth-dot--err";
      if (label) label.textContent = "Gateway offline — start the MCP gateway first";
      return;
    }

    if (data.spreadsheet_id) {
      if (dot)   dot.className    = "auth-dot auth-dot--ok";
      if (label) label.textContent = data.spreadsheet_name
        ? `Sheet: ${data.spreadsheet_name}`
        : `Sheet ID: ${data.spreadsheet_id}`;
    } else {
      if (dot)   dot.className    = "auth-dot auth-dot--err";
      if (label) label.textContent = "No sheet configured — click Browse Sheets";
    }
  } catch (err) {
    clearTimeout(timer);
    if (dot)   dot.className    = "auth-dot auth-dot--err";
    if (label) label.textContent = err.name === "AbortError"
      ? "Status check timed out — is the gateway running?"
      : "Could not reach the MCP gateway";
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

// ─── IndMoney Card + Settings ────────────────────────────────────────────────

const NW_ASSET_COLORS = {
  STOCK:          "#38bdf8", US_STOCK:      "#818cf8", US_STOCK_WALLET: "#6366f1",
  MF:             "#a78bfa", EPF:           "#34d399", NPS:            "#22d3ee",
  PPF:            "#4ade80", FD:            "#fbbf24", CRYPTO:         "#fb923c",
  REAL_ESTATE:    "#94a3b8", VEHICLE:       "#64748b", ESOPS_RSUS:     "#c084fc",
  SA:             "#f472b6", PHYSICAL_GOLD: "#fcd34d",
};
const NW_ASSET_LABELS = {
  STOCK: "Indian Stocks", US_STOCK: "US Stocks", US_STOCK_WALLET: "US Wallet",
  MF: "Mutual Funds",     EPF: "EPF",            NPS: "NPS",
  PPF: "PPF",             FD: "Fixed Deposits",  CRYPTO: "Crypto",
  REAL_ESTATE: "Real Estate", VEHICLE: "Vehicle",ESOPS_RSUS: "ESOPs / RSUs",
  SA: "Savings A/C",      PHYSICAL_GOLD: "Physical Gold",
};
const NW_ASSET_ICONS = {
  STOCK:"📈", US_STOCK:"🌐", US_STOCK_WALLET:"💵", MF:"💰", EPF:"🏦",
  NPS:"🔵",  PPF:"💎",       FD:"🏛️",             CRYPTO:"₿", REAL_ESTATE:"🏠",
  VEHICLE:"🚗", ESOPS_RSUS:"⭐", SA:"💳",          PHYSICAL_GOLD:"🪙",
};

let _nwActiveView = "chart";   // "chart" | "activity"
let _nwLastSnapshot = null;    // previous snapshot for delta
let _nwLastFetchTime = null;   // timestamp of last successful fetch
let _nwLastData = null;        // full API response for re-render without re-fetch
let _nwPrivacyMode = (() => {
  try { return localStorage.getItem("nw_privacy_mode") !== "false"; }
  catch { return true; }
})();

const _SVG_EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
const _SVG_EYE_OFF  = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>`;

function _nwMask(val) {
  return _nwPrivacyMode
    ? `<span class="nw-privacy-mask">₹ ••••••</span>`
    : formatCurrency(val);
}

function _nwMaskText(val) {
  return _nwPrivacyMode ? "₹ ••••••" : formatCurrency(val);
}

function _syncNwPrivacyBtn() {
  const btn = document.getElementById("nw-privacy-btn");
  if (!btn) return;
  btn.innerHTML = _nwPrivacyMode ? _SVG_EYE_OFF : _SVG_EYE_OPEN;
  btn.title = _nwPrivacyMode ? "Show values" : "Hide values";
}

function _setupNwPrivacyToggle() {
  _syncNwPrivacyBtn();
  document.getElementById("nw-privacy-btn")?.addEventListener("click", () => {
    _nwPrivacyMode = !_nwPrivacyMode;
    try { localStorage.setItem("nw_privacy_mode", _nwPrivacyMode ? "true" : "false"); }
    catch {}
    _syncNwPrivacyBtn();
    if (_nwLastData) {
      if (_nwActiveView === "chart") renderNetworthChart(_nwLastData.snapshot || {});
      else renderNetworthActivity(_nwLastData);
    }
  });
}

function _nwLabel(type) { return NW_ASSET_LABELS[type] || type; }
function _nwColor(type) { return NW_ASSET_COLORS[type] || "#64748b"; }
function _nwIcon(type)  { return NW_ASSET_ICONS[type]  || "📦"; }

// ── donut chart (pure SVG) ──────────────────────────────────────────────────
function _drawDonut(container, segments) {
  const S = 200, cx = 100, cy = 100, OR = 82, IR = 50;
  const total = segments.reduce((s, g) => s + g.v, 0);
  if (!total) return;

  let angle = -Math.PI / 2, paths = "", hoverItems = "";
  segments.forEach((seg, i) => {
    const frac = seg.v / total;
    const sweep = frac * 2 * Math.PI;
    const end = angle + sweep;
    const [x1, y1] = [cx + OR * Math.cos(angle), cy + OR * Math.sin(angle)];
    const [x2, y2] = [cx + OR * Math.cos(end),   cy + OR * Math.sin(end)];
    const [x3, y3] = [cx + IR * Math.cos(end),   cy + IR * Math.sin(end)];
    const [x4, y4] = [cx + IR * Math.cos(angle), cy + IR * Math.sin(angle)];
    const la = sweep > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${OR},${OR} 0 ${la},1 ${x2},${y2} L${x3},${y3} A${IR},${IR} 0 ${la},0 ${x4},${y4}Z`;
    paths += `<path d="${d}" fill="${seg.c}" class="nw-donut-seg" data-idx="${i}"
      style="transition:opacity .2s,transform .2s;transform-origin:${cx}px ${cy}px;cursor:pointer"/>`;
    const showPnl = seg.retPct !== undefined && Math.abs(seg.retPct) <= 200;
    const pnlUp   = seg.ret >= 0;
    hoverItems += `<div class="nw-donut-tt-row" data-idx="${i}">
      <span class="nw-tt-dot" style="background:${seg.c}"></span>
      <span class="nw-tt-label">${escHtml(_nwLabel(seg.t))}</span>
      <span class="nw-tt-val">${_nwMask(seg.v)}</span>
      <span class="nw-tt-pct">${(frac * 100).toFixed(1)}%</span>
      ${showPnl ? `<span class="nw-tt-pnl ${pnlUp ? "up" : "down"}">${pnlUp ? "▲" : "▼"} ${Math.abs(seg.retPct).toFixed(1)}%</span>` : ""}
    </div>`;
    angle = end;
  });

  container.innerHTML = `
    <div class="nw-donut-wrap">
      <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" class="nw-donut-svg">
        ${paths}
        <text x="${cx}" y="${cy - 9}" text-anchor="middle" class="nw-donut-label">Net Worth</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="nw-donut-val" id="nw-donut-center-val">…</text>
      </svg>
      <div class="nw-donut-legend" id="nw-donut-legend">${hoverItems}</div>
    </div>`;

  // interactions
  const segs = container.querySelectorAll(".nw-donut-seg");
  const rows = container.querySelectorAll(".nw-donut-tt-row");
  const centerVal = container.querySelector("#nw-donut-center-val");

  function highlight(idx) {
    segs.forEach((s, i) => s.style.opacity = (i === idx) ? "1" : "0.45");
    rows.forEach((r, i) => r.classList.toggle("active", i === idx));
    if (centerVal && idx >= 0) centerVal.textContent = _nwMaskText(segments[idx].v);
  }
  function reset() {
    segs.forEach(s => s.style.opacity = "1");
    rows.forEach(r => r.classList.remove("active"));
    if (centerVal) centerVal.textContent = "";
  }
  segs.forEach((s, i) => {
    s.addEventListener("mouseenter", () => highlight(i));
    s.addEventListener("mouseleave", reset);
    s.addEventListener("touchstart", (e) => { e.preventDefault(); highlight(i); }, { passive: false });
  });
  rows.forEach((r, i) => {
    r.addEventListener("mouseenter", () => highlight(i));
    r.addEventListener("mouseleave", reset);
  });
}

// ── View 1: Chart ───────────────────────────────────────────────────────────
function renderNetworthChart(snap) {
  const el = document.getElementById("indmoney-content");
  if (!el) return;

  const invested = snap.total_invested || 0;
  const current  = snap.total_current_value || snap.total_networth || 0;
  const gain     = current - invested;
  const gainPct  = invested > 0 ? (gain / invested) * 100 : 0;
  const isUp     = gain >= 0;

  const invs = (snap.investments || [])
    .filter(i => i.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value);

  const segments = invs.map(i => ({
    t: i.asset_type,
    v: i.current_value,
    c: _nwColor(i.asset_type),
    ret: (i.return !== undefined ? i.return : (i.current_value - (i.invested_value || 0))),
    retPct: (i.return_percentage !== undefined ? i.return_percentage : 0),
  }));

  const syncLabel = _nwLastFetchTime
    ? _nwLastFetchTime.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  el.innerHTML = `
    <div class="nw-summary-row">
      <div class="nw-total-block">
        <span class="nw-total-label">Total Net Worth</span>
        <span class="nw-total-amount">${_nwMask(current)}</span>
        <span class="nw-pnl-badge ${isUp ? "up" : "down"}">
          ${isUp ? "▲" : "▼"} ${_nwMask(Math.abs(gain))}
          <span class="nw-pnl-pct">(${isUp ? "+" : ""}${gainPct.toFixed(2)}%)</span>
        </span>
        ${syncLabel ? `<span class="nw-sync-time">Synced ${syncLabel}</span>` : ""}
      </div>
    </div>
    <div id="nw-donut-container"></div>`;

  _drawDonut(document.getElementById("nw-donut-container"), segments);
}

// ── View 2: Activity ────────────────────────────────────────────────────────
function renderNetworthActivity(data) {
  const el = document.getElementById("indmoney-content");
  if (!el) return;

  const snap      = data.snapshot || {};
  const stockSips = data.stock_sips || [];
  const mfSips    = data.mf_sips   || [];
  const allSips   = [...stockSips, ...mfSips];

  // Delta vs previous snapshot (localStorage)
  let deltaHtml = "";
  const prev = (() => {
    try { return JSON.parse(localStorage.getItem("nw_prev_snapshot") || "null"); } catch { return null; }
  })();
  if (prev && prev.total_networth && snap.total_networth) {
    const diff   = snap.total_networth - prev.total_networth;
    const isUp   = diff >= 0;
    const ago    = prev.ts ? _timeAgo(prev.ts) : "last check";
    deltaHtml = `
      <div class="nw-delta-row">
        <span class="nw-delta-label">Since ${ago}</span>
        <span class="nw-delta-val ${isUp ? "up" : "down"}">
          ${isUp ? "▲" : "▼"} ${_nwMask(Math.abs(diff))}
        </span>
      </div>`;
  }

  // Top 3 gainers & losers
  const invs = (snap.investments || []).filter(i => i.current_value > 0 && i.invested_value > 0 && i.return_percentage !== 0);
  const gainers = [...invs].sort((a, b) => b.return_percentage - a.return_percentage).slice(0, 3);
  const losers  = [...invs].sort((a, b) => a.return_percentage - b.return_percentage).slice(0, 3);

  const _moverRow = (inv, isGain) => `
    <div class="nw-mover-row">
      <span class="nw-mover-icon">${_nwIcon(inv.asset_type)}</span>
      <span class="nw-mover-name">${escHtml(_nwLabel(inv.asset_type))}</span>
      <span class="nw-mover-pct ${isGain ? "up" : "down"}">${isGain ? "+" : ""}${inv.return_percentage.toFixed(1)}%</span>
    </div>`;

  // All assets as bars
  const sorted = (snap.investments || []).filter(i => i.current_value > 0).sort((a, b) => b.current_value - a.current_value);
  const maxVal = sorted[0]?.current_value || 1;
  const assetBars = sorted.map(inv => {
    const pct  = (inv.current_value / maxVal) * 100;
    const ret  = inv.return || 0;
    const isUp = ret >= 0;
    return `
      <div class="nw-asset-row">
        <span class="nw-asset-icon">${_nwIcon(inv.asset_type)}</span>
        <div class="nw-asset-info">
          <div class="nw-asset-top">
            <span class="nw-asset-name">${escHtml(_nwLabel(inv.asset_type))}</span>
            <span class="nw-asset-val">${_nwMask(inv.current_value)}</span>
          </div>
          <div class="nw-asset-bar-track">
            <div class="nw-asset-bar-fill" style="width:${pct.toFixed(1)}%;background:${_nwColor(inv.asset_type)}"></div>
          </div>
          ${ret !== 0 ? `<div class="nw-asset-ret ${isUp ? "up" : "down"}">${isUp ? "▲" : "▼"} ${_nwMask(Math.abs(ret))} (${isUp ? "+" : ""}${inv.return_percentage.toFixed(1)}%)</div>` : ""}
        </div>
      </div>`;
  }).join("");

  // SIP section
  const sipHtml = allSips.length === 0
    ? `<p class="nw-empty-note">No active SIPs found.</p>`
    : allSips.map(s => `
        <div class="nw-sip-row">
          <span class="nw-sip-name">${escHtml(s.name || s.scheme_name || s.symbol || "SIP")}</span>
          <span class="nw-sip-amt">${_nwMask(s.amount || s.installment_amount || 0)}</span>
          ${s.next_date || s.sip_date ? `<span class="nw-sip-date">${escHtml(s.next_date || s.sip_date)}</span>` : ""}
        </div>`).join("");

  // FD / PPF / EPF deposits (assets with known "deposit" nature)
  const depositTypes = ["FD", "PPF", "EPF", "SA"];
  const deposits = (snap.investments || []).filter(i => depositTypes.includes(i.asset_type));
  const depositHtml = deposits.length === 0
    ? `<p class="nw-empty-note">No deposit data available.</p>`
    : deposits.map(d => `
        <div class="nw-deposit-row">
          <span class="nw-deposit-icon">${_nwIcon(d.asset_type)}</span>
          <div class="nw-deposit-info">
            <span class="nw-deposit-name">${_nwLabel(d.asset_type)}</span>
            <span class="nw-deposit-val">${_nwMask(d.current_value)}</span>
          </div>
          ${d.return !== 0 ? `<span class="nw-deposit-ret ${d.return > 0 ? "up" : "down"}">${d.return > 0 ? "+" : ""}${d.return_percentage?.toFixed(1)}%</span>` : ""}
        </div>`).join("");

  el.innerHTML = `
    ${deltaHtml}

    ${gainers.length ? `
    <div class="nw-section">
      <div class="nw-section-title">Top Performers</div>
      ${gainers.map(i => _moverRow(i, true)).join("")}
    </div>` : ""}

    ${losers.filter(i => i.return_percentage < 0).length ? `
    <div class="nw-section">
      <div class="nw-section-title">Underperformers</div>
      ${losers.filter(i => i.return_percentage < 0).map(i => _moverRow(i, false)).join("")}
    </div>` : ""}

    <div class="nw-section">
      <div class="nw-section-title">Asset Breakdown</div>
      ${assetBars}
    </div>

    <div class="nw-section">
      <div class="nw-section-title">SIPs</div>
      ${sipHtml}
    </div>

    <div class="nw-section">
      <div class="nw-section-title">Deposits &amp; Savings</div>
      ${depositHtml}
    </div>`;
}

function _timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function _getIndMoneyReconnectHTML() {
  return `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <h4>Session Expired</h4>
      <p>Your IndMoney session has expired. Please reconnect to view your networth.</p>
      <button class="indmoney-reconnect-btn" onclick="(function(){ const g=window._MCP_GATEWAY_URL||'http://127.0.0.1:8000'; window.open(g+'/auth/indmoney','_blank','noopener,noreferrer'); })()">
        🔗 Reconnect IndMoney
      </button>
    </div>`;
}

async function fetchIndMoney() {
  const el = document.getElementById("indmoney-content");
  if (!el) return;

  try {
    const r = await fetch("/api/indmoney/overview");
    if (r.status === 401) {
      el.innerHTML = _getIndMoneyReconnectHTML();
      return;
    }
    if (!r.ok) {
      el.innerHTML = getMcpOfflineHTML("IndMoney Networth");
      return;
    }
    const data = await r.json();

    if (data.auth_required) {
      el.innerHTML = _getIndMoneyReconnectHTML();
      return;
    }

    const snap = data.snapshot || {};

    if (!snap.total_networth && !snap.total_current_value) {
      el.innerHTML = getMcpOfflineHTML("IndMoney Networth");
      return;
    }

    // Store snapshot for delta calculation
    const prev = (() => {
      try { return JSON.parse(localStorage.getItem("nw_prev_snapshot") || "null"); } catch { return null; }
    })();
    if (!prev || Math.abs((prev.total_networth || 0) - snap.total_networth) > 0) {
      if (_nwLastSnapshot) {
        localStorage.setItem("nw_prev_snapshot", JSON.stringify({ ..._nwLastSnapshot, ts: Date.now() }));
      }
    }
    _nwLastSnapshot = snap;
    _nwLastFetchTime = new Date();
    _nwLastData = data;

    if (_nwActiveView === "chart") {
      renderNetworthChart(snap);
    } else {
      renderNetworthActivity(data);
    }
  } catch (err) {
    if (el) el.innerHTML = getMcpOfflineHTML("IndMoney Networth");
  }
}

function _setupNetworthViewToggle() {
  const btnChart    = document.getElementById("nw-btn-chart");
  const btnActivity = document.getElementById("nw-btn-activity");
  if (!btnChart || !btnActivity) return;

  function switchTo(view) {
    _nwActiveView = view;
    btnChart.classList.toggle("active", view === "chart");
    btnActivity.classList.toggle("active", view === "activity");
    btnChart.setAttribute("aria-pressed", view === "chart");
    btnActivity.setAttribute("aria-pressed", view === "activity");
    if (_nwLastData) {
      if (view === "chart") renderNetworthChart(_nwLastData.snapshot || {});
      else renderNetworthActivity(_nwLastData);
    } else {
      fetchIndMoney();
    }
  }

  btnChart.addEventListener("click",    () => switchTo("chart"));
  btnActivity.addEventListener("click", () => switchTo("activity"));
}

function renderMarkdownText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.*)$/, "<p>$1</p>");
}

async function loadIndMoneyStatus() {
  const dot     = document.getElementById("indmoney-status-dot");
  const label   = document.getElementById("indmoney-status-label");
  const btnConn = document.getElementById("btn-connect-indmoney");
  const btnDisc = document.getElementById("btn-disconnect-indmoney");

  if (dot) dot.className = "auth-dot auth-dot--checking";
  if (label) label.textContent = "Checking…";
  btnConn?.setAttribute("style", "display:none");
  btnDisc?.setAttribute("style", "display:none");

  try {
    const r    = await fetch("/api/config/indmoney/status");
    const data = await r.json();

    // Pre-fill URL
    const urlInput = document.getElementById("indmoney-url-input");
    if (urlInput && data.url) urlInput.value = data.url;

    if (!r.ok) {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "Gateway offline — start the MCP gateway first";
      return;
    }

    if (data.connected && data.auth_configured) {
      if (dot)   dot.className = "auth-dot auth-dot--ok";
      if (label) label.textContent = `Connected — ${data.tools?.length ?? 0} tools available`;
      btnDisc?.removeAttribute("style");
      _populateIndMoneyToolPicker(data.tools || [], data.display_tool);
    } else if (!data.auth_configured) {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = "Not connected — click Connect IndMoney to authorise with your IndMoney account";
      btnConn?.removeAttribute("style");
    } else {
      if (dot)   dot.className = "auth-dot auth-dot--err";
      if (label) label.textContent = data.error || "Connection failed — try reconnecting";
      btnConn?.removeAttribute("style");
    }
  } catch {
    if (dot)   dot.className = "auth-dot auth-dot--err";
    if (label) label.textContent = "Could not reach gateway";
  }
}

function _populateIndMoneyToolPicker(tools, selectedTool) {
  const wrap = document.getElementById("indmoney-tool-picker");
  const sel  = document.getElementById("indmoney-tool-select");
  if (!wrap || !sel) return;

  sel.innerHTML = `<option value="">-- pick a tool to show on card --</option>` +
    tools.map(t => `<option value="${escHtml(t)}"${t === selectedTool ? " selected" : ""}>${escHtml(t)}</option>`).join("");
  wrap.style.display = "block";
}

function setupIndMoneySettings() {
  document.getElementById("btn-indmoney-refresh-status")?.addEventListener("click", loadIndMoneyStatus);

  document.getElementById("btn-connect-indmoney")?.addEventListener("click", () => {
    const gatewayBase = window._MCP_GATEWAY_URL || "http://127.0.0.1:8000";
    window.open(`${gatewayBase}/auth/indmoney`, "_blank", "noopener,noreferrer");
  });

  document.getElementById("btn-disconnect-indmoney")?.addEventListener("click", async () => {
    if (!confirm("Disconnect IndMoney? You will need to re-authorise to use IndMoney tools.")) return;
    await fetch("/api/config/indmoney/token", { method: "DELETE" });
    loadIndMoneyStatus();
  });

  document.getElementById("btn-indmoney-save-url")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-indmoney-save-url");
    if (btn) btn.textContent = "Saving…";
    try {
      const url = document.getElementById("indmoney-url-input")?.value?.trim();
      if (!url) { alert("Please enter a URL."); return; }
      await fetch("/api/config/indmoney/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      await loadIndMoneyStatus();
    } finally {
      if (btn) btn.textContent = "Save URL";
    }
  });

  document.getElementById("btn-indmoney-save-tool")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-indmoney-save-tool");
    if (btn) btn.textContent = "Saving…";
    try {
      const display_tool = document.getElementById("indmoney-tool-select")?.value || "";
      const r = await fetch("/api/config/indmoney/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_tool }),
      });
      const data = await r.json();
      if (display_tool) {
        fetchIndMoney();
        alert("Saved! IndMoney card will now show: " + display_tool);
      }
    } finally {
      if (btn) btn.textContent = "Save Tool";
    }
  });

  const refreshIcon = document.getElementById("indmoney-refresh-icon");
  document.getElementById("indmoney-refresh-btn")?.addEventListener("click", async () => {
    if (refreshIcon) refreshIcon.classList.add("spin");
    await fetchIndMoney();
    if (refreshIcon) refreshIcon.classList.remove("spin");
  });
}

// ─── OAuth callback message listener ────────────────────────────────────────
window.addEventListener("message", (e) => {
  if (e.data?.type === "indmoney_connected") {
    loadIndMoneyStatus();
    fetchIndMoney();
  }
});

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

  _loadCardLayout();
  _applyCardLayout();
  setupEventListeners();
  setupSettingsTabs();
  setupGoogleAuthButtons();
  setupSheetPicker();
  setupIndMoneySettings();
  _setupNetworthViewToggle();
  _setupNwPrivacyToggle();
  updateClock();
  setInterval(updateClock, 1000);
  loadLocation();

  // Poll gateway every 10 s; auto-retry data cards if gateway transitions offline → online
  setInterval(async () => {
    const wasConnected = STATE.mcpConnected;
    await checkMcpConnection();
    if (!wasConnected && STATE.mcpConnected) {
      Promise.allSettled([fetchWeather(), fetchCalendar(), fetchStocks(), fetchCelebrations(), fetchIndMoney()]);
    }
  }, 10000);
}

document.addEventListener("DOMContentLoaded", init);
