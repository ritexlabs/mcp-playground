import re

import httpx

from ..utils.errors import ValidationError

_WMO: dict[int, str] = {
    0: "Clear sky ☀️", 1: "Mainly clear 🌤️", 2: "Partly cloudy ⛅", 3: "Overcast ☁️",
    45: "Fog 🌫️", 48: "Depositing rime fog 🌫️",
    51: "Light drizzle 🌧️", 53: "Moderate drizzle 🌧️", 55: "Dense drizzle 🌧️",
    61: "Slight rain 🌧️", 63: "Moderate rain 🌧️", 65: "Heavy rain 🌧️",
    71: "Slight snow ❄️", 73: "Moderate snow ❄️", 75: "Heavy snow ❄️",
    80: "Slight rain showers 🌦️", 81: "Moderate rain showers 🌦️", 82: "Violent rain showers 🌦️",
    95: "Thunderstorm ⛈️", 96: "Thunderstorm with slight hail ⛈️", 99: "Thunderstorm with heavy hail ⛈️",
}

_INDIA_CITIES = {
    "mumbai", "delhi", "bangalore", "bengaluru", "kolkata",
    "chennai", "jaipur", "pune", "hyderabad", "ahmedabad",
}


async def handle_get_weather(
    location: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    temperature_unit: str = "celsius",
) -> str:
    if not location and (latitude is None or longitude is None):
        raise ValidationError(
            "Provide either a location name or latitude/longitude coordinates."
        )

    resolved_name = ""
    lat, lon = latitude, longitude

    async with httpx.AsyncClient(timeout=15.0) as client:
        if location:
            try:
                geo = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": location, "count": 1, "language": "en", "format": "json"},
                )
                if geo.is_success:
                    hits = geo.json().get("results", [])
                    if hits:
                        r = hits[0]
                        lat, lon = r["latitude"], r["longitude"]
                        resolved_name = (
                            f"{r['name']}, {r.get('admin1', '')} {r.get('country', '')}".strip()
                        )
            except Exception:
                pass

        unit_sym = "°F" if temperature_unit == "fahrenheit" else "°C"
        summary = ""

        if lat is not None and lon is not None:
            try:
                params: dict = {
                    "latitude": lat, "longitude": lon,
                    "current": (
                        "temperature_2m,relative_humidity_2m,apparent_temperature,"
                        "precipitation,weather_code,wind_speed_10m"
                    ),
                    "timezone": "auto",
                }
                if temperature_unit == "fahrenheit":
                    params["temperature_unit"] = "fahrenheit"
                resp = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
                if resp.is_success:
                    c = resp.json().get("current", {})
                    summary = (
                        f"• **Condition:** {_WMO.get(c.get('weather_code', -1), 'Unknown')}\n"
                        f"• **Temperature:** {c.get('temperature_2m')}{unit_sym}\n"
                        f"• **Feels Like:** {c.get('apparent_temperature')}{unit_sym}\n"
                        f"• **Humidity:** {c.get('relative_humidity_2m')}%\n"
                        f"• **Precipitation:** {c.get('precipitation')} mm\n"
                        f"• **Wind Speed:** {c.get('wind_speed_10m')} km/h\n"
                        f"• **Data Source:** Open-Meteo\n"
                    )
            except Exception:
                pass

        if not summary:
            query = location or f"{lat},{lon}"
            resp = await client.get(f"https://wttr.in/{query}", params={"format": "j1"})
            resp.raise_for_status()
            data = resp.json()
            c = data["current_condition"][0]
            area = data["nearest_area"][0]
            if not resolved_name:
                resolved_name = (
                    f"{area['areaName'][0]['value']}, {area['country'][0]['value']}"
                )
            t_key = "temp_F" if temperature_unit == "fahrenheit" else "temp_C"
            fl_key = "FeelsLikeF" if temperature_unit == "fahrenheit" else "FeelsLikeC"
            summary = (
                f"• **Condition:** {c['weatherDesc'][0]['value']}\n"
                f"• **Temperature:** {c[t_key]}{unit_sym}\n"
                f"• **Feels Like:** {c[fl_key]}{unit_sym}\n"
                f"• **Humidity:** {c['humidity']}%\n"
                f"• **Precipitation:** {c['precipMM']} mm\n"
                f"• **Wind Speed:** {c['windspeedKmph']} km/h\n"
                f"• **Data Source:** wttr.in (fallback)\n"
            )

        display_name = resolved_name or location or f"{lat},{lon}"
        text = f"🌦️ Weather for **{display_name}**:\n\n{summary}"

        is_india = (
            "india" in display_name.lower()
            or (location and "india" in location.lower())
            or (location and any(c in location.lower() for c in _INDIA_CITIES))
        )
        if is_india:
            alerts = await _fetch_imd_alerts(client, location or display_name)
            if alerts:
                text += "\n🚨 **IMD Severe Weather Warnings:**\n" + "\n".join(f"- {a}" for a in alerts)
            else:
                text += "\nℹ️ *No active severe weather warnings on the IMD alert system.*\n"

    return text


async def _fetch_imd_alerts(client: httpx.AsyncClient, location: str) -> list[str]:
    try:
        resp = await client.get(
            "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
        )
        if not resp.is_success:
            return []
        xml = resp.text
        terms = [t for t in re.split(r"[\s,()]+", location.lower()) if len(t) > 2]
        alerts: list[str] = []
        for item in re.findall(r"<item>([\s\S]*?)</item>", xml):
            title_m = re.search(r"<title>([\s\S]*?)</title>", item)
            author_m = re.search(r"<author>([\s\S]*?)</author>", item)
            if not title_m:
                continue
            title = re.sub(r"<!\[CDATA\[([\s\S]*?)\]\]>", r"\1", title_m.group(1)).strip()
            author = re.sub(r"<!\[CDATA\[([\s\S]*?)\]\]>", r"\1",
                            author_m.group(1) if author_m else "").strip()
            if any(t in f"{title} {author}".lower() for t in terms):
                sender = author.replace("controlroom@ndma.gov.in", "").strip(" ()")
                alerts.append(f"⚠️ {title}" + (f" [Source: {sender}]" if sender else ""))
        return alerts
    except Exception:
        return []
