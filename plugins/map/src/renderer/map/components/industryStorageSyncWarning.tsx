import React from 'react';
import { Alert } from 'antd';
import { useWorld } from '@rrox-plugins/world/renderer';

export function IndustryStorageSyncWarning() {
    const world = useWorld();

    if( world?.session.isServer || world?.session.industryStorageSynced )
        return null;

    return <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Lagerstände können abweichen"
        description="Als Client ohne Server-Sync zeigt RROx ggf. andere Werte als das Spiel. Im Zweifel die Anzeige im Spiel nutzen."
    />;
}
