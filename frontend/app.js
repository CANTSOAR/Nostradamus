const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let dpr = window.devicePixelRatio || 1;

function resize() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resize);
resize();

// UI Elements
const uiTick = document.getElementById('m-tick');
const uiLocs = document.getElementById('m-locs');
const uiInflation = document.getElementById('m-inflation');
const uiTax = document.getElementById('m-tax');
const uiAgents = document.getElementById('m-agents');
const uiStatus = document.getElementById('ws-status');
const btnPause = document.getElementById('btn-pause');
const tooltip = document.getElementById('tooltip');

// UI Controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnZin = document.getElementById('btn-zin');
const btnZout = document.getElementById('btn-zout');

// Visualization State
let ws;
let simData = null;
let renderData = null;
let isPaused = false;

// Pan & Zoom State
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let mouseX = 0;
let mouseY = 0;
let cssMouseX = 0;
let cssMouseY = 0;

btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.innerText = isPaused ? "Resume Viewer" : "Pause Viewer";
    btnPause.style.background = isPaused ? "#ff4d4d" : "#66fcf1";
    btnPause.style.color = isPaused ? "#fff" : "#0b0c10";
});

// Canvas Interaction Listeners
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.001; // Scale based on wheel delta
    const wheel = e.deltaY < 0 ? 1 : -1;
    let zoomFactor = Math.exp(wheel * zoomIntensity * Math.abs(e.deltaY));
    // fallback if deltaY is not smooth
    if (Math.abs(e.deltaY) < 1) zoomFactor = Math.exp(wheel * 0.1);

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * dpr;
    const ny = (e.clientY - rect.top) * dpr;

    offsetX = nx - (nx - offsetX) * zoomFactor;
    offsetY = ny - (ny - offsetY) * zoomFactor;
    zoom *= zoomFactor;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click pans
    isDragging = true;
    startDragX = (e.clientX * dpr) - offsetX;
    startDragY = (e.clientY * dpr) - offsetY;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    cssMouseX = e.clientX;
    cssMouseY = e.clientY;
    mouseX = (e.clientX - rect.left) * dpr;
    mouseY = (e.clientY - rect.top) * dpr;

    if (isDragging) {
        offsetX = (e.clientX * dpr) - startDragX;
        offsetY = (e.clientY * dpr) - startDragY;
    }
});

canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    tooltip.style.display = 'none';
});

// Button Controls
const PAN_STEP = 50;
btnUp.addEventListener('click', () => { offsetY += PAN_STEP * dpr; });
btnDown.addEventListener('click', () => { offsetY -= PAN_STEP * dpr; });
btnLeft.addEventListener('click', () => { offsetX += PAN_STEP * dpr; });
btnRight.addEventListener('click', () => { offsetX -= PAN_STEP * dpr; });
btnZin.addEventListener('click', () => {
    const factor = 1.3;
    const cx = (canvas.width / 2);
    const cy = (canvas.height / 2);
    offsetX = cx - (cx - offsetX) * factor;
    offsetY = cy - (cy - offsetY) * factor;
    zoom *= factor;
});
btnZout.addEventListener('click', () => {
    const factor = 1 / 1.3;
    const cx = (canvas.width / 2);
    const cy = (canvas.height / 2);
    offsetX = cx - (cx - offsetX) * factor;
    offsetY = cy - (cy - offsetY) * factor;
    zoom *= factor;
});

// Socket connection
function connect() {
    ws = new WebSocket('ws://127.0.0.1:8080');

    ws.onopen = () => {
        uiStatus.innerText = "● Engine Connected";
        uiStatus.style.borderColor = "#66fcf1";
        uiStatus.style.color = "#66fcf1";
    };

    ws.onmessage = (event) => {
        try {
            simData = JSON.parse(event.data);
            if (!isPaused) {
                renderData = simData; // Keep visual state locked if paused
            }
            updateDashboard();
        } catch (e) {
            console.error("Payload parse error", e);
        }
    };

    ws.onclose = () => {
        uiStatus.innerText = "○ Disconnected. Retrying...";
        uiStatus.style.borderColor = "#ff4d4d";
        uiStatus.style.color = "#ff4d4d";
        setTimeout(connect, 2000);
    };
}

