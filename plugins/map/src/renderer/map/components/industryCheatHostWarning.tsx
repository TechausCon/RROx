import React from 'react';
import { Alert } from 'antd';
import { useWorld } from '@rrox-plugins/world/renderer';

export function IndustryCheatHostWarning( { compact }: { compact?: boolean } ) {
    const world = useWorld();

    if( world?.session.isServer )
        return null;

    if( compact ) {
        return <div style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: '#ad6800',
            maxWidth: 220,
        }}>
            Nur als Host wirksam. Auf fremden Servern ändert RROx nur die Map-Anzeige.
        </div>;
    }

    return <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Industrie-Lager: nur Host"
        description={<>
            Als Client kann RROx Industrie-Lager im Spiel nicht füllen (Server entscheidet).
            <br />
            <strong>Als Client geht:</strong> Karte, Teleport, Lok-Steuerung, Weichen, Krane,
            Lager-Cheats an der <strong>Lok/Waggon</strong> (Open Controls → unten).
        </>}
    />;
}
