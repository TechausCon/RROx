import React, { useContext, useState } from 'react';
import { LayerGroup } from 'react-leaflet';
import { MapContext } from '../context';
import { Shape, MapTooltip, MapNameLabel } from '../leaflet';
import { MapTooltipExtras } from '../components';
import { FrameDefinitions } from '../definitions';
import { Button } from 'antd';
import { FrameControlsPopup, StorageInfo } from '../popups';
import L from 'leaflet';
import { IFrameCar, FrameCarType, EngineFrameCarType, FreightFrameCarType, ProductType, TeleportCommunicator, FramecarResetCommunicator } from '@rrox-plugins/world/shared';
import { MapMode } from '../types';
import { useRPC } from '@rrox/api';
import { usePopupElements } from '../hooks';
import { useWorld } from '@rrox-plugins/world/renderer';
import { usePlayerName } from '../hooks';
import { useMyLocomotive } from '../hooks/useMyLocomotive';
import { isNearPlayer } from '../utils/distance';

function frameMapLabel( data: IFrameCar, definition: { name?: string } ): string | null {
    const num = data.number?.trim();
    const typeName = data.type === FrameCarType.UNKNOWN ? '' : data.type.replace( /_/g, ' ' );
    const defName = definition.name && definition.name !== 'Unknown' ? definition.name : '';
    const short = ( defName || typeName ).replace( /<br>/gi, ' ' ).trim().slice( 0, 14 );
    if( !num && !short )
        return null;
    if( num && short )
        return `${num} · ${short}`;
    return num || short;
}

function boilerBadgeText( boiler: NonNullable<IFrameCar[ 'boiler' ]> ): string {
    const pressurePct = boiler.maxPressure > 0
        ? Math.round( boiler.pressure / boiler.maxPressure * 100 )
        : 0;
    const waterPct = boiler.maxWaterAmount > 0
        ? Math.round( boiler.waterAmount / boiler.maxWaterAmount * 100 )
        : 0;
    return `DR ${pressurePct}% · H2O ${waterPct}%`;
}

const getStrokeColor = ( brake: number ) => {
    if ( brake > 0.5 )
        return 'red';
    else if ( brake > 0.2 )
        return 'orange';
    else
        return 'black';
};

