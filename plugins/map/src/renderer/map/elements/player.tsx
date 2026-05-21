import React, { useContext, useState } from 'react';
import L from 'leaflet';
import { LayerGroup } from 'react-leaflet';
import { MapContext } from '../context';
import { Shape, MapTooltip, PlayerNameLabel } from '../leaflet';
import { MapTooltipExtras } from '../components';
import { Button } from 'antd';
import { Cheats } from '../popups';
import { IPlayer } from '@rrox-plugins/world/shared';
import { MapMode } from '../types';
import { usePopupElements } from '../hooks';
import { useWorld } from '@rrox-plugins/world/renderer';

export const Player = React.memo( function Player( { data, index }: { data: IPlayer, index: number } ) {
    const { utils, follow, mode, settings, preferences, currentPlayerName } = useContext( MapContext )!;
    const showPlayerLabel = preferences.labels?.players !== false;
    const [ tooltipVisible, setTooltipVisible ] = useState( false );
    const [ cheatsVisible, setCheatsVisible ] = useState( false );

    const { location, rotation, name } = data;
    const isSelf = !!currentPlayerName && name === currentPlayerName;

    const anchor = utils.scaleLocation( location );

    const world = useWorld();
    const popupElements = usePopupElements( { player: data, index } );

    return <LayerGroup>
    <Shape
        positions={[
            utils.scalePoint( 0, 150 ),
            utils.scalePoint( 100, 50 ),
            utils.scalePoint( 100, -150 ),
            utils.scalePoint( -100, -150 ),
            utils.scalePoint( -100, 50 ),
        ]}
        anchor={anchor}
        rotation={Math.round( rotation.Yaw ) - 90}
        color={isSelf ? '#1677ff' : 'black'}
        fillColor={preferences.colors.player}
        fillOpacity={1}
        interactive
        weight={isSelf ? 80 : 60}
    >
        <MapTooltip
            title={<strong>{name}</strong>}
            visible={tooltipVisible && mode !== MapMode.MINIMAP}
            setVisible={setTooltipVisible}
        >
            <Button onClick={() => {
                if ( follow.following?.array === 'players' || follow.following?.index === index )
                    follow.setFollowing();
                else
                    follow.setFollowing( {
                        array: 'players',
                        index,
                        apply: ( data, map ) => {
                            const anchor = utils.scaleLocation( data.location );
                            map.panTo( L.latLng( anchor[ 0 ], anchor[ 1 ] ), { animate: true, duration: 0.5 } );
                        }
                    } );
                setTooltipVisible( false );
            }}>{follow.following?.array === 'players' || follow.following?.index === index ? 'Unfollow' : 'Follow'}</Button>
            {settings.features.cheats && <Button
                style={{ marginTop: 5 }}
                onClick={() => {
                    setTooltipVisible( false );
                    setCheatsVisible( true );
                }}
            >Cheats</Button>}
            {popupElements}
            <MapTooltipExtras
                targetLocation={data.location}
                onClose={() => setTooltipVisible( false )}
                onPanToTarget={() => {
                    const a = utils.scaleLocation( data.location );
                    follow.setFollowing( {
                        array: 'players',
                        index,
                        apply: ( _d, map ) => map.panTo( L.latLng( a[ 0 ], a[ 1 ] ), { animate: true, duration: 0.5 } ),
                    } );
                }}
                onPanToPlayer={() => {
                    const pi = world?.players.findIndex( ( p ) => p.name === currentPlayerName ) ?? 0;
                    const pl = world?.players[ pi ];
                    if( !pl )
                        return;
                    const a = utils.scaleLocation( pl.location );
                    follow.setFollowing( {
                        array: 'players',
                        index: pi,
                        apply: ( _d, map ) => map.panTo( L.latLng( a[ 0 ], a[ 1 ] ), { animate: true, duration: 0.5 } ),
                    } );
                }}
            />
        </MapTooltip>
        <Cheats
            data={data}
            isVisible={cheatsVisible} 
            onClose={() => setCheatsVisible( false )}
            className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
        />
    </Shape>
    {showPlayerLabel && name && name !== 'UNKNOWN' && (
        <PlayerNameLabel
            anchor={anchor}
            name={name}
            isSelf={isSelf}
            compact={mode === MapMode.MINIMAP}
        />
    )}
    </LayerGroup>;
} );