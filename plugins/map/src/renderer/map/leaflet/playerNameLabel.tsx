import React from 'react';
import { MapNameLabel } from './mapNameLabel';

export function PlayerNameLabel( props: {
    anchor: [ number, number ],
    name: string,
    isSelf?: boolean,
    compact?: boolean,
} ) {
    return (
        <MapNameLabel
            anchor={props.anchor}
            text={props.name || 'Spieler'}
            variant="player"
            highlight={props.isSelf}
            compact={props.compact}
            zIndexOffset={props.isSelf ? 2500 : 2000}
        />
    );
}
