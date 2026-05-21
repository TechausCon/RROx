import React, { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

export type MapLabelVariant = 'player' | 'frame' | 'industry' | 'badge';

function escapeHtml( text: string ): string {
    return text
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' );
}

function labelStyle( variant: MapLabelVariant, highlight: boolean, compact: boolean ): string {
    const fontSize = compact ? ( variant === 'badge' ? 10 : 11 ) : ( variant === 'badge' ? 11 : 15 );
    const pad = compact ? '2px 6px' : ( variant === 'badge' ? '3px 8px' : '6px 14px' );
    const offset = variant === 'badge' ? '14px' : '22px';
    const base = [
        'display:inline-block',
        `transform:translate(-50%,calc(-100% - ${offset}))`,
        `padding:${pad}`,
        'border-radius:6px',
        `font-size:${fontSize}px`,
        'font-weight:800',
        'line-height:1.15',
        'letter-spacing:0.03em',
        'white-space:nowrap',
        'pointer-events:none',
        'text-align:center',
    ];

    if( variant === 'badge' ) {
        base.push(
            'border:1px solid #595959',
            'background:rgba(40,40,40,0.92)',
            'color:#fff',
            'box-shadow:0 1px 6px rgba(0,0,0,0.35)',
        );
        return base.join( ';' );
    }

    if( variant === 'industry' ) {
        base.push(
            'border:2px solid #389e0d',
            'background:#f6ffed',
            'color:#135200',
            'box-shadow:0 2px 10px rgba(56,158,13,0.35)',
        );
        return base.join( ';' );
    }

    if( variant === 'frame' ) {
        base.push(
            'border:2px solid #d46b08',
            'background:#fff7e6',
            'color:#873800',
            'box-shadow:0 2px 10px rgba(212,107,8,0.35)',
        );
        return base.join( ';' );
    }

    if( highlight ) {
        base.push(
            'border:2px solid #1677ff',
            'background:#e6f4ff',
            'color:#003a8c',
            'box-shadow:0 2px 12px rgba(22,119,255,0.55)',
        );
    } else {
        base.push(
            'border:2px solid #1a1a1a',
            'background:#ffffff',
            'color:#141414',
            'box-shadow:0 2px 10px rgba(0,0,0,0.45)',
        );
    }
    return base.join( ';' );
}

export function MapNameLabel( {
    anchor,
    text,
    variant = 'player',
    highlight = false,
    compact = false,
    zIndexOffset = 2000,
}: {
    anchor: [ number, number ],
    text: string,
    variant?: MapLabelVariant,
    highlight?: boolean,
    compact?: boolean,
    zIndexOffset?: number,
} ) {
    const trimmed = text?.trim() || '';
    if( !trimmed || /^unknown$/i.test( trimmed ) )
        return null;

    const display = trimmed.toUpperCase();

    const icon = useMemo( () => L.divIcon( {
        className: 'map-name-label-marker',
        html: `<div style="${labelStyle( variant, highlight, compact )}">${escapeHtml( display )}</div>`,
        iconAnchor: [ 0, 0 ],
    } ), [ display, variant, highlight, compact ] );

    return (
        <Marker
            pane="popups"
            position={L.latLng( anchor[ 0 ], anchor[ 1 ] )}
            icon={icon}
            interactive={false}
            zIndexOffset={zIndexOffset}
        />
    );
}
