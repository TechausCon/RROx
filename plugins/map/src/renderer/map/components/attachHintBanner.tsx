import React from 'react';
import { useAttached } from '@rrox/api';
import { useWorld } from '@rrox-plugins/world/renderer';

export function AttachHintBanner() {
    const attached = useAttached();
    const world = useWorld();

    if( attached && world )
        return null;

    return (
        <div style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: 14,
            color: '#ad6800',
            background: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: 8,
        }}>
            {!attached
                ? <>Zuerst im <strong>Home</strong>-Tab <strong>Attach</strong> (Spiel läuft, RROx verbunden).</>
                : <>Attach aktiv, aber noch keine Welt-Daten – Save laden oder kurz warten.</>
            }
        </div>
    );
}
