const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let dpr = window.devicePixelRatio || 1;

function resize() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

window.addEventListener('resize', resize);
resize();

const uiTick = document.getElementById('m-tick');
const uiIrlTime = document.getElementById('m-irl-time');
const uiLocs = document.getElementById('m-locs');
const uiInflation = document.getElementById('m-inflation');
const uiTax = document.getElementById('m-tax');
const uiAgents = document.getElementById('m-agents');
const uiStatus = document.getElementById('ws-status');
const btnPause = document.getElementById('btn-pause');
const tooltip = document.getElementById('tooltip');
const pinsContainer = document.getElementById('pins-container');

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
let isDragMoved = false; // Prevents "clicks" from triggering during a pan
let startDragX = 0;
let startDragY = 0;
let mouseX = 0;
let mouseY = 0;
let cssMouseX = 0;
let cssMouseY = 0;

let hoveredEntityText = null;
let hoveredEntityData = null;

let pinnedEntities = [];
const MAX_PINS = 3;

btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.innerText = isPaused ? "Resume Viewer" : "Pause Viewer";
    btnPause.style.background = isPaused ? "#ff4d4d" : "#66fcf1";
    btnPause.style.color = isPaused ? "#fff" : "#0b0c10";

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(isPaused ? "pause" : "resume");
    }
});

// Canvas Interaction Listeners
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.001;
    const wheel = e.deltaY < 0 ? 1 : -1;
    let zoomFactor = Math.exp(wheel * zoomIntensity * Math.abs(e.deltaY));
    if (Math.abs(e.deltaY) < 1) zoomFactor = Math.exp(wheel * 0.1);

    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;

    offsetX = nx - (nx - offsetX) * zoomFactor;
    offsetY = ny - (ny - offsetY) * zoomFactor;
    zoom *= zoomFactor;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    isDragging = true;
    isDragMoved = false;
    startDragX = mx - offsetX;
    startDragY = my - offsetY;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    cssMouseX = e.clientX;
    cssMouseY = e.clientY;
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (isDragging) {
        const newOffsetX = mouseX - startDragX;
        const newOffsetY = mouseY - startDragY;
        if (Math.abs(newOffsetX - offsetX) > 2 || Math.abs(newOffsetY - offsetY) > 2) {
            isDragMoved = true;
        }
        offsetX = newOffsetX;
        offsetY = newOffsetY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    tooltip.style.display = 'none';
});

canvas.addEventListener('click', (e) => {
    if (isDragMoved) return; // Ignore if user was just panning the map

    if (hoveredEntityData) {
        // Toggle pin tracking
        const existingIdx = pinnedEntities.findIndex(p => p.type === hoveredEntityData.type && p.id === hoveredEntityData.id);
        if (existingIdx >= 0) {
            pinnedEntities.splice(existingIdx, 1);
        } else {
            if (pinnedEntities.length >= MAX_PINS) {
                pinnedEntities.shift();
            }
            pinnedEntities.push(hoveredEntityData);
        }
        updatePinsUI();
    }
});

function removePin(type, id) {
    pinnedEntities = pinnedEntities.filter(p => !(p.type === type && p.id === id));
    updatePinsUI();
}
window.removePin = removePin;

// Button Controls
const PAN_STEP = 50;
btnUp.addEventListener('click', () => { offsetY += PAN_STEP; });
btnDown.addEventListener('click', () => { offsetY -= PAN_STEP; });
btnLeft.addEventListener('click', () => { offsetX += PAN_STEP; });
btnRight.addEventListener('click', () => { offsetX -= PAN_STEP; });
btnZin.addEventListener('click', () => {
    const factor = 1.3;
    const cx = (canvas.parentElement.getBoundingClientRect().width / 2);
    const cy = (canvas.parentElement.getBoundingClientRect().height / 2);
    offsetX = cx - (cx - offsetX) * factor;
    offsetY = cy - (cy - offsetY) * factor;
    zoom *= factor;
});
btnZout.addEventListener('click', () => {
    const factor = 1 / 1.3;
    const cx = (canvas.parentElement.getBoundingClientRect().width / 2);
    const cy = (canvas.parentElement.getBoundingClientRect().height / 2);
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
                renderData = simData;
            }
            updateDashboard();
            updatePinsUI();
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

        if (simData.global_metrics.time_offset_seconds !== undefined) {
            // Base Date: Jan 1, 2010 00:00:00 UTC
            const baseDate = Date.UTC(2010, 0, 1, 0, 0, 0);
            const simDate = new Date(baseDate + (simData.global_metrics.time_offset_seconds * 1000));
            // Format to something readable: e.g. "Jan 1, 2010 14:00"
            uiIrlTime.innerText = simDate.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit', timeZone: 'UTC'
            });
        }
    }
}

