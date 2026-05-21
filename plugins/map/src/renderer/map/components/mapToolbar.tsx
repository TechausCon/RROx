import React from 'react';
import { Button, Space } from 'antd';
import { ApplyAllIndustriesKeepAll, WorldSettings } from '@rrox-plugins/world/shared';
import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';
import { useWorld } from '@rrox-plugins/world/renderer';
import { IndustryCheatHostWarning } from './industryCheatHostWarning';
import { ClientMapToolbar } from './clientMapToolbar';

function HostIndustryMapToolbar() {
    const [ worldSettings ] = useSettings( WorldSettings );
    const canCheats = useHasCommunicatorAccess( ApplyAllIndustriesKeepAll );
    const applyAllIndustries = useRPC( ApplyAllIndustriesKeepAll );

    if( !worldSettings.features.cheats || !canCheats )
        return null;

    return (
        <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2500,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
            <Space direction="vertical" size="small">
                <span style={{ fontSize: 12, fontWeight: 600 }}>Map-Cheats</span>
                <Button
                    size="small"
                    type="primary"
                    onClick={() => applyAllIndustries()}
                >
                    Alle Industrien immer voll
                </Button>
            </Space>
        </div>
    );
}

export function MapToolbar() {
    const world = useWorld();
    const isHost = world?.session.isServer ?? false;

    if( !world )
        return null;

    if( isHost )
        return <HostIndustryMapToolbar />;

    return <ClientMapToolbar />;
}
