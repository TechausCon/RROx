import React, { useContext, useMemo, useState } from 'react';
import { DraggableModal } from 'ant-design-draggable-modal';
import { Button, InputNumber, Switch } from 'antd';
import { ProductDefinitions } from '../definitions';
import {
    AddStorageCheats,
    ApplyIndustryKeepAll,
    SetStorageKeepFull,
    formatIndustryStorageSlotLabel,
    IStorage,
    ProductType,
    StorageCategory,
    StorageOwnerType,
    storageUseCrane,
} from '@rrox-plugins/world/shared';
import { useHasCommunicatorAccess, useRPC, useSettings } from '@rrox/api';
import { WorldSettings } from '@rrox-plugins/world/shared';
import { useWorld } from '@rrox-plugins/world/renderer';
import { MapContext } from '../context';
import { IndustryCheatHostWarning, IndustryStorageSyncWarning } from '../components';

const CATEGORY_BY_LABEL: Record<string, StorageCategory> = {
    Input: 'educt',
    Output: 'product',
    Freight: 'freight',
    Water: 'tender_water',
    Fuel: 'tender_fuel',
    Coal: 'tender_fuel',
};

function resolveLiveStorages(
    ownerType: StorageOwnerType,
    parentIndex: number,
    storages: { [ category: string ]: IStorage[] },
    world: ReturnType<typeof useWorld>
): { [ category: string ]: IStorage[] } {
    if( !world )
        return storages;

    if( ownerType === 'industry' ) {
        const industry = world.industries[ parentIndex ];
        if( !industry )
            return storages;

        return {
            Input: industry.educts ?? [],
            Output: industry.products ?? [],
        };
    }

    if( ownerType === 'framecar' ) {
        const frame = world.frameCars[ parentIndex ];
        if( !frame )
            return storages;

        const live: { [ category: string ]: IStorage[] } = { ...storages };

        if( frame.tender ) {
            live.Water = [ {
                types: [ ProductType.WATER ],
                currentAmount: frame.tender.water,
                maxAmount: frame.tender.maxWater,
                cranes: [],
                location: { X: 0, Y: 0, Z: 0 },
                rotation: { Pitch: 0, Yaw: 0, Roll: 0 },
            } ];
            live.Fuel = [ {
                types: [ ProductType.COAL ],
                currentAmount: frame.tender.fuel,
                maxAmount: frame.tender.maxFuel,
                cranes: [],
                location: { X: 0, Y: 0, Z: 0 },
                rotation: { Pitch: 0, Yaw: 0, Roll: 0 },
            } ];
        }

        if( frame.freight )
            live.Freight = [ frame.freight ];

        return live;
    }

    return storages;
}

