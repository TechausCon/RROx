import { Actions } from "@rrox/api";
import WorldPlugin from ".";
import { Log } from "../shared";

const CRITICAL_STRUCTS = [
    'Class arr.arrGameStateBase',
    'Class arr.Framecar',
    'Class arr.Boiler',
    'Class arr.Compressor',
    'Class arr.Tender',
    'Class arr.Freight',
    'Class arr.industry',
    'Class arr.SplineTrack',
    'Class arr.SplineActor',
    'Class arr.SCharacter',
];

export async function verifyStructHealth( plugin: WorldPlugin ): Promise<void> {
    const getStruct = plugin.controller.getAction( Actions.GET_STRUCT );
    const missing: string[] = [];

    for( const name of CRITICAL_STRUCTS ) {
        try {
            const info = getStruct.getInstance( name );
            if( !info )
                missing.push( name );
        } catch {
            missing.push( name );
        }
    }

    if( missing.length ) {
        Log.warn(
            `Struct-Check: ${missing.length} fehlende Klassen (Build evtl. veraltet): ${missing.join( ', ' )}`
        );
    } else {
        Log.info( 'Struct-Check: kritische Spiel-Klassen gefunden.' );
    }
}
