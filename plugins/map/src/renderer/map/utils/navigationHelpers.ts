import { ILocation } from '@rrox-plugins/world/shared';
import { formatGameDistance, gameDistance } from './distance';

export type LocatedItem<T> = {
    item: T,
    index: number,
    distance: number,
};

export function findNearestByLocation<T extends { location: ILocation }>(
    items: T[],
    playerLoc: ILocation | undefined
): LocatedItem<T> | null {
    if( !playerLoc || items.length === 0 )
        return null;

    let best: LocatedItem<T> | null = null;

    items.forEach( ( item, index ) => {
        const distance = gameDistance( playerLoc, item.location );
        if( !best || distance < best.distance )
            best = { item, index, distance };
    } );

    return best;
}

export function sortByDistanceFrom<T extends { location: ILocation }>(
    items: LocatedItem<T>[],
    playerLoc: ILocation | undefined
): LocatedItem<T>[] {
    if( !playerLoc )
        return items;

    return [ ...items ].sort( ( a, b ) => a.distance - b.distance );
}

export function formatCoords( location: ILocation ): string {
    return `${Math.round( location.X )}, ${Math.round( location.Y )}, ${Math.round( location.Z )}`;
}

export function formatDistanceLabel( distance: number ): string {
    return formatGameDistance( distance );
}
