import React, { useContext, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import { MapTooltip } from './tooltip';
import { Button, Input, Space } from 'antd';
import { MapContext } from '../context';
import { MapMode } from '../types';
import { useRPC } from '@rrox/api';
import { TeleportCommunicator } from '@rrox-plugins/world/shared';
import {
    loadTeleportFavorites,
    removeTeleportFavorite,
    saveTeleportFavorite,
    TeleportFavorite,
} from '../../../shared/teleportFavorites';

export function ContextMenu() {
    const [ visible, setVisible ] = useState( false );
    const [ position, setPosition ] = useState<[ lat: number, lng: number ]>( [ 0, 0 ] );
    const [ favorites, setFavorites ] = useState<TeleportFavorite[]>( () => loadTeleportFavorites() );
    const [ saveName, setSaveName ] = useState( '' );
    const { currentPlayerName, utils, mode, settings } = useContext( MapContext )!;

    const teleport = useRPC( TeleportCommunicator );

    useMapEvents( {
        contextmenu: ( e ) => {
            setPosition( [ e.latlng.lat, e.latlng.lng ] );
            setVisible( true );
        }
    } );

    if( !visible || !settings.features.teleport )
        return null;

    const gameCoords = utils.revertScalePoint( ...position );

    const teleportHere = () => {
        const [ X, Y ] = gameCoords;
        teleport( currentPlayerName, { X, Y } );
        setVisible( false );
    };

    const teleportFavorite = ( fav: TeleportFavorite ) => {
        teleport( currentPlayerName, { X: fav.X, Y: fav.Y } );
        setVisible( false );
    };

    const saveFavorite = () => {
        const name = saveName.trim();
        if( !name )
            return;
        const [ X, Y ] = gameCoords;
        setFavorites( saveTeleportFavorite( { name, X, Y } ) );
        setSaveName( '' );
    };

    return <MapTooltip
        visible={visible && mode !== MapMode.MINIMAP}
        setVisible={setVisible}
        position={position}
    >
        <Space direction="vertical" style={{ marginTop: 5, minWidth: 180 }}>
            <Button onClick={teleportHere}>Teleport Here</Button>
            <Space style={{ width: '100%' }}>
                <Input
                    size="small"
                    placeholder="Favorit-Name"
                    value={saveName}
                    onChange={( e ) => setSaveName( e.target.value )}
                    onPressEnter={saveFavorite}
                />
                <Button size="small" onClick={saveFavorite}>★ Speichern</Button>
            </Space>
            {favorites.map( ( fav ) => (
                <Space key={fav.name} style={{ width: '100%' }}>
                    <Button size="small" onClick={() => teleportFavorite( fav )}>
                        {fav.name}
                    </Button>
                    <Button
                        size="small"
                        danger
                        onClick={() => setFavorites( removeTeleportFavorite( fav.name ) )}
                    >
                        ×
                    </Button>
                </Space>
            ) )}
        </Space>
    </MapTooltip>;
}