function updatePinsUI() {
    if (!pinsContainer) return;

    // Track existing DOM cards to prevent rapid recreating (which breaks onclick events)
    const existingIds = Array.from(pinsContainer.children).map(c => c.getAttribute('data-pin-id'));
    const currentIds = pinnedEntities.map(p => `${p.type}-${p.id}`);

    // Remove lingering dead pins
    Array.from(pinsContainer.children).forEach(child => {
        if (!currentIds.includes(child.getAttribute('data-pin-id'))) {
            child.remove();
        }
    });

    pinnedEntities.forEach(pin => {
        const pinIdStr = `${pin.type}-${pin.id}`;
        let text = '';
        if (pin.type === 'loc') {
            const loc = (renderData?.locations_subset || []).find(l => l.id === pin.id);
            if (loc) {
                let orgInfo = "None";
                if (loc.organization_id && renderData.organizations) {
                    const org = renderData.organizations[loc.organization_id];
                    if (org) orgInfo = `${org.name} (Funds: $${org.total_funds.toFixed(2)})`;
                }
                text = `<strong>📍 Location: ${loc.name}</strong>ID: ${loc.id}\nType: ${loc.location_type}\nCapacity: ${loc.capacity}\nCounty: ${loc.county || 'None'}\nWealth: $${(loc.wealth || 0).toFixed(2)}\nOrganization: ${orgInfo}`;
            } else {
                text = `<strong>📍 Location ID: ${pin.id}</strong>\nOff-screen...`;
            }
        } else if (pin.type === 'agent') {
            const agent = (renderData?.active_agents_subset || []).find(a => a.id === pin.id);
            if (agent) {
                let transportName = "None";
                if (agent.transport_id && renderData.transports) {
                    const transport = renderData.transports.find(t => t.id === agent.transport_id);
                    if (transport) transportName = `${transport.transport_type} (${transport.speed_mph.toFixed(1)} mph)`;
                }
                text = `<strong>🚶 Agent ID: ${agent.id}</strong>Age: ${agent.age} | Health: ${(agent.health * 100).toFixed(1)}%\nWealth: $${agent.wealth.toFixed(2)}\nIncome: $${agent.income.toFixed(2)}/yr\nCounty: ${agent.home_county || 'None'} / Work: ${agent.work_county || 'None'}\nHome ID: ${agent.home_location_id}\nEmployer ID: ${agent.employer_location_id || "Unemployed"}\nTransport: ${transportName}`;
            } else {
                text = `<strong>🚶 Agent ID: ${pin.id}</strong>\nOff-screen...`;
            }
        }

        let existingCard = pinsContainer.querySelector(`[data-pin-id="${pinIdStr}"]`);
        if (!existingCard) {
            existingCard = document.createElement('div');
            existingCard.className = 'pin-card';
            existingCard.setAttribute('data-pin-id', pinIdStr);
            existingCard.innerHTML = `
                <div class="pin-close" onmousedown="removePin('${pin.type}', ${pin.id})">&times;</div>
                <div class="pin-content" style="white-space: pre-wrap; line-height: 1.4; padding-right: 15px;"></div>
            `;
            pinsContainer.appendChild(existingCard);
        }

        existingCard.querySelector('.pin-content').innerHTML = text;
    });
}

