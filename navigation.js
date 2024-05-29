"use strict";

// Global variables
let map,
  originMarkerLocation,
  destinationMarkerLocation,
  json,
  alternativeAnzahl;

var selectedTransportationMode = "car";
var searchResults = [];
var originLocation;
var destinationLocation;

const startListe = [];
const startHintergrundListeLat = [];
const startHintergrundListeLon = [];
const zielListe = [];
const zielHintergrundListeLat = [];
const zielHintergrundListeLon = [];

let markerGroupStart, markerGroupZiel, routeGroup;

// Different icon colors
const ColorIcon = L.Icon.extend({
  options: {
    shadowUrl: "marker_shadow.png",
    iconSize: [25, 41],
    shadowSize: [25, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [6, 41],
    popupAnchor: [-5, -20],
  },
});
const greenIcon = new ColorIcon({ iconUrl: "marker_icon_green.png" });
const redIcon = new ColorIcon({ iconUrl: "marker_icon_red.png" });

class SearchResult {
  constructor(displayName, lat, lon) {
    this.displayName = displayName;
    this.lat = lat;
    this.lon = lon;
  }
}

// Standard initialization
function initMap() {
  map = L.map("map", {
    zoomControl: false,
  });

  markerGroupStart = L.layerGroup().addTo(map);
  markerGroupZiel = L.layerGroup().addTo(map);
  routeGroup = L.layerGroup().addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  map.setView([51, 10], 6);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  // Add event listeners
  var selectors = document.getElementsByClassName("transportation-radio");
  for (let selector of selectors) {
    console.log(selector);
    selector.addEventListener("click", function () {
      console.log(this.value);
      selectedTransportationMode = this.value;
    });
  }
  document.getElementById("origin-input-field")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchLocation("origin-input-field");
      }
    });

  document.getElementById("destination-input-field")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchLocation("destination-input-field");
      }
    });
  /* document
    .getElementById("btn-search-origin")
    .addEventListener("click", searchStartLocations);
  document
    .getElementById("btn-search-destination")
    .addEventListener("click", searchDestinationLocation); */
  document
    .getElementById("dropdown-origin-locations")
    .addEventListener("change", setOriginMarker);
  document
    .getElementById("dropdown-destination-locations")
    .addEventListener("change", setDestinationMarker);
  document.getElementById("route").addEventListener("click", loadBestRoute);
  document
    .getElementById("alternative")
    .addEventListener("click", displayAlternativeRoutes);
  document
    .getElementById("tauschen")
    .addEventListener("click", switchOriginAndDestination);
  document.getElementById("reset").addEventListener("click", reset);
}

async function searchLocation(elementId) {
  searchResults = [];
  const query = document.getElementById(elementId).value;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.append("q", query);
  url.searchParams.append("format", "jsonv2");

  const response = await fetch(url);

  const searchResultsJson = await response.json();
  searchResultsJson.forEach((location) => {
    searchResults.push(
      new SearchResult(location.display_name, location.lat, location.lon)
    );
  });
  console.log(searchResults);
  drawSearchResults(elementId);
}

function drawSearchResults(inputFieldId) {
  const container = document.getElementById("search-results-wrapper");
  searchResults.forEach((result) => {
    const element = document.createElement("span");
    element.textContent = result.displayName;
    element.addEventListener("click", () => {
      onResultClick(result, inputFieldId);
    });
    container.appendChild(element);
  });
}

function onResultClick(result, inputFieldId) {
  const container = document.getElementById("search-results-wrapper");
  if (inputFieldId === "origin-input-field") {
    originLocation = result;
  } else {
    destinationLocation = result;
  }
  drawMarker(result.lat, result.lon, inputFieldId === "origin-input-field" ? greenIcon : redIcon);
  if (inputFieldId === "destination-input-field") {
    fetchRouteJSON();
  }
  document.getElementById(inputFieldId).value = result.displayName;
  container.innerHTML = "";
}

function drawMarker(lat, lon, icon) {
  L.marker([lat, lon], { icon }).addTo(map);
}

async function fetchRouteJSON() {
  const url = new URL(
    `https://routing.openstreetmap.de/routed-${selectedTransportationMode}/route/v1/dummy/${originLocation.lon},${originLocation.lat};${destinationLocation.lon},${destinationLocation.lat}?alternatives=3&overview=full`
  );
  url.searchParams.append("geometries", "geojson");
  console.log(url);
  const response = await fetch(url);
  const json = await response.json();
  drawRoute(json.routes[0]);
  return response.json();
}

function drawRoute(route, color = "blue") {
  console.log(route);
  const distance = Math.round(route.distance / 1000); // Distance in km
  const hourDuration = parseInt(route.duration / 60 / 60); // Duration in hours
  const minuteDuration = parseInt((route.duration / 60) % 60); // Duration in minutes

  const geoJsonRoute = L.geoJSON(route.geometry, {
    style: { color, weight: 4, smoothFactor: 1 },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(
        `Distanz: ${distance} km <br> Zeit: ${hourDuration} Stunde(n) ${minuteDuration} Minuten.`
      );
    },
  });

  geoJsonRoute.addTo(routeGroup);
  map.fitBounds(geoJsonRoute.getBounds().pad(0.15));
}

async function loadBestRoute() {
  const verkehrsmittel = getTransportationMode();
  if (!verkehrsmittel) return;

  routeGroup.clearLayers();
  json = await fetchRouteJSON(verkehrsmittel);

  if (json.code === "NoRoute") {
    alert(
      "Route konnte nicht berechnet werden. Bitte überprüfen Sie Ihre Eingabe!"
    );
  } else {
    drawRoute(json.routes[0]);
    alternativeAnzahl = json.routes.length;
  }
}

async function displayAlternativeRoutes() {
  const alternativeRoutes = json.routes.slice(1);
  if (alternativeRoutes.length === 0) {
    alert("Keine weiteren Routen möglich");
    return;
  }
  routeGroup.clearLayers();
  alternativeRoutes.forEach((route) => drawRoute(route, "skyblue"));
  drawRoute(json.routes[0], "blue");
}

function switchOriginAndDestination() {
  const startInput = document.getElementById("start");
  const zielInput = document.getElementById("ziel");
  const listestartInput = document.getElementById("dropdown-origin-locations");
  const listezielInput = document.getElementById(
    "dropdown-destination-locations"
  );

  // Swap coordinates
  [originMarkerLocation, destinationMarkerLocation] = [
    destinationMarkerLocation,
    originMarkerLocation,
  ];

  // Swap input fields
  [startInput.value, zielInput.value] = [zielInput.value, startInput.value];
  [listestartInput.value, listezielInput.value] = [
    listezielInput.value,
    listestartInput.value,
  ];

  // Update markers
  setOriginMarker();
  setDestinationMarker();
}

function reset() {
  location.reload();
}

function hide() {
  const element = document.getElementById("search-ui-main");
  element.style.display = element.style.display === "none" ? "block" : "none";
}
