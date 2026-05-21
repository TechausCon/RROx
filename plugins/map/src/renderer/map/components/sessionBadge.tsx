import React from 'react';
import { Tag, Tooltip } from 'antd';
import { useWorld } from '@rrox-plugins/world/renderer';

export function SessionBadge() {
    const world = useWorld();
    const hasWorld = ( world?.industries?.length ?? 0 ) > 0
        || ( world?.frameCars?.length ?? 0 ) > 0
        || ( world?.players?.length ?? 0 ) > 0;

    if( !hasWorld )
        return null;

    const { isServer, industryStorageSynced } = world!.session;
    const isClient = !isServer;

    const tooltip = isServer
        ? 'Du bist Host — Industrie-Cheats wirken im Spiel.'
        : 'Client: Karte, Teleport, Lok-Cheats (Open Controls), Weichen, Krane — ok. Industrie-Lager nur Host.';

    return <Tooltip title={tooltip}>
        <Tag
            color={isServer ? 'green' : 'orange'}
            style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 2500,
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
            }}
        >
            {isServer ? 'Host' : 'Client'}
            {isClient && !industryStorageSynced && ' · Lager ungenau'}
        </Tag>
    </Tooltip>;
}
