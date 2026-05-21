import React, { useState, useEffect } from 'react';
import { Slider } from 'antd';
import {
    FrameCarControl,
    IFrameCar,
    SetControlsCommunicator,
    WorldSettings,
} from '@rrox-plugins/world/shared';
import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';
import { isNearPlayer, NEAR_PLAYER_DISTANCE } from '../utils/distance';
import { useWorld } from '@rrox-plugins/world/renderer';
import { usePlayerName } from '../hooks';

export function FrameCheatSliders( {
    frameIndex,
    data,
}: {
    frameIndex: number,
    data: IFrameCar,
} ) {
    const [ worldSettings ] = useSettings( WorldSettings );
    const canControls = useHasCommunicatorAccess( SetControlsCommunicator );
    const setControls = useRPC( SetControlsCommunicator );
    const world = useWorld();
    const playerName = usePlayerName( world );
    const player = world?.players.find( ( p ) => p.name === playerName );

    const [ regulator, setRegulator ] = useState( ( data.controls.regulator ?? 0 ) * 100 );
    const [ brake, setBrake ] = useState( data.controls.brake * 100 );

    useEffect( () => {
        setRegulator( ( data.controls.regulator ?? 0 ) * 100 );
        setBrake( data.controls.brake * 100 );
    }, [ data.controls.regulator, data.controls.brake ] );

    if( !worldSettings.features.cheats || !canControls )
        return null;

    const near = player ? isNearPlayer( player.location, data.location ) : true;

    return (
        <div style={{
            marginTop: 12,
            padding: 12,
            border: '1px dashed #fa8c16',
            borderRadius: 8,
            background: '#fffbe6',
        }}>
            <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
                Steuerung (Cheat)
            </div>
            {!near && (
                <p style={{ fontSize: 12, color: '#ad6800', textAlign: 'center', marginBottom: 10 }}>
                    Lok ist weit weg (&gt;{Math.round( NEAR_PLAYER_DISTANCE / 100 )} m) – Wirkung in MP evtl. eingeschränkt.
                </p>
            )}
            <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Regler: {Math.round( regulator )}%</div>
                <Slider
                    min={0}
                    max={100}
                    value={regulator}
                    onChange={setRegulator}
                    onAfterChange={( v ) => setControls( frameIndex, FrameCarControl.Regulator, v / 100 )}
                />
            </div>
            <div>
                <div style={{ marginBottom: 4 }}>Bremse: {Math.round( brake )}%</div>
                <Slider
                    min={0}
                    max={100}
                    value={brake}
                    onChange={setBrake}
                    onAfterChange={( v ) => setControls( frameIndex, FrameCarControl.Brake, v / 100 )}
                />
            </div>
        </div>
    );
}
