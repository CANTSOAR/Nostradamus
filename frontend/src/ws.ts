import { v4 as uuidv4 } from "uuid";

class WebSocketClient {
    public ws: WebSocket | null = null;
    private pendingCommands: Map<string, (value: any) => void> = new Map();
    private setSimulationData: ((data: any) => void) | null = null;
    private setSimulationStatus: ((status: "connected" | "disconnected" | "connecting") => void) | null = null;
    private isConnecting: boolean = false;

    public init(
        setSimulationData: (data: any) => void,
        setSimulationStatus: (status: "connected" | "disconnected" | "connecting") => void
    ) {
        this.setSimulationData = setSimulationData;
        this.setSimulationStatus = setSimulationStatus;
        this.connect();
    }

    private connect() {
        if (this.isConnecting || (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))) {
            return;
        }

        this.isConnecting = true;
        if (this.setSimulationStatus) this.setSimulationStatus("connecting");

        // In production this might need to point to the correct host/port
        const url = "ws://127.0.0.1:8080";

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnecting = false;
                if (this.setSimulationStatus) this.setSimulationStatus("connected");
                console.log("WebSocket connected to", url);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if ("tick" in data) {
                        // Payload frame
                        if (this.setSimulationData) {
                            this.setSimulationData(data);
                        }
                    } else if ("id" in data) {
                        // Command response
                        this.resolvePendingCommand(data.id, data);
                    }
                } catch (e) {
                    console.error("Failed to parse WebSocket message:", e, event.data);
                }
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                if (this.setSimulationStatus) this.setSimulationStatus("disconnected");
                console.log("WebSocket disconnected. Reconnecting in 2s...");
                setTimeout(() => this.connect(), 2000);
            };

            this.ws.onerror = (err) => {
                console.error("WebSocket error:", err);
            };
        } catch (e) {
            this.isConnecting = false;
            console.error("Failed to create WebSocket:", e);
            setTimeout(() => this.connect(), 2000);
        }
    }

    private resolvePendingCommand(id: string, response: any) {
        const resolve = this.pendingCommands.get(id);
        if (resolve) {
            resolve(response);
            this.pendingCommands.delete(id);
        }
    }

    public async sendCommand(action: string, params: object = {}): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("Cannot send command, WebSocket is not open.");
            return Promise.reject(new Error("WebSocket not connected"));
        }

        const id = uuidv4();
        return new Promise((resolve) => {
            this.pendingCommands.set(id, resolve);
            this.ws!.send(JSON.stringify({ id, action, params }));
        });
    }

    public sendTextCommand(text: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        this.ws.send(text);
    }
}

export const wsClient = new WebSocketClient();
