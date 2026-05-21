import { useCallback, useMemo, useState } from 'react';
import { IFrameCar, isEngine } from '@rrox-plugins/world/shared';
import { useWorld } from '@rrox-plugins/world/renderer';
import { usePlayerName } from './playerName';
import { LocatedItem } from '../utils/navigationHelpers';
import { gameDistance, isNearPlayer } from '../utils/distance';

const STORAGE_KEY = 'rrox.map.myLocomotiveIndex';

export type MyLocomotiveRef = {
    index: number,
    frame: IFrameCar,
    distance: number,
};

function readBookmark(): number | null {
    try {
        const raw = sessionStorage.getItem( STORAGE_KEY );
        if( raw == null )
            return null;
        const index = parseInt( raw, 10 );
        return Number.isFinite( index ) ? index : null;
    } catch {
        return null;
    }
}

export function useMyLocomotive() {
    const world = useWorld();
    const playerName = usePlayerName( world );
    const player = world?.players.find( ( p ) => p.name === playerName );
    const [ bookmarkedIndex, setBookmarkedIndex ] = useState<number | null>( readBookmark );

    const bookmark = useCallback( ( index: number ) => {
        sessionStorage.setItem( STORAGE_KEY, String( index ) );
        setBookmarkedIndex( index );
    }, [] );

    const clearBookmark = useCallback( () => {
        sessionStorage.removeItem( STORAGE_KEY );
        setBookmarkedIndex( null );
    }, [] );

    const engines = useMemo( () => {
        if( !world )
            return [] as LocatedItem<IFrameCar>[];

        return world.frameCars
            .map( ( frame, index ) => ( { frame, index } ) )
            .filter( ( { frame } ) => isEngine( frame ) )
            .map( ( { frame, index } ) => ( {
                item: frame,
                index,
                distance: player?.location ? gameDistance( player.location, frame.location ) : Infinity,
            } ) );
    }, [ world, player?.location ] );

    const nearestEngine = useMemo( (): MyLocomotiveRef | null => {
        if( !world || !player?.location )
            return null;

        const playerLoc = player.location;
        let best: MyLocomotiveRef | null = null;
        world.frameCars.forEach( ( frame, index ) => {
            if( !isEngine( frame ) )
                return;
            const distance = gameDistance( playerLoc, frame.location );
            if( !best || distance < best.distance )
                best = { frame, index, distance };
        } );
        return best;
    }, [ world, player?.location ] );

    const nearestEngineInRange = useMemo( (): MyLocomotiveRef | null => {
        if( !nearestEngine || !player?.location )
            return null;
        if( !isNearPlayer( player.location, nearestEngine.frame.location ) )
            return null;
        return nearestEngine;
    }, [ nearestEngine, player?.location ] );

    const bookmarked = useMemo( (): MyLocomotiveRef | null => {
        if( bookmarkedIndex == null || !world?.frameCars[ bookmarkedIndex ] )
            return null;
        const frame = world.frameCars[ bookmarkedIndex ];
        if( !isEngine( frame ) )
            return null;
        return {
            index: bookmarkedIndex,
            frame,
            distance: player?.location ? gameDistance( player.location, frame.location ) : Infinity,
        };
    }, [ bookmarkedIndex, world?.frameCars, player?.location ] );

    const myLoc: MyLocomotiveRef | null = bookmarked ?? nearestEngine;

    return {
        player,
        playerName,
        bookmark,
        clearBookmark,
        bookmarkedIndex,
        bookmarked,
        nearestEngine,
        nearestEngineInRange,
        engines,
        myLoc,
    };
}
