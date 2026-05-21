import { Actions, IQuery, SettingsStore, StructConstructor } from "@rrox/api";
import WorldPlugin from ".";
import {
    FrameCarType,
    formatIndustryStorageSlotLabel,
    ICheats,
    IWorldSettings,
    isEngine,
    LocomotivePreset,
    Log,
    ProductType,
    StorageCategory,
    StorageOwnerType,
} from "../shared";
import { IndustryServerRpcResearch } from "./industryServerRpc";
import { freightTypeToProductType } from "./structs/beta-UE5/arr/efreighttype";
import { Structs } from "./structs/types";

export class Cheats {
    private pawnQuery: IQuery<Structs.APlayerState>;
    private cheatsQuery: IQuery<Structs.ASCharacter>;
    private storageQuery: IQuery<Structs.Astorage>;
    private freightQuery: IQuery<Structs.AFreight>;
    private tenderQuery: IQuery<Structs.Atender>;
    private boilerQuery: IQuery<Structs.Aboiler>;
    private boilerOpsQuery: IQuery<Structs.Aboiler>;
    private compressorQuery: IQuery<Structs.Acompressor>;
    private framecarSpeedQuery: IQuery<Structs.Aframecar>;

    private fastSprintPlayers = new Map<Structs.ASCharacter, number>();;

    private static readonly KEEP_FULL_INTERVAL_MS = 100;

    private keepFullTargets = new Map<string, {
        owner: StorageOwnerType,
        parentIndex: number,
        category: StorageCategory,
        slotIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar,
        industryName?: string,
        industryRef?: Structs.Aindustry,
    }>();

    private keepFullInterval: NodeJS.Timeout;
    private keepFullBusy = false;
    private keepFullLastWarn = new Map<string, number>();

    private keepBoilerTargets = new Map<string, {
        parentIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar,
        pressure?: boolean,
        fire?: boolean,
        waterTemp?: boolean,
        unlimitedSteam?: boolean,
    }>();

    private keepBrakeAirTargets = new Map<string, {
        parentIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar,
    }>();

    private speedBoostTargets = new Map<string, {
        parentIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar,
        baseMax: int32,
        multiplier: number,
    }>();

    private interval: NodeJS.Timeout;
    private industryServerRpc: IndustryServerRpcResearch;

    constructor( private plugin: WorldPlugin, private settings: SettingsStore<IWorldSettings> ) {
        this.industryServerRpc = new IndustryServerRpcResearch( this.plugin, this );
    }

    public async prepare() {
        const data = this.plugin.controller.getAction( Actions.QUERY );

        this.pawnQuery = await data.prepareQuery( this.plugin.world.structs.Engine.APlayerState, ( player ) => [
            player.PawnPrivate
        ] );

        this.cheatsQuery = await data.prepareQuery( this.plugin.world.structs.arr.ASCharacter as StructConstructor<Structs.ASCharacter>, ( char ) => [
            char.CharacterMovement.MaxFlySpeed,
            char.CharacterMovement.MaxWalkSpeed,
            char.CharacterMovement.MovementMode,
        ] );

        this.storageQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Astorage as StructConstructor<Structs.Astorage>,
            ( storage ) => [ storage.currentamountitems, storage.maxitems ]
        );

