import React from 'react';

import { Button, Space, Switch } from 'antd';

import {

    ApplyLocomotivePreset,

    IFrameCar,

    LocomotivePreset,

    SetLocomotiveBoilerCheats,

    SetLocomotiveBrakeAir,

    ResetLocomotiveMaxSpeed,

    SetLocomotiveSpeedBoost,

    WorldSettings,

} from '@rrox-plugins/world/shared';

import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';

import { useWorld } from '@rrox-plugins/world/renderer';

import { usePlayerName } from '../hooks';

import { useLocomotiveKeepState } from '../hooks/useLocomotiveKeepState';

import { isNearPlayer, NEAR_PLAYER_DISTANCE } from '../utils/distance';



export function LocomotiveCheatButtons( {

    frameIndex,

    data,

}: {

    frameIndex: number,

    data: IFrameCar,

} ) {

    const [ worldSettings ] = useSettings( WorldSettings );

    const canPreset = useHasCommunicatorAccess( ApplyLocomotivePreset );

    const applyPreset = useRPC( ApplyLocomotivePreset );

    const setBoiler = useRPC( SetLocomotiveBoilerCheats );

    const setBrakeAir = useRPC( SetLocomotiveBrakeAir );

    const applySpeedBoost = useRPC( SetLocomotiveSpeedBoost );
    const resetMaxSpeed = useRPC( ResetLocomotiveMaxSpeed );



    const cheatsReady = worldSettings.features.cheats && canPreset;

    const { state: keep, setState: setKeep, refresh } = useLocomotiveKeepState( frameIndex, !!cheatsReady );



    const world = useWorld();

    const playerName = usePlayerName( world );

    const player = world?.players.find( ( p ) => p.name === playerName );

    const nearPlayer = player ? isNearPlayer( player.location, data.location ) : false;



    if( !cheatsReady )

        return null;



    const cheatsBlocked = !nearPlayer;



    const preset = ( p: LocomotivePreset ) => () => {

        if( cheatsBlocked )

            return;

        applyPreset( frameIndex, p );

        setTimeout( () => void refresh(), 400 );

    };



    const BoilerRow = ( {

        label,

        opts,

        keepOn,

        setKeepOn,

    }: {

        label: string,

        opts: { maxPressure?: boolean, maxFire?: boolean, maxWaterTemp?: boolean, unlimitedSteam?: boolean },

        keepOn: boolean,

        setKeepOn: ( v: boolean ) => void,

    } ) => (

        <Space wrap size="small" style={{ marginBottom: 8 }}>

            <strong style={{ minWidth: 110 }}>{label}</strong>

            <Button size="small" type="primary" disabled={cheatsBlocked} onClick={() => {

                if( cheatsBlocked )

                    return;

                setBoiler( frameIndex, { ...opts, keep: false } );

            }}>

                Max

            </Button>

            <span style={{ fontSize: 12 }}>Immer</span>

            <Switch

                size="small"

                disabled={cheatsBlocked}

                checked={keepOn}

                onChange={( checked ) => {

                    if( cheatsBlocked )

                        return;

                    setKeepOn( checked );

                    setBoiler( frameIndex, { ...opts, keep: checked } );

                }}

            />

        </Space>

    );



    return (

        <div style={{ marginTop: 12 }}>

            <div style={{ fontWeight: 'bold', marginBottom: 10, textAlign: 'center', fontSize: 15 }}>

                Lok-Cheats

                {nearPlayer

                    ? <span style={{ display: 'block', fontSize: 11, color: '#389e0d', fontWeight: 600 }}>In deiner Nähe</span>

                    : <span style={{ display: 'block', fontSize: 11, color: '#a61d24', fontWeight: 600 }}>

                        Zu weit weg (&gt;{Math.round( NEAR_PLAYER_DISTANCE / 100 )} m) — Cheats deaktiviert

                    </span>

                }

            </div>

            <Space wrap style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>

                <Button type="primary" disabled={cheatsBlocked} onClick={preset( 'operational' )}>Betriebsbereit</Button>

                {data.boiler && <Button disabled={cheatsBlocked} onClick={preset( 'steam' )}>Dampf-Paket</Button>}

                {data.compressor && <Button disabled={cheatsBlocked} onClick={preset( 'diesel' )}>Diesel-Paket</Button>}

                {data.freight && <Button disabled={cheatsBlocked} onClick={preset( 'freight_loaded' )}>Güter voll</Button>}

            </Space>

            {data.boiler && (

                <>

                    <BoilerRow

                        label="Kesseldruck"

                        opts={{ maxPressure: true }}

                        keepOn={keep.boilerPressure}

                        setKeepOn={( v ) => setKeep( ( s ) => ( { ...s, boilerPressure: v } ) )}

                    />

                    <BoilerRow

                        label="Feuertemp."

                        opts={{ maxFire: true }}

                        keepOn={keep.boilerFire}

                        setKeepOn={( v ) => setKeep( ( s ) => ( { ...s, boilerFire: v } ) )}

                    />

                    <BoilerRow

                        label="Wassertemp."

                        opts={{ maxWaterTemp: true }}

                        keepOn={keep.boilerWaterTemp}

                        setKeepOn={( v ) => setKeep( ( s ) => ( { ...s, boilerWaterTemp: v } ) )}

                    />

                    <BoilerRow

                        label="Unbeg. Dampf"

                        opts={{ unlimitedSteam: true }}

                        keepOn={keep.unlimitedSteam}

                        setKeepOn={( v ) => setKeep( ( s ) => ( { ...s, unlimitedSteam: v } ) )}

                    />

                </>

            )}

            {data.compressor && (

                <Space wrap size="small" style={{ marginBottom: 8 }}>

                    <strong style={{ minWidth: 110 }}>Bremsluft</strong>

                    <Button size="small" type="primary" disabled={cheatsBlocked} onClick={() => {

                        if( cheatsBlocked )

                            return;

                        setBrakeAir( frameIndex, true );

                    }}>

                        Max

                    </Button>

                    <span style={{ fontSize: 12 }}>Immer</span>

                    <Switch

                        size="small"

                        disabled={cheatsBlocked}

                        checked={keep.brakeAir}

                        onChange={( checked ) => {

                            if( cheatsBlocked )

                                return;

                            setKeep( ( s ) => ( { ...s, brakeAir: checked } ) );

                            setBrakeAir( frameIndex, undefined, checked );

                        }}

                    />

                </Space>

            )}

            <Space wrap size="small" style={{ marginBottom: 8 }}>

                <strong style={{ minWidth: 110 }}>Speed-Boost</strong>

                <span style={{ fontSize: 12 }}>2× Max-Speed</span>

                <Switch

                    size="small"

                    disabled={cheatsBlocked}

                    checked={keep.speedBoost}

                    onChange={( checked ) => {

                        if( cheatsBlocked )

                            return;

                        setKeep( ( s ) => ( { ...s, speedBoost: checked } ) );

                        applySpeedBoost( frameIndex, checked, 2 );

                        if( !checked )
                            setTimeout( () => void refresh(), 400 );

                    }}

                />

            </Space>

            <div style={{ textAlign: 'center' }}>

                <Button

                    size="small"

                    danger

                    disabled={cheatsBlocked}

                    onClick={() => {

                        if( cheatsBlocked )

                            return;

                        applySpeedBoost( frameIndex, false, 2 );

                        resetMaxSpeed( frameIndex );

                        setKeep( ( s ) => ( { ...s, speedBoost: false } ) );

                        setTimeout( () => void refresh(), 400 );

                    }}

                >

                    Geschwindigkeit zurücksetzen

                </Button>

                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>

                    Wenn der Zug nach Speed-Boost dauerhaft langsam ist.

                </div>

            </div>

        </div>

    );

}


