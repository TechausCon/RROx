import { SharedCommunicator } from "@rrox/api";

export type LocomotivePreset = 'operational' | 'steam' | 'diesel' | 'freight_loaded';

export const ApplyLocomotivePreset = SharedCommunicator<{
    rpc: ( frameIndex: number, preset: LocomotivePreset ) => void,
}>( PluginInfo, 'ApplyLocomotivePreset' );

export const SetLocomotiveBoilerCheats = SharedCommunicator<{
    rpc: (
        frameIndex: number,
        options: {
            maxPressure?: boolean,
            maxFire?: boolean,
            maxWaterTemp?: boolean,
            unlimitedSteam?: boolean,
            keep?: boolean,
        }
    ) => void,
}>( PluginInfo, 'SetLocomotiveBoilerCheats' );

/** fillMax: einmal auffüllen. keep: Dauerhaft volle Bremsluft (enabled = fillMax). */
export const SetLocomotiveBrakeAir = SharedCommunicator<{
    rpc: ( frameIndex: number, fillMax?: boolean, keepEnabled?: boolean ) => void,
}>( PluginInfo, 'SetLocomotiveBrakeAir' );

export const SetLocomotiveSpeedBoost = SharedCommunicator<{
    rpc: ( frameIndex: number, enabled: boolean, multiplier?: number ) => void,
}>( PluginInfo, 'SetLocomotiveSpeedBoost' );

/** Aktive „Immer“-Loops für UI-Sync (Schalter bleiben nach Refresh/Navigation an). */
export interface ILocomotiveKeepState {
    storage: Partial<Record<'boiler_water' | 'boiler_fuel' | 'tender_water' | 'tender_fuel' | 'freight', boolean>>;
    boilerPressure: boolean;
    boilerFire: boolean;
    boilerWaterTemp: boolean;
    unlimitedSteam: boolean;
    brakeAir: boolean;
    speedBoost: boolean;
}

export const GetLocomotiveKeepState = SharedCommunicator<{
    rpc: ( frameIndex: number ) => ILocomotiveKeepState,
}>( PluginInfo, 'GetLocomotiveKeepState' );

/** Setzt maxspeedms zurück (nach Speed-Boost oder zu niedrigem Wert im Speicher). */
export const ResetLocomotiveMaxSpeed = SharedCommunicator<{
    rpc: ( frameIndex: number ) => void,
}>( PluginInfo, 'ResetLocomotiveMaxSpeed' );
