
const input = document.getElementById("city-input");
const searchButton = document.getElementById("search-btn");
const buttonText = document.getElementById("button-text");
const statusMessage = document.getElementById("status-message");
const dashboard = document.getElementById("weather-dashboard");

const weatherClasses = [
    "weather-default",
    "weather-sunny",
    "weather-cloudy",
    "weather-rain",
    "weather-storm",
    "weather-snow",
    "weather-fog"
];

// Inicializar el mapa centrado inicialmente en México
const map = L.map("map").setView([19.4326, -99.1332], 5);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let marker = null;

// Evitar insertar texto recibido de las API como HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Convertir los códigos meteorológicos WMO en descripciones
function getWeatherInfo(code, isDay) {
    if (code === 0) {
        return {
            description: "Despejado",
            icon: isDay ? "☀️" : "🌙",
            background: "weather-sunny"
        };
    }

    if (code === 1) {
        return {
            description: "Principalmente despejado",
            icon: isDay ? "🌤️" : "☁️",
            background: "weather-sunny"
        };
    }

    if (code === 2) {
        return {
            description: "Parcialmente nublado",
            icon: "⛅",
            background: "weather-cloudy"
        };
    }

    if (code === 3) {
        return {
            description: "Nublado",
            icon: "☁️",
            background: "weather-cloudy"
        };
    }

    if ([45, 48].includes(code)) {
        return {
            description: "Niebla",
            icon: "🌫️",
            background: "weather-fog"
        };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return {
            description: "Llovizna",
            icon: "🌦️",
            background: "weather-rain"
        };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return {
            description: "Lluvia",
            icon: "🌧️",
            background: "weather-rain"
        };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return {
            description: "Nieve",
            icon: "❄️",
            background: "weather-snow"
        };
    }

    if ([95, 96, 99].includes(code)) {
        return {
            description: "Tormenta eléctrica",
            icon: "⛈️",
            background: "weather-storm"
        };
    }

    return {
        description: "Condiciones variables",
        icon: "🌡️",
        background: "weather-cloudy"
    };
}

function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
}

async function searchLocation() {
    const city = input.value.trim();

    if (!city) {
        setStatus("Escribe una ciudad, estado o país para continuar.", true);
        input.focus();
        return;
    }

    searchButton.disabled = true;
    buttonText.textContent = "Buscando...";
    dashboard.hidden = true;

    setStatus("Buscando la ubicación en OpenStreetMap...");

    try {
        // 1. Obtener la ubicación real
        const geocodingURL = new URL(
            "https://nominatim.openstreetmap.org/search"
        );

        geocodingURL.search = new URLSearchParams({
            format: "jsonv2",
            q: city,
            limit: "1",
            "accept-language": "es"
        });

        const geoResponse = await fetch(geocodingURL);

        if (!geoResponse.ok) {
            throw new Error(
                "No se pudo consultar el servicio geográfico."
            );
        }

        const places = await geoResponse.json();

        if (!places.length) {
            setStatus(
                "No encontramos esa ubicación. Prueba con una ciudad y su país.",
                true
            );
            return;
        }

        const place = places[0];
        const latitude = Number(place.lat);
        const longitude = Number(place.lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            throw new Error("La ubicación no devolvió coordenadas válidas.");
        }

        // 2. Consultar el clima de las coordenadas encontradas
        setStatus("Ubicación encontrada. Consultando el clima actual...");

        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        weatherURL.search = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "is_day",
                "weather_code",
                "wind_speed_10m",
                "cloud_cover"
            ].join(","),
            timezone: "auto",
            forecast_days: "1"
        });

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error(
                "No se pudieron consultar los datos meteorológicos."
            );
        }

        const weatherData = await weatherResponse.json();
        const current = weatherData.current;

        if (!current) {
            throw new Error("La API no devolvió condiciones actuales.");
        }

        // 3. Interpretar el código meteorológico
        const info = getWeatherInfo(
            Number(current.weather_code),
            Number(current.is_day) === 1
        );

        // 4. Actualizar el fondo según el clima
        document.body.classList.remove(...weatherClasses);
        document.body.classList.add(info.background);

        // 5. Mostrar la ubicación y el clima
        document.getElementById("location-name").textContent =
            place.name || city;

        document.getElementById("location-description").textContent =
            place.display_name || city;

        document.getElementById("weather-icon").textContent =
            info.icon;

        document.getElementById("temperature").textContent =
            Number(current.temperature_2m).toFixed(1);

        document.getElementById("weather-condition").textContent =
            info.description;

        document.getElementById("feels-like").textContent =
            `Sensación térmica: ${Number(current.apparent_temperature).toFixed(1)} °C`;

        document.getElementById("humidity").textContent =
            `${current.relative_humidity_2m}%`;

        document.getElementById("wind-speed").innerHTML =
            `${Number(current.wind_speed_10m).toFixed(1)} <small>km/h</small>`;

        document.getElementById("apparent-temperature").textContent =
            `${Number(current.apparent_temperature).toFixed(1)}°`;

        document.getElementById("cloud-cover").textContent =
            `${current.cloud_cover}%`;

        document.getElementById("weather-time").textContent =
            `Hora local: ${weatherData.current.time.replace("T", " ")}`;

        document.getElementById("latitude").textContent =
            latitude.toFixed(5);

        document.getElementById("longitude").textContent =
            longitude.toFixed(5);

        // 6. Mover el mapa a la ubicación encontrada
        map.setView([latitude, longitude], 13);

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker([latitude, longitude])
            .addTo(map)
            .bindPopup(
                `<strong>${escapeHTML(place.name || city)}</strong><br>` +
                `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
            )
            .openPopup();

        // Enlace para abrir el mismo lugar en OpenStreetMap
        document.getElementById("open-map-link").href =
            `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`;

        // Mostrar el tablero y ajustar el tamaño del mapa
        dashboard.hidden = false;

        requestAnimationFrame(() => {
            map.invalidateSize();
        });

        setStatus(
            "✓ Ubicación encontrada y condiciones meteorológicas consultadas."
        );

    } catch (error) {
        console.error("Error al consultar los servicios:", error);

        setStatus(
            "No fue posible completar la consulta. Revisa tu conexión e inténtalo nuevamente.",
            true
        );

    } finally {
        searchButton.disabled = false;
        buttonText.textContent = "Explorar";
    }
}

// Buscar al pulsar el botón
searchButton.addEventListener("click", searchLocation);

// También permitir buscar pulsando Enter
input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        searchLocation();
    }
});
