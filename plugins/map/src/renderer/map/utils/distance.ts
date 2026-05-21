import { ILocation } from '@rrox-plugins/world/shared';

/** Abstand in Spiel-Einheiten (cm). */
export function gameDistance( a: ILocation, b: ILocation ): number {
    const dx = a.X - b.X;
    const dy = a.Y - b.Y;
    return Math.sqrt( dx * dx + dy * dy );
}

/** Anzeige in Metern (Spiel-Koordinaten ≈ cm). */
export function formatGameDistance( units: number ): string {
    const meters = units / 100;
    if( meters < 1000 )
        return `${Math.round( meters )} m`;
    return `${( meters / 1000 ).toFixed( 1 )} km`;
}

export const NEAR_PLAYER_DISTANCE = 12000;

export function isNearPlayer( playerLoc: ILocation | undefined, target: ILocation ): boolean {
    if( !playerLoc )
        return false;
    return gameDistance( playerLoc, target ) <= NEAR_PLAYER_DISTANCE;
}
