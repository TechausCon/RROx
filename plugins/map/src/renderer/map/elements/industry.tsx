import React, { useContext, useMemo, useState } from 'react';
import { LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { MapContext } from '../context';
import { IndustryDefinition, IndustryDefinitions } from '../definitions';
import { Image, Shape, MapTooltip, MapNameLabel } from '../leaflet';
import { MapTooltipExtras } from '../components';
import { Button } from 'antd';
import { StorageInfo } from '../popups';
import { usePositions, usePopupElements, useImageAdjust, usePlayerName } from '../hooks';
import { useWorld } from '@rrox-plugins/world/renderer';
import { MapMode } from '../types';
import { IIndustry, IndustryType, TeleportCommunicator } from '@rrox-plugins/world/shared';
import { useRPC } from '@rrox/api';
import { Crane } from './crane';

export const Industry = React.memo( function Industry( { data, index }: { data: IIndustry, index: number } ) {
    const { utils, mode, follow, preferences } = useContext( MapContext )!;
    const showIndustryLabel = preferences.labels?.industries === true;
    const world = useWorld();
    const playerName = usePlayerName( world );
    const [ infoVisible, setInfoVisible ] = useState( false );
    const [ tooltipVisible, setTooltipVisible ] = useState( false );

    const { type, location, rotation, products, educts } = data;

    const liveIndustry = world?.industries[ index ];
    const liveEducts = liveIndustry?.educts ?? educts;
    const liveProducts = liveIndustry?.products ?? products;

    const definition = ( IndustryDefinitions[ type ] as IndustryDefinition | undefined ) ?? IndustryDefinitions[ IndustryType.UNKNOWN ];

    const popupElements = usePopupElements( { industry: data, index } );

    const tooltip = <MapTooltip
        title={definition.name}
        visible={tooltipVisible && mode !== MapMode.MINIMAP}
        setVisible={setTooltipVisible}
    >
        <Button onClick={() => {
            setTooltipVisible( false );
            setInfoVisible( true );
        }}>Show Info</Button>
        <StorageInfo
            title={definition.name}
            parentIndex={index}
            ownerType="industry"
            storages={{
                Input: liveEducts,
                Output: liveProducts
            }}
            className={mode === MapMode.MINIMAP ? 'modal-hidden' : undefined}
            isVisible={infoVisible}
            height={500}
            onClose={() => {
                setInfoVisible( false );
                setTooltipVisible( false );
            }}
        />
        {popupElements}
        <MapTooltipExtras
            targetLocation={location}
            onClose={() => setTooltipVisible( false )}
            onPanToTarget={() => {
                const a = utils.scaleLocation( location );
                follow.setFollowing( {
                    array: 'industries',
                    index,
                    apply: ( _d, map ) => map.panTo( L.latLng( a[ 0 ], a[ 1 ] ), { animate: true, duration: 0.5 } ),
                } );
            }}
            onPanToPlayer={() => {
                const pi = world?.players.findIndex( ( p ) => p.name === playerName ) ?? 0;
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
    </MapTooltip>;

    const cranes = useMemo( () => {
        return [ ...data.products, ...data.educts ].map( ( s, i ) => s.cranes.map( ( crane ) =>
            <Crane key={`${index}-${i}-${crane.id}`} data={crane} storage={s} industry={data} industryIndex={index} storageIndex={i} />
        ) ).flat();
    }, [ data, index ] );

    const industryLabel = showIndustryLabel && definition.name !== 'Unknown' ? (
        <MapNameLabel
            anchor={utils.scaleLocation( location )}
            text={definition.name}
            variant="industry"
            compact={mode === MapMode.MINIMAP}
            zIndexOffset={1800}
        />
    ) : null;

    if ( !definition.image )
        return <LayerGroup>
            {cranes}
            <Shape
                positions={[
                    utils.scalePoint( definition.points[ 0 ][ 0 ], definition.points[ 0 ][ 1 ] ),
                    utils.scalePoint( definition.points[ 0 ][ 0 ], definition.points[ 1 ][ 1 ] ),
                    utils.scalePoint( definition.points[ 1 ][ 0 ], definition.points[ 1 ][ 1 ] ),
                    utils.scalePoint( definition.points[ 1 ][ 0 ], definition.points[ 0 ][ 1 ] ),
                ]}
                anchor={utils.scaleLocation( location )}
                rotation={Math.round( rotation.Yaw ) - 90}
                color={'black'}
                fillColor={definition.fillColor || 'grey'}
                fillOpacity={1}
                weight={60}
                interactive
            >{tooltip}</Shape>
            {industryLabel}
        </LayerGroup>;

    const anchor = utils.scaleLocation( location );

    const [
        topLeft,
        topRight,
        bottomLeft
    ]: [ [ number, number ], [ number, number ], [ number, number ] ] = usePositions( [
        utils.scalePoint( ...definition.points[ 0 ] ),
        utils.scalePoint( ...definition.points[ 1 ] ),
        utils.scalePoint( ...definition.points[ 2 ]! ),
    ], anchor, rotation.Yaw );

    /* const { points, markers } = useImageAdjust( [
        utils.scalePoint( ...definition.points[ 0 ] ),
        utils.scalePoint( ...definition.points[ 1 ] ),
        utils.scalePoint( ...definition.points[ 2 ]! ),
    ], anchor, rotation.Yaw );

    const [
        topLeft,
        topRight,
        bottomLeft
    ]: [ [ number, number ], [ number, number ], [ number, number ] ] = points; */

    return <LayerGroup>
        {cranes}
        {industryLabel}
        <Image
            topLeft={topLeft}
            topRight={topRight}
            bottomLeft={bottomLeft}
            url={definition.image}
            interactive
        >
            {tooltip}
        </Image>
    </LayerGroup>;
} );