export function StorageInfo( {
    className,
    title,
    parentIndex,
    ownerType = 'industry',
    storages,
    isVisible,
    onClose,
    height
}: {
    className?: string,
    title: string,
    parentIndex: number,
    ownerType?: StorageOwnerType,
    storages: { [ category: string ]: IStorage[] },
    isVisible: boolean,
    onClose: () => void,
    height?: number
} ) {
    const { settings } = useContext( MapContext )!;
    const world = useWorld();
    const [ amounts, setAmounts ] = useState<Record<string, number | null>>( {} );
    const [ worldSettings ] = useSettings( WorldSettings );
    const canStorageCheat = useHasCommunicatorAccess( AddStorageCheats );
    const storageCheatsEnabled = worldSettings.features.cheats && canStorageCheat;

    const useCrane = useRPC( storageUseCrane );
    const addStorage = useRPC( AddStorageCheats );
    const setKeepFull = useRPC( SetStorageKeepFull );
    const applyIndustryKeepAll = useRPC( ApplyIndustryKeepAll );
    const canIndustryKeepAll = useHasCommunicatorAccess( ApplyIndustryKeepAll );
    const [ keepFullFlags, setKeepFullFlags ] = useState<Record<string, boolean>>( {} );

    const displayStorages = useMemo(
        () => isVisible
            ? resolveLiveStorages( ownerType, parentIndex, storages, world )
            : storages,
        [ isVisible, ownerType, parentIndex, storages, world ]
    );

    const resolveCategory = ( label: string ): StorageCategory => {
        if( ownerType === 'framecar' )
            return CATEGORY_BY_LABEL[ label ] ?? 'freight';
        if( ownerType !== 'industry' )
            return 'main';
        return CATEGORY_BY_LABEL[ label ] ?? 'product';
    };

    const applyStorageCheat = ( label: string, slotIndex: number, delta?: number, fillMax?: boolean ) => {
        const category = resolveCategory( label );
        addStorage( ownerType, parentIndex, category, slotIndex, delta, fillMax );
        if( fillMax ) {
            const flagKey = `${label}-${slotIndex}`;
            setKeepFullFlags( ( prev ) => ( { ...prev, [ flagKey ]: true } ) );
            setKeepFull( ownerType, parentIndex, category, slotIndex, true );
        }
    };

    const industryCheatsBlocked = ownerType === 'industry' && !( world?.session.isServer ?? false );
    const showStorageCheats = ownerType === 'industry'
        ? storageCheatsEnabled && !industryCheatsBlocked
        : storageCheatsEnabled;

    const slotGoodsLabel = ( category: StorageCategory, structSlot: number, types: ProductType[] ) => {
        const base = formatIndustryStorageSlotLabel( category, structSlot, types );
        const names = types
            .map( ( type ) => ProductDefinitions[ type ]?.name )
            .filter( Boolean )
            .join( ', ' );
        return names ? `${base} (${names})` : base;
    };

    return <DraggableModal
        className={className}
        title={<>
            {title}
            {ownerType === 'industry' && storageCheatsEnabled && canIndustryKeepAll && (
                <Button
                    size="small"
                    type="primary"
                    style={{ marginLeft: 12 }}
                    disabled={industryCheatsBlocked}
                    onClick={() => applyIndustryKeepAll( parentIndex )}
                >
                    Alle Slots immer voll
                </Button>
            )}
        </>}
        visible={isVisible}
        footer={null}
        onCancel={onClose}
        destroyOnClose={true}
        zIndex={2000}
        initialHeight={height || ( 150 * Object.keys( displayStorages ).length )}
        modalRender={( content ) => {
            if ( !React.isValidElement( content ) )
                return;
            return React.cloneElement( content, {
                onClick: ( e: React.MouseEvent ) => {
                    e.stopPropagation();
                }
            } as any );
        }}
    >
        {ownerType === 'industry' && storageCheatsEnabled && <IndustryCheatHostWarning />}
        {ownerType === 'industry' && <IndustryStorageSyncWarning />}
        {Object.keys( displayStorages ).map( ( storageLabel ) => <table key={storageLabel} style={{
            width: '100%',
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 20
        }}>
            <tbody>
                {displayStorages[ storageLabel ].length > 0 && <tr>
                    <td
                        style={{ textAlign: 'center' }}
                        colSpan={displayStorages[ storageLabel ].length * 2}
                    >{storageLabel}</td>
                </tr>}
                <tr>
                    {displayStorages[ storageLabel ].map( ( storage, rowIndex: number ) => {
                        const { currentAmount, maxAmount, types, cranes, slotIndex } = storage;
                        const structSlot = slotIndex ?? rowIndex;
                        const key = `${storageLabel}-${structSlot}`;
                        return <React.Fragment key={key}>
                        <table style={{
                            width: '100%',
                            marginBottom: 20
                        }}>
                            <tbody>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontSize: 11, color: '#666', paddingBottom: 4 }}>
                                        {slotGoodsLabel( resolveCategory( storageLabel ), structSlot, types )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{
                                        textAlign: 'right',
                                        width: Math.round( 50 / displayStorages[ storageLabel ].length ) + '%',
                                        paddingRight: 5,
                                    }}>
                                        {currentAmount} / {maxAmount}
                                    </td>
                                    <td style={{ width: Math.round( 50 / displayStorages[ storageLabel ].length ) + '%' }}>
                                        {types.map( ( item: ProductType, i: number ) => <img
                                            className="dark-mode-invert"
                                            src={ProductDefinitions[ item ]?.image}
                                            height={50}
                                            key={i.toString()}
                                            style={{ display: 'block', marginLeft: ProductDefinitions[ item ]?.offset ? ProductDefinitions[ item ].offset : 0 }}
                                        /> )}
                                    </td>
                                </tr>
                                {showStorageCheats && <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', paddingTop: 8 }}>
                                        <InputNumber
                                            style={{ width: 120, marginRight: 8 }}
                                            placeholder="Add amount"
                                            value={amounts[ key ] ?? undefined}
                                            onChange={( v ) => setAmounts( ( prev ) => ( {
                                                ...prev,
                                                [ key ]: typeof v === 'number' ? v : null,
                                            } ) )}
                                        />
                                        <Button
                                            size="small"
                                            type="primary"
                                            style={{ marginRight: 8 }}
                                            onClick={() => {
                                                const delta = amounts[ key ];
                                                if( delta == null )
                                                    return;
                                                applyStorageCheat( storageLabel, structSlot, delta );
                                            }}
                                        >
                                            Add
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => applyStorageCheat( storageLabel, structSlot, undefined, true )}
                                        >
                                            Max
                                        </Button>
                                        <span style={{ marginLeft: 8, fontSize: 12 }}>Immer voll</span>
                                        <Switch
                                            size="small"
                                            checked={keepFullFlags[ key ] ?? false }
                                            onChange={( checked ) => {
                                                setKeepFullFlags( ( prev ) => ( { ...prev, [ key ]: checked } ) );
                                                setKeepFull(
                                                    ownerType,
                                                    parentIndex,
                                                    resolveCategory( storageLabel ),
                                                    structSlot,
                                                    checked
                                                );
                                                if( checked )
                                                    applyStorageCheat( storageLabel, structSlot, undefined, true );
                                            }}
                                        />
                                    </td>
                                </tr>}
                            </tbody>
                        </table>
                        {cranes.length > 0 && settings.features.controlCranes &&
                            <table style={{
                                width: '100%',
                                marginBottom: 20
                            }}>
                                <tbody>
                                    <tr>
                                        {cranes.map( ( c ) => <td style={{
                                            textAlign: 'center',
                                            width: Math.round( 50 / displayStorages[ storageLabel ].length / 6 ) + '%',
                                            paddingRight: 5,
                                        }}>
                                            <Button onClick={() => {
                                                useCrane( parentIndex, structSlot, c.id );
                                            }}>
                                                Use crane {c.id}
                                            </Button>
                                        </td>
                                        )}
                                    </tr>
                                </tbody>
                            </table>
                        }
                    </React.Fragment>;
                    } )}
                </tr>
            </tbody>
        </table>
        )}
    </DraggableModal>;
}
