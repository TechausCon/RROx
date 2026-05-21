import React, { useState } from 'react';
import { PageLayout } from "@rrox/base-ui";
import L from 'leaflet';
import { MapContext } from './context';
import { useFollowing, useLocate, useMapSettings, useMapStyle, usePlayerName } from './hooks';
import { MapMode } from './types';
import { Map } from './map';
import { MapToolbar, SessionBadge } from './components';
import { useWorld } from '@rrox-plugins/world/renderer';
import { MapConfig } from './config';
import { useSettings } from '@rrox/api';
import { MapPreferences } from '../../shared';
import { useLocomotiveAlerts } from './hooks/useLocomotiveAlerts';
import { WorldSettings } from '@rrox-plugins/world/shared';

export function MapPage() {
    const data = useWorld();
    const settings = useMapSettings();
    const [ preferences ] = useSettings( MapPreferences );
    const [ worldSettings ] = useSettings( WorldSettings );

    const mode = MapMode.NORMAL;
    const [ map, setMap ] = useState<L.Map>();
    const [ following, setFollowing ] = useFollowing( map, mode, true );
    useLocate( map );

    useMapStyle();

    const currentPlayerName = usePlayerName( data );

    useLocomotiveAlerts( !!data && worldSettings.features.cheats );

    return <PageLayout>
        <MapContext.Provider
            value={{
                follow: {
                    following,
                    setFollowing
                },
                settings,
                preferences,
                mode,
                config: {
                    game: MapConfig.game,
                    map: MapConfig.map,
                },
                currentPlayerName,
                utils: MapConfig.utils
            }}
        >
            <div className={[ 'map', `map-${mode}`, `corner-${preferences.minimap.corner}` ].join( ' ' )} style={{ position: 'relative' }}>
                <SessionBadge />
                <MapToolbar />
                {data ? <Map
                    data={data}
                    setMap={setMap}
                /> : null}
            </div>
        </MapContext.Provider>
    </PageLayout>;
}

export * from './context';
export * from './overlay';
export * from './registrations';
export * from './register';