// ---------------------------------
// Render Loop
// ---------------------------------
function render() {
    // Reset transform completely
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.fillStyle = "#0b0c10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const minLat = 38.8;
    const maxLat = 41.3;
    const minLon = -75.6;
    const maxLon = -73.8;
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;

    const geoAspect = lonDiff / latDiff;
    const screenAspect = w / h;

    let drawW, drawH, drawOffsetX, drawOffsetY;

    if (geoAspect > screenAspect) {
        drawW = w;
        drawH = w / geoAspect;
        drawOffsetX = 0;
        drawOffsetY = (h - drawH) / 2;
    } else {
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

    hoveredEntityText = null;
    hoveredEntityData = null;
    let hoveredEntityPriority = 0;

    const worldMouseX = (mouseX - offsetX) / zoom;
    const worldMouseY = (mouseY - offsetY) / zoom;

    // Using 15 logical pixels for generous hit box 
    const hoverRadiusSq = Math.pow(15 / zoom, 2);

    if (renderData) {
        // Draw Locations
        if (renderData.locations_subset) {
            renderData.locations_subset.forEach(loc => {
                if (!loc.coord) return;
                const pos = project(loc.coord);

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);

                if (loc.location_type === "Store") ctx.fillStyle = "#ffaa00";
                else if (loc.location_type === "Employer") ctx.fillStyle = "#66fcf1";
                else if (loc.location_type === "Residential") ctx.fillStyle = "#9fa8da";
                else ctx.fillStyle = "#ffffff";

                ctx.fill();
                ctx.strokeStyle = "rgba(11, 12, 16, 0.8)";
                ctx.lineWidth = 1 / zoom;
                ctx.stroke();

                const dx = pos.x - worldMouseX;
                const dy = pos.y - worldMouseY;
                if (dx * dx + dy * dy < hoverRadiusSq && hoveredEntityPriority <= 1) {
                    let orgInfo = "None";
                    if (loc.organization_id && renderData.organizations) {
                        const org = renderData.organizations[loc.organization_id];
                        if (org) orgInfo = `${org.name} (Funds: $${org.total_funds.toFixed(2)})`;
                    }
                    hoveredEntityText = `<strong>📍 Location: ${loc.name}</strong>ID: ${loc.id}\nType: ${loc.location_type}\nCapacity: ${loc.capacity}\nCounty: ${loc.county || 'None'}\nWealth: $${(loc.wealth || 0).toFixed(2)}\nOrganization: ${orgInfo}`;
                    hoveredEntityData = { type: 'loc', id: loc.id };
                    hoveredEntityPriority = 1;

                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 2.5 / zoom;
                    ctx.stroke();
                }

                // Keep pinned elements highlighted!
                if (pinnedEntities.some(p => p.type === 'loc' && p.id === loc.id)) {
                    ctx.strokeStyle = "#66fcf1";
                    ctx.lineWidth = 3.0 / zoom;
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
                ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "#ff4d4d";
                ctx.fill();
                ctx.strokeStyle = "rgba(11, 12, 16, 0.8)";
                ctx.lineWidth = 1 / zoom;
                ctx.stroke();

                const dx = pos.x - worldMouseX;
                const dy = pos.y - worldMouseY;
                if (dx * dx + dy * dy < hoverRadiusSq) {
                    let transportName = "None";
                    if (agent.transport_id && renderData.transports) {
                        const transport = renderData.transports.find(t => t.id === agent.transport_id);
                        if (transport) transportName = `${transport.transport_type} (${transport.speed_mph.toFixed(1)} mph)`;
                    }
                    hoveredEntityText = `<strong>🚶 Agent ID: ${agent.id}</strong>Age: ${agent.age} | Health: ${(agent.health * 100).toFixed(1)}%\nWealth: $${agent.wealth.toFixed(2)}\nIncome: $${agent.income.toFixed(2)}/yr\nCounty: ${agent.home_county || 'None'} / Work: ${agent.work_county || 'None'}\nHome ID: ${agent.home_location_id}\nEmployer ID: ${agent.employer_location_id || "Unemployed"}\nTransport: ${transportName}`;
                    hoveredEntityData = { type: 'agent', id: agent.id };
                    hoveredEntityPriority = 2;

                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 2.0 / zoom;
                    ctx.stroke();
                }

                // Keep pinned elements highlighted!
                if (pinnedEntities.some(p => p.type === 'agent' && p.id === agent.id)) {
                    ctx.strokeStyle = "#66fcf1";
                    ctx.lineWidth = 2.5 / zoom;
                    ctx.stroke();
                }
            });
        }
    }

    ctx.restore();

    if (hoveredEntityText && !isDragging) {
        tooltip.style.display = 'block';
        tooltip.style.left = (cssMouseX + 15) + 'px';
        tooltip.style.top = (cssMouseY + 15) + 'px';
        tooltip.innerHTML = hoveredEntityText;
    } else {
        tooltip.style.display = 'none';
    }

    requestAnimationFrame(render);
}

// Boot
connect();
requestAnimationFrame(render);