function updateDashboard() {
    if (!simData) return;
    uiTick.innerText = simData.tick;
    uiLocs.innerText = (simData.locations_subset ? simData.locations_subset.length : 0);
    uiAgents.innerText = (simData.active_agents_subset ? simData.active_agents_subset.length : 0);

    if (simData.global_metrics) {
        uiInflation.innerText = (simData.global_metrics.inflation_rate * 100).toFixed(1) + "%";
        uiTax.innerText = (simData.global_metrics.base_tax_rate * 100).toFixed(1) + "%";
    }
}

// ---------------------------------
// Render Loop
// ---------------------------------
function render() {
    // Solid clear for clean panning (no trails)
    ctx.fillStyle = "#0b0c10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    const rect = canvas.getBoundingClientRect();
    const w = rect.width * dpr;
    const h = rect.height * dpr;

    const minLat = 38.8;
    const maxLat = 41.3;
    const minLon = -75.6;
    const maxLon = -73.8;
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;

    // Fit drawing exactly inside viewport while preserving map aspect ratio
    const geoAspect = lonDiff / latDiff;
    const screenAspect = w / h;

    let drawW, drawH, drawOffsetX, drawOffsetY;

    if (geoAspect > screenAspect) {
        // Fit by width
        drawW = w;
        drawH = w / geoAspect;
        drawOffsetX = 0;
        drawOffsetY = (h - drawH) / 2;
    } else {
        // Fit by height
        drawH = h;
        drawW = h * geoAspect;
        drawOffsetX = (w - drawW) / 2;
        drawOffsetY = 0;
    }

    function project(coord) {
        const x = drawOffsetX + ((coord.lon - minLon) / lonDiff) * drawW;
        const y = drawOffsetY + (drawH - (((coord.lat - minLat) / latDiff) * drawH));
        return { x, y };
    }

    let hoveredEntity = null;
    let hoveredEntityPriority = 0; // Prefer agents over locations when hovering over both

    // The mouse coordinates in the world space accounting for pan/zoom
    const worldMouseX = (mouseX - offsetX) / zoom;
    const worldMouseY = (mouseY - offsetY) / zoom;

    // Zoom-adjusted hover radius
    const hoverRadiusSq = Math.pow(6 / zoom, 2);

    if (renderData) {
        // Draw Locations
        if (renderData.locations_subset) {
            renderData.locations_subset.forEach(loc => {
                if (!loc.coord) return;
                const pos = project(loc.coord);

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);

                if (loc.location_type === "Store") ctx.fillStyle = "#ffaa00";
                else if (loc.location_type === "Employer") ctx.fillStyle = "#66fcf1";
                else if (loc.location_type === "Residential") ctx.fillStyle = "#4a4e69";
                else ctx.fillStyle = "#ffffff";

                ctx.fill();

                // Hover check for locations
                const dx = pos.x - worldMouseX;
                const dy = pos.y - worldMouseY;
                if (dx * dx + dy * dy < hoverRadiusSq && hoveredEntityPriority <= 1) {
                    hoveredEntity = `<strong>📍 Location: ${loc.name}</strong>Type: ${loc.location_type}\nCapacity: ${loc.capacity}`;
                    hoveredEntityPriority = 1;

                    // Highlight the location
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1.5 / zoom;
                    ctx.stroke();
                }
            });
        }

        // Draw Agents
        if (renderData.active_agents_subset) {
            renderData.active_agents_subset.forEach(agent => {
                if (!agent.current_coord) return;
                const pos = project(agent.current_coord);

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = "#ff4d4d";
                ctx.fill();

                // Hover check for agents (prioritized)
                const dx = pos.x - worldMouseX;
                const dy = pos.y - worldMouseY;
                if (dx * dx + dy * dy < hoverRadiusSq) {
                    hoveredEntity = `<strong>🚶 Agent ID: ${agent.id}</strong>Age: ${agent.age}\nWealth: $${agent.wealth.toFixed(2)}\nIncome: $${agent.income.toFixed(2)}`;
                    hoveredEntityPriority = 2;

                    // Highlight the agent
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1 / zoom;
                    ctx.stroke();
                }
            });
        }
    }

    ctx.restore();

    // Standardize Tooltip rendering
    if (hoveredEntity && !isDragging) {
        // Only show tooltip if we're hovered and not mid-pan
        tooltip.style.display = 'block';
        tooltip.style.left = (cssMouseX + 15) + 'px';
        tooltip.style.top = (cssMouseY + 15) + 'px';
        tooltip.innerHTML = hoveredEntity;
    } else {
        tooltip.style.display = 'none';
    }

    requestAnimationFrame(render);
}

// Boot
connect();
requestAnimationFrame(render);