        this.freightQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.AFreight as StructConstructor<Structs.AFreight>,
            ( freight ) => [ freight.currentfreight, freight.maxfreight ]
        );

        this.tenderQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Atender as StructConstructor<Structs.Atender>,
            ( tender ) => [
                tender.currentamountWater,
                tender.maxamountwater,
                tender.currentamountFuel,
                tender.maxamountfuel,
            ]
        );

        this.boilerQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Aboiler as StructConstructor<Structs.Aboiler>,
            ( boiler ) => [
                boiler.currentfuel,
                boiler.maxfuel,
                boiler.currentwateramount,
                boiler.maxwateramount,
            ]
        );

        this.boilerOpsQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Aboiler as StructConstructor<Structs.Aboiler>,
            ( boiler ) => [
                boiler.currentboilerpressure,
                boiler.maxboilerpressure,
                boiler.currentfiretemperature,
                boiler.maxfiretemperature,
                boiler.currentwatertemperature,
                boiler.maxwatertemperature,
                boiler.bhasunlimitedsteam,
            ]
        );

        this.compressorQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Acompressor as StructConstructor<Structs.Acompressor>,
            ( compressor ) => [
                compressor.currentairpressure,
                compressor.maxairpressure,
            ]
        );

        this.framecarSpeedQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Aframecar as StructConstructor<Structs.Aframecar>,
            ( car ) => [ car.maxspeedms ]
        );

        await this.industryServerRpc.prepare( this.storageQuery );
    }

    public start() {
        this.stop();

        const data = this.plugin.controller.getAction( Actions.QUERY );

        this.interval = setInterval( async () => {
            if( !this.settings.get( 'features.cheats' ) ) {
                this.fastSprintPlayers.clear();
                this.keepFullTargets.clear();
                this.keepFullLastWarn.clear();
                this.keepBoilerTargets.clear();
                this.keepBrakeAirTargets.clear();
                this.speedBoostTargets.clear();
                return;
            }

            for( let [ character, speed ] of this.fastSprintPlayers ) {
                const latestData = await data.query( this.cheatsQuery, character );
                if( !latestData || latestData.CharacterMovement.MaxWalkSpeed === 200 )
                    continue;

                latestData.CharacterMovement.MaxWalkSpeed = speed;

                await data.save( latestData.CharacterMovement );
            }

            for( const [ key, target ] of this.keepBoilerTargets ) {
                try {
                    const frameCar = this.resolveFramecarStruct(
                        target.parentIndex,
                        target.frameNumber,
                        target.frameRef
                    );
                    if( !frameCar )
                        throw new Error( `Framecar not found (${target.frameNumber ?? '#' + target.parentIndex}).` );

                    const index = this.plugin.world.data.frameCars.indexOf( frameCar );
                    await this.applyBoilerAspects(
                        index >= 0 ? index : target.parentIndex,
                        target,
                        true,
                        frameCar
                    );
                } catch( err ) {
                    this.logKeepFullWarn( `boiler:${key}`, err );
                }
            }

            for( const [ key, target ] of this.keepBrakeAirTargets ) {
                try {
                    const frameCar = this.resolveFramecarStruct(
                        target.parentIndex,
                        target.frameNumber,
                        target.frameRef
                    );
                    if( !frameCar )
                        throw new Error( `Framecar not found (${target.frameNumber ?? '#' + target.parentIndex}).` );

                    const index = this.plugin.world.data.frameCars.indexOf( frameCar );
                    await this.setBrakeAir( index >= 0 ? index : target.parentIndex, true, true, frameCar );
                } catch( err ) {
                    this.logKeepFullWarn( `brake:${key}`, err );
                }
            }

            for( const [ key, target ] of this.speedBoostTargets ) {
                try {
                    const frameCar = this.resolveFramecarStruct(
                        target.parentIndex,
                        target.frameNumber,
                        target.frameRef
                    );
                    if( !frameCar )
                        throw new Error( `Framecar not found (${target.frameNumber ?? '#' + target.parentIndex}).` );

                    const latest = await data.query( this.framecarSpeedQuery, frameCar );
                    if( !latest )
                        continue;

                    const targetSpeed = Math.max(
                        target.baseMax,
                        Math.round( target.baseMax * target.multiplier )
                    );
                    if( latest.maxspeedms !== targetSpeed ) {
                        latest.maxspeedms = targetSpeed;
                        await data.save( latest );
                    }
                } catch( err ) {
                    this.logKeepFullWarn( `speed:${key}`, err );
                }
            }
        }, 500 );

        this.keepFullInterval = setInterval( () => void this.tickKeepFull(), Cheats.KEEP_FULL_INTERVAL_MS );
    }

    public stop() {
        clearInterval( this.interval );
        clearInterval( this.keepFullInterval );
        this.keepFullBusy = false;
        this.fastSprintPlayers.clear();
        this.keepFullTargets.clear();
        this.keepFullLastWarn.clear();
        this.keepBoilerTargets.clear();
        this.keepBrakeAirTargets.clear();
        this.speedBoostTargets.clear();
    }

    private resolveFramecarStruct(
        parentIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar
    ): Structs.Aframecar | undefined {
        const cars = this.plugin.world.data.frameCars;
        const data = this.plugin.controller.getAction( Actions.QUERY );

        if( frameRef ) {
            const idx = cars.findIndex( ( fc ) => data.equals( fc, frameRef ) );
            if( idx >= 0 )
                return cars[ idx ];
        }

        if( frameNumber ) {
            const byNumber = cars.find( ( fc ) => fc.FrameNumber === frameNumber );
            if( byNumber )
                return byNumber;
        }

        return cars[ parentIndex ];
    }

    private getIndustryName( industry: Structs.Aindustry ): string | undefined {
        if( 'IndustryName' in industry && industry.IndustryName )
            return industry.IndustryName.getValue();

        return undefined;
    }

    private resolveIndustryStruct(
        parentIndex: number,
        industryName?: string,
        industryRef?: Structs.Aindustry
    ): { industry: Structs.Aindustry, index: number } | undefined {
        const industries = this.plugin.world.data.industries;
        const data = this.plugin.controller.getAction( Actions.QUERY );

        if( industryRef ) {
            const index = industries.findIndex( ( ind ) => data.equals( ind, industryRef ) );
            if( index >= 0 )
                return { industry: industries[ index ], index };
        }

        if( industryName ) {
            const index = industries.findIndex( ( ind ) => this.getIndustryName( ind ) === industryName );
            if( index >= 0 )
                return { industry: industries[ index ], index };
        }

        const industry = industries[ parentIndex ];
        if( industry )
            return { industry, index: parentIndex };

        return undefined;
    }

    private getIndustryStorageSlot(
        industry: Structs.Aindustry,
        category: StorageCategory,
        slotIndex: number
    ): Structs.Astorage | undefined {
        if( slotIndex < 0 || slotIndex > 3 )
            return undefined;

        const slots = category === 'educt'
            ? [
                industry.mystorageeducts1,
                industry.mystorageeducts2,
                industry.mystorageeducts3,
                industry.mystorageeducts4,
            ]
            : [
                industry.mystorageproducts1,
                industry.mystorageproducts2,
                industry.mystorageproducts3,
                industry.mystorageproducts4,
            ];

        return slots[ slotIndex ];
    }

    /** Werte aus der Boost-Kette 11→22→44 (Speicher-Artefakt). */
    private isLikelyBoostedMaxSpeed( value: number ): boolean {
        if( value < 20 )
            return true;

        const boostChain = [ 11, 22, 33, 44, 55, 66, 88 ];
        return boostChain.includes( value );
    }

    private defaultMaxSpeedForType( type: string ): number {
        switch( type ) {
            case FrameCarType.HANDCAR:
                return 20;
            case FrameCarType.PORTER:
            case FrameCarType.PORTER2:
            case FrameCarType.EUREKA:
                return 32;
            case FrameCarType.COOKE260:
            case FrameCarType.COOKE280:
            case FrameCarType.COOKE260COAL:
            case FrameCarType.TWEETSIE280:
            case FrameCarType.LIMA280:
            case FrameCarType.MONTEZUMA:
            case FrameCarType.GLENBROOK:
            case FrameCarType.MOSCA:
            case FrameCarType.BALDWIN622D:
            case FrameCarType.TENMILE:
            case FrameCarType.RUBYBASIN:
                return 55;
            default:
                return 45;
        }
    }

    /** Referenz-Maxspeed ohne Boost-Artefakte (andere Loks / Defaults). */
    private inferTypicalMaxSpeedMs( frameIndex: number ): number {
        const world = this.plugin.world.valueProvider.getValue();
        const target = world?.frameCars[ frameIndex ];
        if( !target?.type )
            return 55;

        const sane = ( v: number ) => v >= 25 && !this.isLikelyBoostedMaxSpeed( v );

        const sameType = world!.frameCars
            .filter( ( f, i ) => f.type === target.type && i !== frameIndex && sane( f.maxSpeedMs ) )
            .map( ( f ) => f.maxSpeedMs );

        const otherEngines = world!.frameCars
            .filter( ( f ) => isEngine( f ) && sane( f.maxSpeedMs ) )
            .map( ( f ) => f.maxSpeedMs );

        const candidates = [ ...sameType, ...otherEngines ];
        if( candidates.length > 0 )
            return Math.max( ...candidates );

        return this.defaultMaxSpeedForType( target.type ) || 55;
    }

    /** Basis-Maxspeed beim ersten Boost (nie einen schon geboosteten Live-Wert übernehmen). */
    private resolveBaselineMaxSpeedMs(
        frameIndex: number,
        liveMax: number,
        storedBase?: number
    ): number {
        if( storedBase != null && storedBase >= 25 && !this.isLikelyBoostedMaxSpeed( storedBase ) )
            return storedBase;

        const typical = this.inferTypicalMaxSpeedMs( frameIndex );

        if( this.isLikelyBoostedMaxSpeed( liveMax ) || ( typical > 0 && liveMax > typical * 1.08 ) )
            return typical;

        return Math.max( typical, liveMax );
    }

    private frameKeepKey( frameIndex: number, frameCar?: Structs.Aframecar ): string {
        const car = frameCar ?? this.plugin.world.data.frameCars[ frameIndex ];
        return car?.FrameNumber || `idx:${frameIndex}`;
    }

    private captureFrameKeepMeta( frameIndex: number ): {
        parentIndex: number,
        frameNumber?: string,
        frameRef?: Structs.Aframecar,
    } {
        const frameCar = this.plugin.world.data.frameCars[ frameIndex ];
        return {
            parentIndex: frameIndex,
            frameNumber: frameCar?.FrameNumber,
            frameRef: frameCar,
        };
    }

    public getLocomotiveKeepState( frameIndex: number ): {
        storage: Partial<Record<'boiler_water' | 'boiler_fuel' | 'tender_water' | 'tender_fuel' | 'freight', boolean>>,
        boilerPressure: boolean,
        boilerFire: boolean,
        boilerWaterTemp: boolean,
        unlimitedSteam: boolean,
        brakeAir: boolean,
        speedBoost: boolean,
    } {
        const frameCar = this.plugin.world.data.frameCars[ frameIndex ];
        const frameNumber = frameCar?.FrameNumber;

        const storage: Partial<Record<'boiler_water' | 'boiler_fuel' | 'tender_water' | 'tender_fuel' | 'freight', boolean>> = {};
        for( const target of this.keepFullTargets.values() ) {
            if( target.owner !== 'framecar' )
                continue;

            const matches = frameNumber
                ? target.frameNumber === frameNumber
                : target.parentIndex === frameIndex;

            if( matches && (
                target.category === 'boiler_water'
                || target.category === 'boiler_fuel'
                || target.category === 'tender_water'
                || target.category === 'tender_fuel'
                || target.category === 'freight'
            ) )
                storage[ target.category ] = true;
        }

        const keepKey = this.frameKeepKey( frameIndex, frameCar );
        const boiler = this.keepBoilerTargets.get( keepKey );

        return {
            storage,
            boilerPressure: !!boiler?.pressure,
            boilerFire: !!boiler?.fire,
            boilerWaterTemp: !!boiler?.waterTemp,
            unlimitedSteam: !!boiler?.unlimitedSteam,
            brakeAir: this.keepBrakeAirTargets.has( keepKey ),
            speedBoost: this.speedBoostTargets.has( keepKey ),
        };
    }

    private async tickKeepFull(): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) || this.keepFullTargets.size === 0 )
            return;

        if( this.keepFullBusy )
            return;

        this.keepFullBusy = true;
        try {
            for( const [ key, target ] of this.keepFullTargets ) {
                try {
                    if( target.owner === 'framecar' ) {
                        const frameCar = this.resolveFramecarStruct(
                            target.parentIndex,
                            target.frameNumber,
                            target.frameRef
                        );
                        if( !frameCar )
                            throw new Error( `Framecar not found (${target.frameNumber ?? '#' + target.parentIndex}).` );

                        const index = this.plugin.world.data.frameCars.findIndex( ( fc ) => fc === frameCar );
                        await this.addFramecarStorage(
                            index >= 0 ? index : target.parentIndex,
                            target.category,
                            undefined,
                            true,
                            true,
                            frameCar
                        );
                    } else if( target.owner === 'industry' ) {
                        const resolved = this.resolveIndustryStruct(
                            target.parentIndex,
                            target.industryName,
                            target.industryRef
                        );
                        if( !resolved ) {
                            this.keepFullTargets.delete( key );
                            continue;
                        }

                        const storage = this.getIndustryStorageSlot(
                            resolved.industry,
                            target.category,
                            target.slotIndex
                        );
                        if( !storage || storage.maxitems <= 0 ) {
                            this.keepFullTargets.delete( key );
                            continue;
                        }

                        await this.addStorage(
                            'industry',
                            resolved.index,
                            target.category,
                            target.slotIndex,
                            undefined,
                            true,
                            true
                        );
                    } else {
                        await this.addStorage(
                            target.owner,
                            target.parentIndex,
                            target.category,
                            target.slotIndex,
                            undefined,
                            true,
                            true
                        );
                    }
                } catch( err ) {
                    this.logKeepFullWarn( key, err );
                    if( target.owner === 'industry' && err instanceof Error && err.message.includes( 'Storage not found' ) )
                        this.keepFullTargets.delete( key );
                }
            }
        } finally {
            this.keepFullBusy = false;
        }
    }

    private logKeepFullWarn( key: string, err: unknown ): void {
        const now = Date.now();
        const last = this.keepFullLastWarn.get( key ) ?? 0;
        if( now - last < 5000 )
            return;

        this.keepFullLastWarn.set( key, now );
        const message = err instanceof Error ? err.message : String( err );
        Log.warn( `Keep-full ${key}: ${message}` );
    }

    private ensureIndustryCheatsAllowed(): void {
        if( !this.plugin.world.isServer )
            throw new Error(
                'Industrie-Cheats funktionieren nur als Host. '
                + 'RROx muss am Host-PC attached sein — auf fremden Servern ändert sich im Spiel nichts.'
            );
    }

    public getIndustryStorageForCheat(
        parentIndex: number,
        category: StorageCategory,
        slotIndex: number
    ): Structs.Astorage | undefined {
        return this.resolveStorage( 'industry', parentIndex, category, slotIndex );
    }

    private parseIndustryStorageTypes( storage: Structs.Astorage ): ProductType[] {
        let storageTypes: ProductType[] = [];

        if( 'storagetype' in storage && storage.storagetype !== '' )
            storageTypes = storage.storagetype.split( ',' ) as ProductType[];
        else if( 'HoldableFreightTypes' in storage && storage.HoldableFreightTypes ) {
            storageTypes = storage.HoldableFreightTypes
                .map( ( t ) => freightTypeToProductType( t ) )
                .filter( ( t ): t is ProductType => t !== null );
        }

        return storageTypes;
    }

    public async probeIndustryStorageSlots( industryIndex: number ) {
        const resolved = this.resolveIndustryStruct( industryIndex );
        if( !resolved )
            return [];

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const categories: StorageCategory[] = [ 'educt', 'product' ];
        const probes: {
            category: StorageCategory,
            slotIndex: number,
            currentAmount: number,
            maxAmount: number,
            types: ProductType[],
            label: string,
        }[] = [];

        for( const category of categories ) {
            for( let slotIndex = 0; slotIndex < 4; slotIndex++ ) {
                const storage = this.getIndustryStorageSlot( resolved.industry, category, slotIndex );
                if( !storage )
                    continue;

                const latest = await data.query( this.storageQuery, storage );
                if( !latest || latest.maxitems <= 0 )
                    continue;

                const types = this.parseIndustryStorageTypes( latest );
                probes.push( {
                    category,
                    slotIndex,
                    currentAmount: latest.currentamountitems,
                    maxAmount: latest.maxitems,
                    types,
                    label: formatIndustryStorageSlotLabel( category, slotIndex, types ),
                } );
            }
        }

        return probes;
    }

    public async autotestIndustryServerRpc( industryIndex: number ) {
        if( !this.settings.get( 'features.cheats' ) )
            throw new Error( 'Cheats sind deaktiviert.' );

        if( !this.settings.get( 'features.experimentalIndustryServerRpc' ) )
            throw new Error( 'Experimental Industry Server RPC ist in den Einstellungen deaktiviert.' );

        if( this.plugin.world.isServer )
            throw new Error( 'Server-RPC-Autotest ist nur als MP-Client gedacht (nicht als Host).' );

        const probes = await this.probeIndustryStorageSlots( industryIndex );
        Log.info( `Industry RPC autotest: start industry#${industryIndex} (${probes.length} slot(s))` );

        const slots: {
            category: StorageCategory,
            slotIndex: number,
            types: ProductType[],
            label: string,
            baseline: number,
            finalAmount: number,
            memoryChanged: boolean,
            bestRpc?: string,
            attempts: {
                label: string,
                ok: boolean,
                amountAfter: number,
                error?: string,
            }[],
        }[] = [];

        for( const probe of probes ) {
            const result = await this.industryServerRpc.tryFillIndustryStorage(
                industryIndex,
                probe.category,
                probe.slotIndex
            );
            const mappedAttempts = result.attempts.map( ( attempt ) => ( {
                label: attempt.label,
                ok: attempt.ok,
                amountAfter: attempt.amountAfter,
                error: attempt.error,
            } ) );
            const bestRpc = mappedAttempts.find( ( attempt ) => attempt.ok )?.label;
            const memoryChanged = result.finalAmount > result.baseline + 0.5;

            slots.push( {
                category: probe.category,
                slotIndex: probe.slotIndex,
                types: probe.types,
                label: probe.label,
                baseline: result.baseline,
                finalAmount: result.finalAmount,
                memoryChanged,
                bestRpc,
                attempts: mappedAttempts,
            } );

            Log.info(
                `Industry RPC autotest: ${probe.label} `
                + `${result.baseline} -> ${result.finalAmount} `
                + `(memory ${memoryChanged ? 'CHANGED' : 'unchanged'}, best: ${bestRpc ?? '—'})`
            );
        }

        const anyMemoryChanged = slots.some( ( slot ) => slot.memoryChanged );
        Log.info(
            `Industry RPC autotest: done industry#${industryIndex} — `
            + `${slots.filter( ( slot ) => slot.memoryChanged ).length}/${slots.length} slot(s) memory increased. `
            + 'Spiel-HUD prüfen (Server kann abweichen).'
        );

        return {
            industryIndex,
            slots,
            anyMemoryChanged,
        };
    }

    public async runIndustryRpcFocusTests(
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ) {
        if( !this.settings.get( 'features.cheats' ) )
            throw new Error( 'Cheats sind deaktiviert.' );

        if( !this.settings.get( 'features.experimentalIndustryServerRpc' ) )
            throw new Error( 'Experimental Industry Server RPC ist in den Einstellungen deaktiviert.' );

        if( this.plugin.world.isServer )
            throw new Error( 'Focus-Tests sind nur als MP-Client gedacht (nicht als Host).' );

        return this.industryServerRpc.runFocusTests( industryIndex, category, slotIndex );
    }

    public async tryIndustryServerRpcFill(
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ) {
        if( !this.settings.get( 'features.cheats' ) )
            throw new Error( 'Cheats sind deaktiviert.' );

        if( !this.settings.get( 'features.experimentalIndustryServerRpc' ) )
            throw new Error( 'Experimental Industry Server RPC ist in den Einstellungen deaktiviert.' );

        if( this.plugin.world.isServer )
            throw new Error( 'Server-RPC-Forschung ist nur als MP-Client gedacht (nicht als Host).' );

        const result = await this.industryServerRpc.tryFillIndustryStorage( industryIndex, category, slotIndex );
        return {
            baseline: result.baseline,
            finalAmount: result.finalAmount,
            hudLikelyChanged: result.hudLikelyChanged,
            attempts: result.attempts.map( ( attempt ) => ( {
                label: attempt.label,
                ok: attempt.ok,
                amountAfter: attempt.amountAfter,
                error: attempt.error,
            } ) ),
        };
    }

    public setKeepFull(
        owner: StorageOwnerType,
        parentIndex: number,
        category: StorageCategory,
        slotIndex: number,
        enabled: boolean
    ): void {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        if( owner === 'industry' )
            this.ensureIndustryCheatsAllowed();

        const key = `${owner}:${parentIndex}:${category}:${slotIndex}`;
        const target: {
            owner: StorageOwnerType,
            parentIndex: number,
            category: StorageCategory,
            slotIndex: number,
            frameNumber?: string,
            frameRef?: Structs.Aframecar,
            industryName?: string,
            industryRef?: Structs.Aindustry,
        } = { owner, parentIndex, category, slotIndex };

        if( owner === 'framecar' ) {
            const frameCar = this.plugin.world.data.frameCars[ parentIndex ];
            if( frameCar ) {
                target.frameNumber = frameCar.FrameNumber;
                target.frameRef = frameCar;
            }
        }

        if( owner === 'industry' ) {
            const industry = this.plugin.world.data.industries[ parentIndex ];
            if( industry ) {
                target.industryName = this.getIndustryName( industry );
                target.industryRef = industry;
            }
        }

        if( enabled ) {
            this.keepFullTargets.set( key, target );
            this.keepFullLastWarn.delete( key );
            void this.addStorage( owner, parentIndex, category, slotIndex, undefined, true ).catch( ( err ) => {
                this.logKeepFullWarn( key, err );
            } );
        } else {
            this.keepFullTargets.delete( key );
            this.keepFullLastWarn.delete( key );
        }
    }

    private async getCharacter( player: Structs.APlayerState ): Promise<Structs.ASCharacter> {
        const data = this.plugin.controller.getAction( Actions.QUERY );

        let pawn: Structs.APawn;
        if( player.PawnPrivate )
            pawn = player.PawnPrivate;
        else {
            const p = await data.query( this.pawnQuery, player );
            if( !p?.PawnPrivate )
                throw new Error( 'Could not find player to get cheats for.' );

            pawn = player.PawnPrivate;
        }
        
        const character = await data.cast( pawn, this.plugin.world.structs.arr.ASCharacter as StructConstructor<Structs.ASCharacter> );

        if( !character )
            throw new Error( 'Could not find character to get cheats for.' );

        const cheats = await data.query( this.cheatsQuery, character );

        if( !cheats || !cheats.CharacterMovement )
            throw new Error( 'Could not retrieve character cheats.' );

        return cheats;
    }

    public async getCheats( player: Structs.APlayerState ): Promise<ICheats> {
        const data = this.plugin.controller.getAction( Actions.QUERY );

        const character = await this.getCharacter( player );

        const fastSprintKey = Array.from( this.fastSprintPlayers.keys() ).find( ( p ) => data.equals( p, character ) );
    
        return {
            flySpeed: character.CharacterMovement.MovementMode === this.plugin.world.structs.Engine.EMovementMode.MOVE_Flying ? character.CharacterMovement.MaxFlySpeed : undefined,
            walkSpeed: fastSprintKey ? this.fastSprintPlayers.get(fastSprintKey) : undefined,
        }
    }

    public async setCheats( player: Structs.APlayerState, cheats: ICheats ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const data = this.plugin.controller.getAction( Actions.QUERY );

        const character = await this.getCharacter( player );
    
        if( cheats.flySpeed ) {
            character.CharacterMovement.MovementMode = this.plugin.world.structs.Engine.EMovementMode.MOVE_Flying;
            character.CharacterMovement.MaxFlySpeed = cheats.flySpeed;
        } else {
            character.CharacterMovement.MovementMode = this.plugin.world.structs.Engine.EMovementMode.MOVE_Walking;
        }

        const keys = Array.from( this.fastSprintPlayers.keys() ).filter( ( p ) => data.equals( p, character ) );
        for( let key of keys )
            this.fastSprintPlayers.delete( key );

        if( cheats.walkSpeed ) {
            this.fastSprintPlayers.set( character, cheats.walkSpeed );
        }

        await data.save( character.CharacterMovement );
    }

    public async setMoneyXP( player: Structs.APlayerState, money?: number, xp?: number ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const data = this.plugin.controller.getAction( Actions.QUERY );

        const character = await this.getCharacter( player );

        if( money )
            await character.ChangePlayerMoney( money );
        if( xp )
            await character.ChangePlayerXP( xp );

        await data.save( character.CharacterMovement );
    }

    public async addStorage(
        owner: StorageOwnerType,
        parentIndex: number,
        category: StorageCategory,
        slotIndex: number,
        delta?: number,
        fillMax?: boolean,
        silent?: boolean
    ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        if( owner === 'framecar' )
            return this.addFramecarStorage( parentIndex, category, delta, fillMax, silent );

        if( owner === 'industry' )
            this.ensureIndustryCheatsAllowed();

        const storage = this.resolveStorage( owner, parentIndex, category, slotIndex );
        if( !storage )
            throw new Error( `Storage not found (${owner} #${parentIndex}, ${category}[${slotIndex}]).` );

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const latest = await data.query( this.storageQuery, storage );

        if( !latest )
            throw new Error( 'Could not read storage from game memory.' );

        const before = latest.currentamountitems;

        if( fillMax ) {
            if( latest.maxitems <= 0 )
                return;

            latest.currentamountitems = latest.maxitems;
        } else if( delta != null && delta !== 0 )
            latest.currentamountitems = Math.max( 0, Math.min( latest.maxitems, latest.currentamountitems + delta ) );
        else
            return;

        await data.save( latest );

        if( !silent )
            Log.info(
                `Storage cheat: ${owner}#${parentIndex} ${category}[${slotIndex}] `
                + `${before} -> ${latest.currentamountitems} (max ${latest.maxitems})`
            );
    }

    private resolveStorage(
        owner: StorageOwnerType,
        parentIndex: number,
        category: StorageCategory,
        slotIndex: number
    ): Structs.Astorage | undefined {
        if( slotIndex < 0 || slotIndex > 3 )
            return undefined;

        if( owner === 'industry' ) {
            const resolved = this.resolveIndustryStruct( parentIndex );
            if( !resolved )
                return undefined;

            return this.getIndustryStorageSlot( resolved.industry, category, slotIndex );
        }

        if( owner === 'sandhouse' ) {
            if( category !== 'main' || slotIndex !== 0 )
                return undefined;

            return this.plugin.world.data.sandhouses[ parentIndex ]?.Mystorage;
        }

        if( owner === 'watertower' ) {
            if( category !== 'main' || slotIndex !== 0 )
                return undefined;

            return this.plugin.world.data.watertowers[ parentIndex ]?.Mystorage;
        }

        return undefined;
    }

    private async addFramecarStorage(
        frameIndex: number,
        category: StorageCategory,
        delta?: number,
        fillMax?: boolean,
        silent?: boolean,
        frameCar?: Structs.Aframecar
    ): Promise<void> {
        frameCar = frameCar ?? this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar )
            throw new Error( `Framecar #${frameIndex} not found.` );

        const data = this.plugin.controller.getAction( Actions.QUERY );

        if( category === 'freight' ) {
            if( !frameCar.MyFreight )
                throw new Error( 'This car has no freight storage.' );

            const latest = await data.query( this.freightQuery, frameCar.MyFreight );
            if( !latest )
                throw new Error( 'Could not read freight from game memory.' );

            const before = latest.currentfreight;
            if( fillMax )
                latest.currentfreight = latest.maxfreight;
            else if( delta != null && delta !== 0 )
                latest.currentfreight = Math.max( 0, Math.min( latest.maxfreight, latest.currentfreight + delta ) );
            else
                return;

            await data.save( latest );
            if( !silent )
                Log.info( `Freight cheat: framecar#${frameIndex} ${before} -> ${latest.currentfreight} (max ${latest.maxfreight})` );
            return;
        }

        if( category === 'boiler_water' || category === 'boiler_fuel' ) {
            if( !frameCar.MyBoiler )
                throw new Error( 'This locomotive has no boiler.' );

            const boiler = await data.query( this.boilerQuery, frameCar.MyBoiler );
            if( !boiler )
                throw new Error( 'Could not read boiler from game memory.' );

            if( category === 'boiler_water' ) {
                const before = boiler.currentwateramount;
                if( fillMax )
                    boiler.currentwateramount = boiler.maxwateramount;
                else if( delta != null && delta !== 0 )
                    boiler.currentwateramount = Math.max( 0, Math.min( boiler.maxwateramount, boiler.currentwateramount + delta ) );
                else
                    return;

                await data.save( boiler );
                if( !silent )
                    Log.info( `Boiler water cheat: framecar#${frameIndex} ${before} -> ${boiler.currentwateramount} (max ${boiler.maxwateramount})` );
                return;
            }

            const before = boiler.currentfuel;
            if( fillMax )
                boiler.currentfuel = boiler.maxfuel;
            else if( delta != null && delta !== 0 )
                boiler.currentfuel = Math.max( 0, Math.min( boiler.maxfuel, boiler.currentfuel + delta ) );
            else
                return;

            await data.save( boiler );
            if( !silent )
                Log.info( `Boiler fuel cheat: framecar#${frameIndex} ${before} -> ${boiler.currentfuel} (max ${boiler.maxfuel})` );
            return;
        }

        if( category === 'tender_water' || category === 'tender_fuel' ) {
            if( !frameCar.MyTender )
                throw new Error( 'This locomotive has no tender.' );

            const latest = await data.query( this.tenderQuery, frameCar.MyTender );
            if( !latest )
                throw new Error( 'Could not read tender from game memory.' );

            if( category === 'tender_water' ) {
                const before = latest.currentamountWater;
                if( fillMax )
                    latest.currentamountWater = latest.maxamountwater;
                else if( delta != null && delta !== 0 )
                    latest.currentamountWater = Math.max( 0, Math.min( latest.maxamountwater, latest.currentamountWater + delta ) );
                else
                    return;

                await data.save( latest );
                if( !silent )
                    Log.info( `Tender water cheat: framecar#${frameIndex} ${before} -> ${latest.currentamountWater} (max ${latest.maxamountwater})` );
                return;
            }

            if( latest.maxamountfuel <= 0 && frameCar.MyBoiler ) {
                const boiler = await data.query( this.boilerQuery, frameCar.MyBoiler );
                if( !boiler )
                    throw new Error( 'Could not read boiler fuel from game memory.' );

                const before = boiler.currentfuel;
                if( fillMax )
                    boiler.currentfuel = boiler.maxfuel;
                else if( delta != null && delta !== 0 )
                    boiler.currentfuel = Math.max( 0, Math.min( boiler.maxfuel, boiler.currentfuel + delta ) );
                else
                    return;

                await data.save( boiler );
                if( !silent )
                    Log.info( `Boiler fuel cheat: framecar#${frameIndex} ${before} -> ${boiler.currentfuel} (max ${boiler.maxfuel})` );
                return;
            }

            const before = latest.currentamountFuel;
            if( fillMax )
                latest.currentamountFuel = latest.maxamountfuel;
            else if( delta != null && delta !== 0 )
                latest.currentamountFuel = Math.max( 0, Math.min( latest.maxamountfuel, latest.currentamountFuel + delta ) );
            else
                return;

            await data.save( latest );
            if( !silent )
                Log.info( `Tender fuel cheat: framecar#${frameIndex} ${before} -> ${latest.currentamountFuel} (max ${latest.maxamountfuel})` );
        }
    }

    public async applyPreset( frameIndex: number, preset: LocomotivePreset ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const frameCar = this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar )
            throw new Error( `Framecar #${frameIndex} not found.` );

        if( preset === 'operational' || preset === 'steam' ) {
            await this.fillFramecarStorage( frameIndex, true );
            if( frameCar.MyBoiler ) {
                await this.setBoilerCheats( frameIndex, {
                    maxPressure: true,
                    maxFire: true,
                    maxWaterTemp: true,
                    keep: true,
                } );
                if( preset === 'steam' )
                    await this.setBoilerCheats( frameIndex, { unlimitedSteam: true, keep: true } );
            }
        }

        if( preset === 'operational' || preset === 'diesel' ) {
            if( frameCar.Mycompressor )
                await this.setBrakeAir( frameIndex, true, true );
            if( frameCar.MyFreight )
                this.setKeepFull( 'framecar', frameIndex, 'freight', 0, true );
        }

        if( preset === 'freight_loaded' ) {
            if( frameCar.MyFreight ) {
                await this.addFramecarStorage( frameIndex, 'freight', undefined, true, true );
                this.setKeepFull( 'framecar', frameIndex, 'freight', 0, true );
            }
            Log.info( `Locomotive preset „Güter voll“ auf framecar#${frameIndex}` );
            return;
        }

        if( preset === 'operational' )
            Log.info( `Locomotive preset „Betriebsbereit“ auf framecar#${frameIndex}` );
        else if( preset === 'steam' )
            Log.info( `Locomotive preset „Dampf“ auf framecar#${frameIndex}` );
        else
            Log.info( `Locomotive preset „Diesel“ auf framecar#${frameIndex}` );
    }

    public async applyAllIndustriesKeepAll(): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        this.ensureIndustryCheatsAllowed();

        for( const key of [ ...this.keepFullTargets.keys() ] ) {
            if( this.keepFullTargets.get( key )?.owner === 'industry' )
                this.keepFullTargets.delete( key );
        }

        const count = this.plugin.world.data.industries.length;
        for( let i = 0; i < count; i++ )
            await this.applyIndustryKeepAll( i );

        Log.info( `Industry keep-all: ${count} Industrien (Immer-voll-Loops neu gesetzt)` );
    }

    private async fillFramecarStorage( frameIndex: number, enableKeepFull: boolean ): Promise<void> {
        const categories: StorageCategory[] = [
            'boiler_water',
            'boiler_fuel',
            'tender_water',
            'tender_fuel',
            'freight',
        ];

        for( const category of categories ) {
            try {
                await this.addFramecarStorage( frameIndex, category, undefined, true, true );
                if( enableKeepFull )
                    this.setKeepFull( 'framecar', frameIndex, category, 0, true );
            } catch {
                // Category not present on this car
            }
        }
    }

    public async setBoilerCheats(
        frameIndex: number,
        options: {
            maxPressure?: boolean,
            maxFire?: boolean,
            maxWaterTemp?: boolean,
            unlimitedSteam?: boolean,
            keep?: boolean,
        }
    ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const keepKey = this.frameKeepKey( frameIndex );
        const aspects = {
            pressure: options.maxPressure,
            fire: options.maxFire,
            waterTemp: options.maxWaterTemp,
        };

        await this.applyBoilerAspects( frameIndex, {
            ...aspects,
            unlimitedSteam: options.unlimitedSteam,
        }, false );

        if( options.keep === false ) {
            const existing = this.keepBoilerTargets.get( keepKey );
            if( existing ) {
                if( options.maxPressure )
                    existing.pressure = false;
                if( options.maxFire )
                    existing.fire = false;
                if( options.maxWaterTemp )
                    existing.waterTemp = false;
                if( options.unlimitedSteam === false )
                    existing.unlimitedSteam = false;

                if( !existing.pressure && !existing.fire && !existing.waterTemp && !existing.unlimitedSteam )
                    this.keepBoilerTargets.delete( keepKey );
            }
            return;
        }

        if( options.keep ) {
            const meta = this.captureFrameKeepMeta( frameIndex );
            const existing = this.keepBoilerTargets.get( keepKey );
            this.keepBoilerTargets.set( keepKey, {
                ...meta,
                pressure: options.maxPressure || existing?.pressure,
                fire: options.maxFire || existing?.fire,
                waterTemp: options.maxWaterTemp || existing?.waterTemp,
                unlimitedSteam: options.unlimitedSteam ?? existing?.unlimitedSteam,
            } );
        }
    }

    private async applyBoilerAspects(
        frameIndex: number,
        aspects: {
            pressure?: boolean,
            fire?: boolean,
            waterTemp?: boolean,
            unlimitedSteam?: boolean,
        },
        silent?: boolean,
        frameCar?: Structs.Aframecar
    ): Promise<void> {
        frameCar = frameCar ?? this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar?.MyBoiler )
            throw new Error( 'This locomotive has no boiler.' );

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const boiler = await data.query( this.boilerOpsQuery, frameCar.MyBoiler );
        if( !boiler )
            throw new Error( 'Could not read boiler from game memory.' );

        if( aspects.pressure )
            boiler.currentboilerpressure = boiler.maxboilerpressure;
        if( aspects.fire )
            boiler.currentfiretemperature = boiler.maxfiretemperature;
        if( aspects.waterTemp )
            boiler.currentwatertemperature = boiler.maxwatertemperature;
        if( aspects.unlimitedSteam != null )
            boiler.bhasunlimitedsteam = aspects.unlimitedSteam;

        await data.save( boiler );

        if( !silent )
            Log.info(
                `Boiler cheat: framecar#${frameIndex} pressure=${aspects.pressure} fire=${aspects.fire} `
                + `temp=${aspects.waterTemp} unlimited=${aspects.unlimitedSteam}`
            );
    }

    public async setBrakeAir(
        frameIndex: number,
        fillMax?: boolean,
        silent?: boolean,
        frameCar?: Structs.Aframecar
    ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        frameCar = frameCar ?? this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar?.Mycompressor )
            throw new Error( 'This locomotive has no compressor (air brakes).' );

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const compressor = await data.query( this.compressorQuery, frameCar.Mycompressor );
        if( !compressor )
            throw new Error( 'Could not read compressor from game memory.' );

        if( fillMax )
            compressor.currentairpressure = compressor.maxairpressure;

        await data.save( compressor );

        if( !silent )
            Log.info( `Brake air cheat: framecar#${frameIndex} -> ${compressor.currentairpressure}` );
    }

    public setBrakeAirKeep( frameIndex: number, enabled: boolean ): void {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const keepKey = this.frameKeepKey( frameIndex );

        if( enabled ) {
            this.keepBrakeAirTargets.set( keepKey, this.captureFrameKeepMeta( frameIndex ) );
            void this.setBrakeAir( frameIndex, true );
        } else {
            this.keepBrakeAirTargets.delete( keepKey );
        }
    }

    public async resetLocomotiveMaxSpeed( frameIndex: number ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const frameCar = this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar )
            throw new Error( `Framecar #${frameIndex} not found.` );

        const keepKey = this.frameKeepKey( frameIndex, frameCar );
        const boost = this.speedBoostTargets.get( keepKey );
        this.speedBoostTargets.delete( keepKey );

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const latest = await data.query( this.framecarSpeedQuery, frameCar );
        if( !latest )
            throw new Error( 'Could not read locomotive speed from game memory.' );

        const typical = this.inferTypicalMaxSpeedMs( frameIndex );
        const before = latest.maxspeedms;
        const storedBase = boost?.baseMax;
        let restore = this.resolveBaselineMaxSpeedMs( frameIndex, before, storedBase );

        if( this.isLikelyBoostedMaxSpeed( before ) || before < restore )
            latest.maxspeedms = restore;
        else if( before > restore * 1.15 )
            latest.maxspeedms = restore;
        else {
            Log.info( `Speed reset: framecar#${frameIndex} unverändert bei ${before} m/s (Ziel ${restore})` );
            return;
        }

        await data.save( latest );
        Log.info( `Speed reset: framecar#${frameIndex} ${before} -> ${latest.maxspeedms} m/s (Referenz ${restore})` );
    }

    public async setSpeedBoost( frameIndex: number, enabled: boolean, multiplier = 2 ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        const frameCar = this.plugin.world.data.frameCars[ frameIndex ];
        if( !frameCar )
            throw new Error( `Framecar #${frameIndex} not found.` );

        const keepKey = this.frameKeepKey( frameIndex, frameCar );

        if( !enabled ) {
            const boost = this.speedBoostTargets.get( keepKey );
            if( boost ) {
                const data = this.plugin.controller.getAction( Actions.QUERY );
                const latest = await data.query( this.framecarSpeedQuery, frameCar );
                if( latest ) {
                    const restore = this.resolveBaselineMaxSpeedMs(
                        frameIndex,
                        latest.maxspeedms,
                        boost.baseMax
                    );
                    latest.maxspeedms = restore;
                    await data.save( latest );
                    Log.info( `Speed boost off: framecar#${frameIndex} -> ${restore} m/s` );
                }
            } else {
                Log.info( `Speed boost off: framecar#${frameIndex}` );
            }
            this.speedBoostTargets.delete( keepKey );
            return;
        }

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const latest = await data.query( this.framecarSpeedQuery, frameCar );
        if( !latest )
            throw new Error( 'Could not read locomotive speed from game memory.' );

        const existing = this.speedBoostTargets.get( keepKey );
        const live = latest.maxspeedms;
        const baseMax = this.resolveBaselineMaxSpeedMs( frameIndex, live, existing?.baseMax );

        if( baseMax < 20 ) {
            Log.warn(
                `Speed boost abgebrochen: framecar#${frameIndex} maxspeedms=${live} wirkt zu niedrig `
                + `(Referenz: ${this.inferTypicalMaxSpeedMs( frameIndex )} m/s). Bitte „Geschwindigkeit zurücksetzen“ nutzen.`
            );
            return;
        }

        this.speedBoostTargets.set( keepKey, {
            ...this.captureFrameKeepMeta( frameIndex ),
            baseMax,
            multiplier,
        } );
        latest.maxspeedms = Math.round( baseMax * multiplier );
        await data.save( latest );
        Log.info( `Speed boost ${multiplier}x: framecar#${frameIndex} Basis ${baseMax} -> ${latest.maxspeedms} m/s (live war ${live})` );
    }

    /** Alle Industrie-Lager-Slots dauerhaft voll halten. */
    public async applyIndustryKeepAll( industryIndex: number ): Promise<void> {
        if( !this.settings.get( 'features.cheats' ) )
            return;

        this.ensureIndustryCheatsAllowed();

        const resolved = this.resolveIndustryStruct( industryIndex );
        if( !resolved )
            throw new Error( `Industry #${industryIndex} not found.` );

        const { industry, index } = resolved;
        const slotDefs: { category: StorageCategory, index: number }[] = [
            { category: 'educt', index: 0 },
            { category: 'educt', index: 1 },
            { category: 'educt', index: 2 },
            { category: 'educt', index: 3 },
            { category: 'product', index: 0 },
            { category: 'product', index: 1 },
            { category: 'product', index: 2 },
            { category: 'product', index: 3 },
        ];

        let active = 0;
        for( const { category, index: slotIndex } of slotDefs ) {
            const storage = this.getIndustryStorageSlot( industry, category, slotIndex );
            if( !storage || storage.maxitems <= 0 )
                continue;

            this.setKeepFull( 'industry', index, category, slotIndex, true );
            await this.addStorage( 'industry', index, category, slotIndex, undefined, true, true );
            active++;
        }

        const label = this.getIndustryName( industry ) ?? `#${index}`;
        Log.info( `Industry keep-all: ${label} (${active} Slots)` );
    }
}