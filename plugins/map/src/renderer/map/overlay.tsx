import React, { useState } from 'react';
import L from 'leaflet';
import { MapContext } from './context';
import { Modal } from './modal';
import { useFollowing, useLocate, useMapSettings, useMapStyle, usePlayerName } from './hooks';
import { MapMode } from './types';
import { Map } from './map';
import { useWorld } from '@rrox-plugins/world/renderer';
import { MapConfig } from './config';
import { OverlayMode, useOverlayMode, useSettings } from '@rrox/api';
import { MapPreferences } from '../../shared';
import { AttachHintBanner } from './components';
import { useAttached } from '@rrox/api';

export function MapOverlay() {
    const data = useWorld();
    const overlayMode = useOverlayMode();
    const settings = useMapSettings();
    const [ preferences ] = useSettings( MapPreferences );

    const mode = overlayMode === OverlayMode.FOCUSSED ? MapMode.MAP : MapMode.MINIMAP;
    const [ map, setMap ] = useState<L.Map>();
    const [ following, setFollowing ] = useFollowing( map, mode, mode !== MapMode.MAP );
    useLocate( map );

    useMapStyle();

    const currentPlayerName = usePlayerName( data );
    const attached = useAttached();
    const showAttachHint = !attached || !data;

    return <MapContext.Provider
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
        <Modal minimapEnabled={preferences.minimap.enabled}>
            {showAttachHint && mode === MapMode.MAP && (
                <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, width: 'min(420px, 90vw)' }}>
                    <AttachHintBanner />
                </div>
            )}
            <div className={[ 'map', `map-${mode}`, `corner-${preferences.minimap.corner}` ].join( ' ' )}>
                {data ? <Map
                    data={data}
                    setMap={setMap}
                /> : null}
            </div>
        </Modal>
    </MapContext.Provider>;
}