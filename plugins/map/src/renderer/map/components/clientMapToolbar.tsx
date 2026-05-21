import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    ApplyLocomotivePreset,
    TeleportCommunicator,
    WorldSettings,
} from '@rrox-plugins/world/shared';
import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';
import { useWorld } from '@rrox-plugins/world/renderer';
import { useMyLocomotive } from '../hooks/useMyLocomotive';
import { findNearestByLocation, formatDistanceLabel } from '../utils/navigationHelpers';

export function ClientMapToolbar() {
    const world = useWorld();
    const navigate = useNavigate();
    const [ worldSettings ] = useSettings( WorldSettings );
    const teleport = useRPC( TeleportCommunicator );
    const applyPreset = useRPC( ApplyLocomotivePreset );
    const canPreset = useHasCommunicatorAccess( ApplyLocomotivePreset );
    const {
        playerName,
        myLoc,
        bookmark,
        nearestEngineInRange,
    } = useMyLocomotive();

    if( !world )
        return null;

    const teleportEnabled = worldSettings.features.teleport;
    const cheatsEnabled = worldSettings.features.cheats && canPreset;
    const playerLoc = world.players.find( ( p ) => p.name === playerName )?.location;

    const nearestTower = findNearestByLocation( world.watertowers, playerLoc );
    const nearestSand = findNearestByLocation( world.sandhouses, playerLoc );

    const openControls = ( index: number ) => {
        navigate( `/@rrox-plugins/map/controls/${index}` );
    };

    const teleportTo = ( location: { X: number, Y: number, Z: number }, zOffset = 1000 ) => {
        teleport( playerName, {
            X: location.X,
            Y: location.Y,
            Z: location.Z + zOffset,
        } );
    };

    const locLabel = myLoc
        ? ( myLoc.frame.number?.trim() || myLoc.frame.name || `#${myLoc.index}` )
        : null;

    return (
        <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2500,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            maxWidth: 220,
        }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Client-Shortcuts</span>

                {myLoc && (
                    <Tooltip title={locLabel ? `Entfernung: ${formatDistanceLabel( myLoc.distance )}` : undefined}>
                        <Button
                            size="small"
                            type="primary"
                            block
                            onClick={() => openControls( myLoc.index )}
                        >
                            Meine Lok{locLabel ? `: ${locLabel}` : ''}
                        </Button>
                    </Tooltip>
                )}

                {myLoc && nearestEngineInRange && nearestEngineInRange.index !== myLoc.index && (
                    <Button size="small" block onClick={() => bookmark( nearestEngineInRange.index )}>
                        Nächste Lok merken
                    </Button>
                )}

                {teleportEnabled && nearestTower && (
                    <Button
                        size="small"
                        block
                        onClick={() => teleportTo( nearestTower.item.location )}
                    >
                        Wasserturm ({formatDistanceLabel( nearestTower.distance )})
                    </Button>
                )}

                {teleportEnabled && nearestSand && (
                    <Button
                        size="small"
                        block
                        onClick={() => teleportTo( nearestSand.item.location )}
                    >
                        Sandhaus ({formatDistanceLabel( nearestSand.distance )})
                    </Button>
                )}

                {cheatsEnabled && nearestEngineInRange && (
                    <Button
                        size="small"
                        block
                        onClick={() => applyPreset( nearestEngineInRange.index, 'operational' )}
                    >
                        Betriebsbereit (nächste Lok)
                    </Button>
                )}

                <span style={{ fontSize: 11, color: '#666', lineHeight: 1.35 }}>
                    Immer voll: Open Controls → Lager- &amp; Lok-Cheats (nicht Industrie).
                </span>
            </Space>
        </div>
    );
}
