export type WeatherType = 'Clear' | 'Rain' | 'Snow' | 'Heatwave' | 'Hurricane';

export interface Weather {
    condition: WeatherType;
    severity: number;
}
