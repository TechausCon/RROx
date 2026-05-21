const STORAGE_KEY = 'rrox.map.teleportFavorites';

export type TeleportFavorite = {
    name: string,
    X: number,
    Y: number,
};

export function loadTeleportFavorites(): TeleportFavorite[] {
    try {
        const raw = localStorage.getItem( STORAGE_KEY );
        if( !raw )
            return [];
        const parsed = JSON.parse( raw );
        return Array.isArray( parsed ) ? parsed.filter( isFavorite ) : [];
    } catch {
        return [];
    }
}

export function saveTeleportFavorite( favorite: TeleportFavorite ): TeleportFavorite[] {
    const list = loadTeleportFavorites().filter( ( f ) => f.name !== favorite.name );
    list.push( favorite );
    localStorage.setItem( STORAGE_KEY, JSON.stringify( list ) );
    return list;
}

export function removeTeleportFavorite( name: string ): TeleportFavorite[] {
    const list = loadTeleportFavorites().filter( ( f ) => f.name !== name );
    localStorage.setItem( STORAGE_KEY, JSON.stringify( list ) );
    return list;
}

function isFavorite( value: unknown ): value is TeleportFavorite {
    if( !value || typeof value !== 'object' )
        return false;
    const v = value as TeleportFavorite;
    return typeof v.name === 'string' && typeof v.X === 'number' && typeof v.Y === 'number';
}
