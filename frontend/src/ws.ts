import { SimulationPayload, CommandResponse } from './types';

type PayloadCallback = (payload: SimulationPayload) => void;
type CommandCallback = (response: CommandResponse) => void;

class SimulationWS {
    private ws: WebSocket | null = null;
    private payloadListeners: PayloadCallback[] = [];
    private pendingCommands: Map<string, CommandCallback> = new Map();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    connect(url = 'ws://127.0.0.1:8080') {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[WS] Connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if ('tick' in data && 'global_metrics' in data) {
                    // Payload frame
                    for (const cb of this.payloadListeners) cb(data as SimulationPayload);
                } else if ('id' in data) {
                    // Command response
                    const cb = this.pendingCommands.get(data.id);
                    if (cb) {
                        cb(data as CommandResponse);
                        this.pendingCommands.delete(data.id);
                    }
                }
            } catch (e) {
                // Non-JSON message, ignore
            }
        };

        this.ws.onclose = () => {
            console.log('[WS] Disconnected, reconnecting in 2s...');
            this.reconnectTimer = setTimeout(() => this.connect(url), 2000);
        };

        this.ws.onerror = () => {
            this.ws?.close();
        };
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }

    onPayload(cb: PayloadCallback) {
        this.payloadListeners.push(cb);
        return () => {
            this.payloadListeners = this.payloadListeners.filter(l => l !== cb);
        };
    }

    send(text: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(text);
        }
    }

    sendCommand(action: string, params: Record<string, any> = {}): Promise<CommandResponse> {
        return new Promise((resolve) => {
            const id = crypto.randomUUID();
            this.pendingCommands.set(id, resolve);
            this.send(JSON.stringify({ id, action, params }));
            // Timeout after 10s
            setTimeout(() => {
                if (this.pendingCommands.has(id)) {
                    this.pendingCommands.delete(id);
                    resolve({ id, ok: false, error: 'Timeout' });
                }
            }, 10000);
        });
    }

    pause() { this.send('pause'); }
    resume() { this.send('resume'); }
    setCounty(name: string) { this.send(`county:${name}`); }
    setViewport(latMin: number, latMax: number, lonMin: number, lonMax: number) {
        this.send(`viewport:${latMin},${latMax},${lonMin},${lonMax}`);
    }

    get connected() { return this.ws?.readyState === WebSocket.OPEN; }
}

export const ws = new SimulationWS();
