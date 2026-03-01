// Groq LLM integration for the AI Sidebar
// Uses the Groq Cloud API (OpenAI-compatible) with llama-3.3-70b-versatile

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Store API key in localStorage
export function getGroqApiKey(): string | null {
    return localStorage.getItem('groq_api_key');
}

export function setGroqApiKey(key: string): void {
    localStorage.setItem('groq_api_key', key);
}

export function hasGroqApiKey(): boolean {
    return !!localStorage.getItem('groq_api_key');
}

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GroqResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}

const SYSTEM_PROMPT = `You are Nostradamus AI, an intelligent assistant for a New Jersey economic simulation. You help users understand and interact with a simulation of NJ's economy, population, housing, and employment.

You have access to these simulation commands via a special syntax. When you want to execute a command, wrap it in <cmd>{"action": "...", "params": {...}}</cmd> tags. The system will execute the command and show you the result.

Available commands:
- get_state: Get statewide overview (population, wealth, taxes, etc.)
- get_county {county: "COUNTY_NAME"}: Get county details
- get_municipality {county: "COUNTY", municipality: "NAME"}: Get municipality details
- get_agent {id: number}: Get agent details (person in simulation)
- get_location {id: number}: Get location details
- search_agents {county?: string, min_wealth?: number, max_wealth?: number, employed?: bool, limit?: number}
- search_locations {county?: string, type?: string, query?: string, limit?: number}
- set_tax_rate {value: number}: Modify state tax rate (0.0 to 1.0)
- set_fed_rate {value: number}: Modify federal funds rate
- stimulus_check {amount: number}: Give all residents money
- mass_layoff {pct: number}: Fire % of workers statewide
- depreciate_homes {pct: number}: Reduce all home values by %
- appreciate_homes {pct: number}: Increase all home values by %
- pandemic {severity: number}: Trigger pandemic (0-1 severity)
- spawn_weather {type: string, severity: number}: Spawn weather event
- set_speed {speed: string}: Change simulation speed ("1x","5x","10x","25x","50x","max")
- get_history {metric: string, county?: string, ticks?: number}: Get time-series data

Be conversational, concise, and helpful. When asked to modify the simulation, use the command syntax. When presenting data, format it nicely. Keep responses under 200 words unless showing data tables.

Important: You're helping analyze a complex agent-based model of New Jersey. Users may want to explore "what if" scenarios like recessions, stimuli, natural disasters, etc.`;

export async function chatWithGroq(
    messages: GroqMessage[],
    onStream?: (token: string) => void,
): Promise<string> {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
        throw new Error('No Groq API key set. Click the Settings icon to add your key.');
    }

    const body = {
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
    };

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data: GroqResponse = await response.json();
    return data.choices[0]?.message?.content || 'No response from model.';
}

// Parse <cmd> tags from LLM response
export function extractCommands(text: string): Array<{ action: string; params: Record<string, any> }> {
    const cmds: Array<{ action: string; params: Record<string, any> }> = [];
    const regex = /<cmd>(.*?)<\/cmd>/gs;
    let match;
    while ((match = regex.exec(text)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            cmds.push({ action: parsed.action, params: parsed.params || {} });
        } catch {
            // skip malformed commands
        }
    }
    return cmds;
}

// Clean <cmd> tags from display text
export function cleanResponse(text: string): string {
    return text.replace(/<cmd>.*?<\/cmd>/gs, '').trim();
}
