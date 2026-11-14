// Import Mapbox GL JS
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoibXVza2EtbWVzZGFxIiwiYSI6ImNtd2ZyZ3hxajA1MzgyeG9teHpyNnM0eXIifQ.AzqRYb0mqKvljveO9f5h1Q';

// Create the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
});

map.on('load', () => {
    map.addSource('boston-bike-lanes', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston-bike-lanes',
        paint: {
            'line-color': '#32CD32',
            'line-width': 3
        }
    });
    map.addSource('cambridge-bike-lanes', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge-bike-lanes',
        paint: {
            'line-color': '#32CD32',
            'line-width': 3
        }
    });
});

async function loadStations() {
    const stationData = await d3.json(
        'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    );

    const stations = stationData.data.stations;

    const svg = d3.select('#station-overlay');

    function updatePositions() {
        svg.selectAll('circle')
            .attr('cx', d => map.project([d.lon, d.lat]).x)
            .attr('cy', d => map.project([d.lon, d.lat]).y);
    }

    svg.selectAll('circle')
        .data(stations)
        .join('circle')
        .attr('r', d => {
            const traffic = window.stationTraffic?.[d.short_name] || 0;
            return 3 + Math.sqrt(traffic) * 0.3;
        })
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.7)
        .append('title')
.       text(d => {
            const traffic = window.stationTraffic?.[d.short_name] || 0;
            return `${d.name}\nTotal trips: ${traffic}`;
        });

    updatePositions();

    map.on('move', updatePositions);

    console.log('Stations displayed:', stations.length);
}

loadStations();

function getMinutesSinceMidnight(dateString) {
    const time = dateString.split(' ')[1];
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

async function loadTrips() {
    const trips = await d3.csv(
        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv'
    );

    trips.forEach(trip => {
        trip.startMinutes = getMinutesSinceMidnight(trip.started_at);
        trip.endMinutes = getMinutesSinceMidnight(trip.ended_at);
    });

    console.log('First trip start time:', trips[0].startMinutes);
    console.log('First trip end time:', trips[0].endMinutes);
    
    const stationTraffic = {};

    trips.forEach(trip => {
        const start = trip.start_station_id;
        const end = trip.end_station_id;

        if (start) {
            stationTraffic[start] = (stationTraffic[start] || 0) + 1;
        }

        if (end) {
            stationTraffic[end] = (stationTraffic[end] || 0) + 1;
        }
    });

    allTrips = trips;
    updateTrafficByTime(Number(timeSlider.value));
    console.log('Total bike trips:', trips.length);
    window.stationTraffic = stationTraffic;

    d3.select('#station-overlay')
        .selectAll('circle')
        .attr('r', d => {
            const traffic = stationTraffic[d.short_name] || 0;
            return 3 + Math.sqrt(traffic) * 0.3;
        });

    d3.select('#station-overlay')
        .selectAll('circle')
        .select('title')
        .text(d => {
            const traffic = stationTraffic[d.short_name] || 0;
            return `${d.name}\nTotal trips: ${traffic}`;
        });
    
    console.log('Station traffic:', stationTraffic);

    return stationTraffic;
}

loadTrips();

let allTrips = [];

function updateTrafficByTime(selectedMinutes) {
    if (allTrips.length === 0) return;

    const stationTraffic = {};
    const departures = {};
    const arrivals = {};
    const timeWindow = 60;

    allTrips.forEach(trip => {
        const startDifference = Math.abs(
            trip.startMinutes - selectedMinutes
        );

        const endDifference = Math.abs(
            trip.endMinutes - selectedMinutes
        );

        if (startDifference <= timeWindow) {
            const id = trip.start_station_id;
            if (id) {
                stationTraffic[id] = (stationTraffic[id] || 0) + 1;
                departures[id] = (departures[id] || 0) + 1;
            }
        }

        if (endDifference <= timeWindow) {
            const id = trip.end_station_id;
            if (id) {
                stationTraffic[id] = (stationTraffic[id] || 0) + 1;
                arrivals[id] = (arrivals[id] || 0) + 1;
            }
        }
    });

    console.log('Departures:', departures);
    console.log('Arrivals:', arrivals);

    d3.select('#station-overlay')
        .selectAll('circle')
        .attr('r', d => {
            const traffic = stationTraffic[d.short_name] || 0;
            return 3 + Math.sqrt(traffic) * 0.3;
        })
        .attr('fill', d => {
            const id = d.short_name;
            const out = departures[id] || 0;
            const incoming = arrivals[id] || 0;

            if (out > incoming) {
                return 'orange';
            } else if (incoming > out) {
                return 'steelblue';
            } else {
                return 'mediumpurple';
            }
        })
        .select('title')
        .text(d => {
            const traffic = stationTraffic[d.short_name] || 0;
            return `${d.name}\nTrips near selected time: ${traffic}`;
        });
}

const timeSlider = document.querySelector('#time-slider');
const selectedTime = document.querySelector('#selected-time');

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const period = hours >= 12 && hours < 24 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
}

timeSlider.addEventListener('input', () => {
    const minutes = Number(timeSlider.value);

    selectedTime.textContent = formatTime(minutes);
    updateTrafficByTime(minutes);
});