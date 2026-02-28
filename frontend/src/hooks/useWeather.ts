import { useEffect, useRef } from "react";
import { useMapStore, type WeatherData } from "../store/useMapStore";

// NJ coordinates as fallback
const NJ_LAT = 40.0583;
const NJ_LON = -74.4057;

export function useWeather() {
    const { setWeatherData } = useMapStore();
    const lastFetchRef = useRef<number>(0);

    useEffect(() => {
        const fetchWeather = async () => {
            if (Date.now() - lastFetchRef.current < 300000) return;
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${NJ_LAT}&longitude=${NJ_LON}&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m`;
                const resp = await fetch(url);
                const data = await resp.json();
                if (data.current) {
                    const weather: WeatherData = {
                        temp: data.current.temperature_2m,
                        windSpeed: data.current.wind_speed_10m,
                        windDirection: data.current.wind_direction_10m,
                        cloudCover: data.current.cloud_cover,
                        precipitation: data.current.precipitation,
                        condition: getWeatherCondition(data.current.weather_code),
                    };
                    setWeatherData(weather);
                    lastFetchRef.current = Date.now();
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 300000);
        return () => clearInterval(interval);
    }, [setWeatherData]);
}


function getWeatherCondition(code: number): string {
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly Cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 57) return "Drizzle";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    if (code <= 86) return "Snow Showers";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
}
