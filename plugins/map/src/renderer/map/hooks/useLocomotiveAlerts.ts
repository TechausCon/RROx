import { useEffect, useRef } from 'react';
import { notification } from 'antd';
import { useWorld } from '@rrox-plugins/world/renderer';
import { useMyLocomotive } from './useMyLocomotive';
import { isNearPlayer } from '../utils/distance';

const ALERT_COOLDOWN_MS = 45000;

type AlertKey = 'pressure' | 'water' | 'brake';

export function useLocomotiveAlerts( enabled: boolean ) {
    const world = useWorld();
    const { myLoc, player } = useMyLocomotive();
    const lastAlert = useRef<Partial<Record<AlertKey, number>>>( {} );

    useEffect( () => {
        if( !enabled || !world || !myLoc || !player?.location )
            return;

        if( !isNearPlayer( player.location, myLoc.frame.location ) )
            return;

        const frame = myLoc.frame;
        const label = frame.number?.trim() || frame.name || `Lok #${myLoc.index}`;
        const now = Date.now();

        const warn = ( key: AlertKey, message: string, description: string ) => {
            const last = lastAlert.current[ key ] ?? 0;
            if( now - last < ALERT_COOLDOWN_MS )
                return;
            lastAlert.current[ key ] = now;
            notification.warning( {
                message,
                description,
                placement: 'bottomRight',
                duration: 6,
            } );
        };

        if( frame.boiler ) {
            const pressureLow = frame.boiler.maxPressure > 0
                ? frame.boiler.pressure / frame.boiler.maxPressure < 0.25
                : frame.boiler.pressure < 80;
            const waterLow = frame.boiler.maxWaterAmount > 0
                ? frame.boiler.waterAmount / frame.boiler.maxWaterAmount < 0.2
                : frame.boiler.waterAmount < 500;

            if( pressureLow )
                warn(
                    'pressure',
                    `${label}: niedriger Kesseldruck`,
                    `Druck ${Math.round( frame.boiler.pressure )} — Open Controls → Betriebsbereit oder Immer voll.`
                );

            if( waterLow )
                warn(
                    'water',
                    `${label}: wenig Kesselwasser`,
                    `Wasser ${Math.round( frame.boiler.waterAmount )} / ${Math.round( frame.boiler.maxWaterAmount )}.`
                );
        }

        if( frame.compressor && frame.compressor.airPressure < 80 )
            warn(
                'brake',
                `${label}: wenig Bremsluft`,
                `Luftdruck ${Math.round( frame.compressor.airPressure )} — Max / Immer in Lok-Cheats.`
            );
    }, [ enabled, world, myLoc, player?.location ] );
}