export const Frame = React.memo( function Frame( { data, index, frames }: { data: IFrameCar, index: number, frames: IFrameCar[] } ) {
    const { utils, mode, follow, settings, preferences } = useContext( MapContext )!;
    const labelPrefs = preferences.labels ?? {
        players: true,
        locomotives: true,
        industries: false,
        freightCars: false,
        boilerBadge: false,
    };

    const { location, rotation, type, freight, number, name, controls } = data;

    const definition = FrameDefinitions[ type ] ?? FrameDefinitions[ FrameCarType.UNKNOWN ];

    const teleport = useRPC( TeleportCommunicator );

    const framecarReset = useRPC( FramecarResetCommunicator );

    const [ controlsVisible, setControlsVisible ] = useState( false );
    const [ storageVisible, setStorageVisible ] = useState( false );
    const [ tenderVisible, setTenderVisible ] = useState( false );
    const [ tooltipVisible, setTooltipVisible ] = useState( false );

    const popupElements = usePopupElements( { frame: data, index } );
    const world = useWorld();
    const playerName = usePlayerName( world );
    const player = world?.players.find( ( p ) => p.name === playerName );
    const nearPlayer = player ? isNearPlayer( player.location, location ) : true;
    const { bookmark, bookmarkedIndex } = useMyLocomotive();
    const isMyLoc = bookmarkedIndex === index;

    const anchor = utils.scaleLocation( location );

    const panExtras = (
        <MapTooltipExtras
            targetLocation={location}
            onClose={() => setTooltipVisible( false )}
            onPanToTarget={() => {
                follow.setFollowing( {
                    array: 'frameCars',
                    index,
                    apply: ( d, map ) => {
                        const a = utils.scaleLocation( d.location );
                        map.panTo( L.latLng( a[ 0 ], a[ 1 ] ), { animate: true, duration: 0.5 } );
                    },
                } );
            }}
            onPanToPlayer={() => {
                const pi = world?.players.findIndex( ( p ) => p.name === playerName ) ?? 0;
                const pl = world?.players[ pi ];
                if( !pl )
                    return;
                follow.setFollowing( {
                    array: 'players',
                    index: pi,
                    apply: ( d, map ) => {
                        const a = utils.scaleLocation( d.location );
                        map.panTo( L.latLng( a[ 0 ], a[ 1 ] ), { animate: true, duration: 0.5 } );
                    },
                } );
            }}
        />
    );

    const frameLabelText = frameMapLabel( data, definition );
    const showFrameLabel = definition.engine
        ? labelPrefs.locomotives
        : labelPrefs.freightCars;
    const mapLabels = showFrameLabel && frameLabelText ? (
        <>
            <MapNameLabel
                anchor={anchor}
                text={frameLabelText}
                variant="frame"
                highlight={nearPlayer}
                compact={mode === MapMode.MINIMAP}
                zIndexOffset={1900}
            />
            {labelPrefs.boilerBadge && data.boiler && definition.engine && (
                <MapNameLabel
                    anchor={anchor}
                    text={boilerBadgeText( data.boiler )}
                    variant="badge"
                    compact={mode === MapMode.MINIMAP}
                    zIndexOffset={1890}
                />
            )}
        </>
    ) : null;

    if ( definition.engine )
        return <LayerGroup>
        <Shape
            positions={[
                utils.scalePoint( 0, definition.length / 2 ),
                utils.scalePoint( 100, definition.length / 6 ),
                utils.scalePoint( 100, -definition.length / 2 ),
                utils.scalePoint( -100, -definition.length / 2 ),
                utils.scalePoint( -100, definition.length / 6 ),
            ]}
            anchor={anchor}
            rotation={Math.round( rotation.Yaw ) - 90}
            color={getStrokeColor( controls.brake )}
            fillColor={preferences.colors[ type as EngineFrameCarType ]}
            fillOpacity={1}
            interactive
        >
            <MapTooltip
                title={`${name.replace( "<br>", "" ).toUpperCase()}${name && number ? ' - ' : ''}${number.toUpperCase() || ''}`}
                visible={tooltipVisible && mode !== MapMode.MINIMAP}
                setVisible={setTooltipVisible}
            >
                {definition.image && <img className='dark-mode-invert' src={definition.image} width={100} height={100} style={{ margin: '-10px auto 20px auto' }} alt="Tooltip Icon" />}
                <Button onClick={() => {
                    setTooltipVisible( false );
                    setControlsVisible( true );
                }}>Open Controls</Button>
                {definition.engine && (
                    <Button
                        style={{ marginTop: 5 }}
                        type={isMyLoc ? 'primary' : 'default'}
                        onClick={() => {
                            bookmark( index );
                            setTooltipVisible( false );
                        }}
                    >
                        {isMyLoc ? '★ Meine Lok' : 'Als Meine Lok'}
                    </Button>
                )}
                <Button
                    style={{ marginTop: 5 }}
                    onClick={() => {
                        if ( follow.following?.array === 'frameCars' && follow.following?.index === index )
                            follow.setFollowing();
                        else
                            follow.setFollowing( {
                                array: 'frameCars',
                                index,
                                apply: ( data, map ) => {
                                    const anchor = utils.scaleLocation( data.location );
                                    map.panTo( L.latLng( anchor[ 0 ], anchor[ 1 ] ), { animate: true, duration: 0.5 } );
                                }
                            } );
                        setTooltipVisible( false );
                    }}
                >
                    {follow.following?.array === 'frameCars' && follow.following.index === index ? 'Unfollow' : 'Follow'}
                </Button>
                {data.tender && <Button
                    style={{ marginTop: 5 }}
                    onClick={() => {
                        setTooltipVisible( false );
                        setTenderVisible( true );
                    }}
                >Show Tender</Button>}
                {popupElements}
                {settings.features.resetFramecars && <Button
                    style={{ marginTop: 25 }}
                    onClick={() => {
                        framecarReset( index );
                    }}
                >Reset Framecar Location</Button>}
                {panExtras}
            </MapTooltip>
            <FrameControlsPopup
                title={`${name.replace( "<br>", "" ).toUpperCase()}${name && number ? ' - ' : ''}${number.toUpperCase() || ''}`}
                data={data}
                frames={frames}
                index={index}
                isVisible={controlsVisible}
                className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
                controlEnabled={settings.features.controlEngines}
                onClose={() => {
                    setControlsVisible( false );
                    setTooltipVisible( false );
                }}
            />
            {data.tender && <StorageInfo
                title={`${name.replace( "<br>", "" ).toUpperCase()} – Tender`}
                parentIndex={index}
                ownerType="framecar"
                className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
                storages={{
                    Water: [ {
                        types: [ ProductType.WATER ],
                        currentAmount: data.tender.water,
                        maxAmount: data.tender.maxWater,
                        cranes: [],
                        location: data.location,
                        rotation: data.rotation,
                    } ],
                    Fuel: [ {
                        types: [ ProductType.COAL ],
                        currentAmount: data.tender.fuel,
                        maxAmount: data.tender.maxFuel,
                        cranes: [],
                        location: data.location,
                        rotation: data.rotation,
                    } ],
                }}
                isVisible={tenderVisible}
                onClose={() => {
                    setTenderVisible( false );
                    setTooltipVisible( false );
                }}
            />}
        </Shape>
        {mapLabels}
        </LayerGroup>;

    let frameTitle = name || number ? ( name.replace( "<br>", "" ).toUpperCase() ) + ( name && number ? ' - ' : '' ) + ( number.toUpperCase() || '' ) : ( definition.name || 'Freight Car' );

    return <LayerGroup>
    <Shape
        positions={[
            utils.scalePoint( 100, definition.length / 2 ),
            utils.scalePoint( 100, -definition.length / 2 ),
            utils.scalePoint( -100, -definition.length / 2 ),
            utils.scalePoint( -100, definition.length / 2 ),
        ]}
        anchor={anchor}
        rotation={Math.round( rotation.Yaw ) - 90}
        color={getStrokeColor( controls.brake )}
        fillColor={definition.freight
            ? preferences.colors[ type as FreightFrameCarType ][ freight && freight.currentAmount > 0 ? ( freight && freight.currentAmount == freight.maxAmount ? 'fullyloaded' : 'partiallyloaded' ) : 'unloaded' ]
            : preferences.colors[ type as EngineFrameCarType ]}
        fillOpacity={1}
        interactive
    >
        <MapTooltip
            title={frameTitle}
            visible={tooltipVisible && mode !== MapMode.MINIMAP}
            setVisible={setTooltipVisible}
        >
            {definition.image && <img className='dark-mode-invert' src={definition.image} width={100} height={100} style={{ margin: '-10px auto 20px auto' }} alt="Tooltip Icon" />}
            <Button onClick={() => {
                setTooltipVisible( false );
                setControlsVisible( true );
            }}>Open Controls</Button>
            {data.freight && <Button
                style={{ marginTop: 5 }}
                onClick={() => {
                    setTooltipVisible( false );
                    setStorageVisible( true );
                }}
            >Show Freight</Button>}
            {popupElements}
            {settings.features.resetFramecars && <Button
                style={{ marginTop: 25 }}
                onClick={() => {
                    framecarReset( index );
                }}
            >Reset Framecar Location</Button>}
            {panExtras}
        </MapTooltip>
        <FrameControlsPopup
            title={frameTitle}
            data={data}
            frames={frames}
            index={index}
            isVisible={controlsVisible}
            className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
            controlEnabled={settings.features.controlEngines}
            onClose={() => {
                setControlsVisible( false );
                setTooltipVisible( false );
            }}
        />
        <StorageInfo
            title={frameTitle}
            parentIndex={index}
            ownerType="framecar"
            className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
            storages={{
                Freight: freight ? [ freight ] : []
            }}
            isVisible={storageVisible}
            onClose={() => {
                setStorageVisible( false );
                setTooltipVisible( false );
            }}
        />
    </Shape>
    {showFrameLabel && frameLabelText && (
        <MapNameLabel
            anchor={anchor}
            text={frameLabelText}
            variant="frame"
            compact={mode === MapMode.MINIMAP}
            zIndexOffset={1900}
        />
    )}
    </LayerGroup>;
} );