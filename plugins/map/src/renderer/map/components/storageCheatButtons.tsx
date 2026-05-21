import React, { useEffect } from 'react';

import { Button, InputNumber, Space, Switch } from 'antd';

import {
    AddStorageCheats,
    ApplyLocomotivePreset,
    IFrameCar,

    SetStorageKeepFull,

    StorageCategory,

    StorageOwnerType,

    WorldSettings,

} from '@rrox-plugins/world/shared';

import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';

import { useLocomotiveKeepState } from '../hooks/useLocomotiveKeepState';
import { useWorld } from '@rrox-plugins/world/renderer';
import { usePlayerName } from '../hooks';
import { isNearPlayer, NEAR_PLAYER_DISTANCE } from '../utils/distance';



export function StorageCheatButtons( {

    frameIndex,

    data,

    ownerType = 'framecar',

    compact = false,

}: {

    frameIndex: number,

    data: IFrameCar,

    ownerType?: StorageOwnerType,

    compact?: boolean,

} ) {

    const [ worldSettings ] = useSettings( WorldSettings );

    const canStorageCheat = useHasCommunicatorAccess( AddStorageCheats );

    const canPreset = useHasCommunicatorAccess( ApplyLocomotivePreset );

    const addStorage = useRPC( AddStorageCheats );

    const setKeepFull = useRPC( SetStorageKeepFull );

    const applyPreset = useRPC( ApplyLocomotivePreset );



    const cheatsReady = worldSettings.features.cheats && canStorageCheat;

    const { state: keepState, setState: setKeepState, refresh } = useLocomotiveKeepState(

        frameIndex,

        cheatsReady && ownerType === 'framecar'

    );

    const world = useWorld();
    const playerName = usePlayerName( world );
    const player = world?.players.find( ( p ) => p.name === playerName );
    const nearPlayer = ownerType === 'framecar' && player
        ? isNearPlayer( player.location, data.location )
        : true;
    const cheatsBlocked = ownerType === 'framecar' && !nearPlayer;



    useEffect( () => {

        if( cheatsReady && ownerType === 'framecar' )

            void refresh();

    }, [ cheatsReady, ownerType, refresh ] );



    if( !cheatsReady )

        return (

            <div style={{

                textAlign: 'center',

                fontSize: 13,

                color: '#a61d24',

                margin: '8px 0',

                padding: 12,

                background: '#fff2f0',

                border: '1px solid #ffccc7',

                borderRadius: 6,

            }}>

                Lager-Cheats: <strong>Settings → World → Cheats</strong> aktivieren und <strong>Attach</strong> (Home).

            </div>

        );



    const Row = ( { label, category }: { label: string, category: StorageCategory } ) => {

        const [ delta, setDelta ] = React.useState<number | null>( null );

        const alwaysFull = keepState.storage[ category as keyof typeof keepState.storage ] ?? false;



        return (

            <Space wrap size="small" style={{ marginBottom: 8 }}>

                <strong style={{ minWidth: 100 }}>{label}</strong>

                <InputNumber

                    size="small"

                    placeholder="+ Menge"

                    style={{ width: 90 }}

                    disabled={cheatsBlocked}

                    value={delta ?? undefined}

                    onChange={( v ) => setDelta( typeof v === 'number' ? v : null )}

                />

                <Button

                    size="small"

                    disabled={cheatsBlocked || delta == null}

                    onClick={() => {

                        if( cheatsBlocked || delta == null )

                            return;

                        addStorage( ownerType, frameIndex, category, 0, delta );

                    }}

                >

                    Add

                </Button>

                <Button

                    size="small"

                    type="primary"

                    disabled={cheatsBlocked}

                    onClick={() => {

                        if( cheatsBlocked )

                            return;

                        addStorage( ownerType, frameIndex, category, 0, undefined, true );

                        setKeepFull( ownerType, frameIndex, category, 0, true );

                        setKeepState( ( prev ) => ( {

                            ...prev,

                            storage: { ...prev.storage, [ category ]: true },

                        } ) );

                    }}

                >

                    Max

                </Button>

                <span style={{ fontSize: 12 }}>Immer voll</span>

                <Switch

                    size="small"

                    disabled={cheatsBlocked}

                    checked={alwaysFull}

                    onChange={( checked ) => {

                        if( cheatsBlocked )

                            return;

                        setKeepFull( ownerType, frameIndex, category, 0, checked );

                        setKeepState( ( prev ) => ( {

                            ...prev,

                            storage: { ...prev.storage, [ category ]: checked },

                        } ) );

                        if( checked )

                            addStorage( ownerType, frameIndex, category, 0, undefined, true );

                    }}

                />

            </Space>

        );

    };



    return <div style={{

        width: '100%',

        padding: compact ? '4px 0' : '12px 8px',

        borderTop: compact ? undefined : '1px solid rgba(0,0,0,0.1)',

        marginTop: compact ? 0 : 8,

    }}>

        <div style={{ fontWeight: 'bold', marginBottom: 10, textAlign: 'center', fontSize: 15 }}>

            Lager-Cheats

            {ownerType === 'framecar' && (

                nearPlayer

                    ? <span style={{ display: 'block', fontSize: 11, color: '#389e0d', fontWeight: 600 }}>In deiner Nähe</span>

                    : <span style={{ display: 'block', fontSize: 11, color: '#a61d24', fontWeight: 600 }}>

                        Zu weit weg (&gt;{Math.round( NEAR_PLAYER_DISTANCE / 100 )} m) — Cheats deaktiviert

                    </span>

            )}

        </div>

        {ownerType === 'framecar' && canPreset && (

            <div style={{ textAlign: 'center', marginBottom: 10 }}>

                <Button type="primary" size="small" disabled={cheatsBlocked} onClick={() => {

                    if( cheatsBlocked )

                        return;

                    applyPreset( frameIndex, 'operational' );

                }}>

                    Betriebsbereit (Lager + Kessel)

                </Button>

            </div>

        )}

        <p style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 10 }}>

            Einmal „Max“ reicht oft nicht – das Spiel leert Tender/Kessel laufend. <strong>Immer voll</strong> füllt alle 0,1 s nach.

        </p>

        {data.boiler && <Row label="Wasser (Kessel)" category="boiler_water" />}

        {data.tender && <Row label="Wasser (Tender)" category="tender_water" />}

        {data.boiler && <Row label="Kohle (Kessel)" category="boiler_fuel" />}

        {data.tender && <Row label="Kohle (Tender)" category="tender_fuel" />}

        {data.freight && <Row label="Ladung" category="freight" />}

    </div>;

}


