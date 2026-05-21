import React, { useContext, useMemo } from 'react';
import { Button, message } from 'antd';
import { MapContext } from '../context';
import { ILocation } from '@rrox-plugins/world/shared';
import { useWorld } from '@rrox-plugins/world/renderer';
import { usePlayerName } from '../hooks';
import { formatGameDistance, gameDistance } from '../utils/distance';
import { formatCoords } from '../utils/navigationHelpers';

export function MapTooltipExtras( {
    targetLocation,
    onPanToTarget,
    onPanToPlayer,
    onClose,
}: {
    targetLocation: ILocation,
    onPanToTarget?: () => void,
    onPanToPlayer?: () => void,
    onClose?: () => void,
} ) {
    const world = useWorld();
    const playerName = usePlayerName( world );

    const player = useMemo(
        () => world?.players.find( ( p ) => p.name === playerName ),
        [ world?.players, playerName ]
    );

    const distanceText = useMemo( () => {
        if( !player?.location )
            return null;
        return formatGameDistance( gameDistance( player.location, targetLocation ) );
    }, [ player?.location, targetLocation ] );

    return (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
            {distanceText && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    Entfernung zu dir: <strong>{distanceText}</strong>
                </div>
            )}
            {onPanToTarget && (
                <Button
                    size="small"
                    style={{ marginRight: 6 }}
                    onClick={() => {
                        onClose?.();
                        onPanToTarget();
                    }}
                >
                    Zentrieren
                </Button>
            )}
            {onPanToPlayer && player?.location && (
                <Button
                    size="small"
                    style={{ marginRight: 6 }}
                    onClick={() => {
                        onClose?.();
                        onPanToPlayer();
                    }}
                >
                    Zu mir
                </Button>
            )}
            <Button
                size="small"
                onClick={() => {
                    const text = formatCoords( targetLocation );
                    void navigator.clipboard.writeText( text ).then( () => {
                        message.success( 'Koordinaten kopiert' );
                    } );
                }}
            >
                Koordinaten
            </Button>
        </div>
    );
}
