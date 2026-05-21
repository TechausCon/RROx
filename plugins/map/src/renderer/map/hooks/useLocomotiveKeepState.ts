import { useCallback, useEffect, useState } from 'react';
import { GetLocomotiveKeepState, ILocomotiveKeepState } from '@rrox-plugins/world/shared';
import { useHasCommunicatorAccess, useRPC } from '@rrox/api';

const emptyState: ILocomotiveKeepState = {
    storage: {},
    boilerPressure: false,
    boilerFire: false,
    boilerWaterTemp: false,
    unlimitedSteam: false,
    brakeAir: false,
    speedBoost: false,
};

export function useLocomotiveKeepState( frameIndex: number, enabled: boolean ) {
    const canQuery = useHasCommunicatorAccess( GetLocomotiveKeepState );
    const getKeepState = useRPC( GetLocomotiveKeepState );
    const [ state, setState ] = useState<ILocomotiveKeepState>( emptyState );

    const refresh = useCallback( async () => {
        if( !enabled || !canQuery )
            return;

        try {
            const next = await getKeepState( frameIndex );
            setState( next );
        } catch {
            // Attach / World noch nicht bereit
        }
    }, [ canQuery, enabled, frameIndex, getKeepState ] );

    useEffect( () => {
        void refresh();
        const id = setInterval( () => void refresh(), 1500 );
        return () => clearInterval( id );
    }, [ refresh ] );

    return { state, setState, refresh };
}
