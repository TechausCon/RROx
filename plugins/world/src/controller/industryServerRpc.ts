import { Actions, IQuery, StructConstructor } from "@rrox/api";
import WorldPlugin from ".";
import { Log, StorageCategory, IndustryRpcFocusTestEntry } from "../shared";
import { Cheats } from "./cheats";
import * as BetaStructs from "./structs/beta-UE5";
import { EUnloadSide } from "./structs/beta-UE5/arr/eunloadside";
import { Structs } from "./structs/types";

type RpcAttempt = {
    label: string,
    run: () => Promise<void>,
};

export type IndustryRpcResearchResult = {
    baseline: float,
    finalAmount: float,
    attempts: { label: string, ok: boolean, amountAfter: float, error?: string }[],
    hudLikelyChanged: boolean,
};

/**
 * MP client research: try verified game Server RPCs for industry storage fill.
 * Signatures from docs/research/dump-*.txt (2026-05-21).
 */
export class IndustryServerRpcResearch {

    private storageAmountQuery: IQuery<Structs.Astorage>;

    constructor(
        private plugin: WorldPlugin,
        private cheats: Cheats
    ) {}

    public async prepare( storageAmountQuery?: IQuery<Structs.Astorage> ): Promise<void> {
        if( storageAmountQuery ) {
            this.storageAmountQuery = storageAmountQuery;
            return;
        }

        const data = this.plugin.controller.getAction( Actions.QUERY );
        this.storageAmountQuery = await data.prepareQuery(
            this.plugin.world.structs.arr.Astorage as StructConstructor<Structs.Astorage>,
            ( storage ) => [ storage.currentamountitems, storage.maxitems ]
        );
    }

    public async tryFillIndustryStorage(
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ): Promise<IndustryRpcResearchResult> {
        const storage = this.cheats.getIndustryStorageForCheat( industryIndex, category, slotIndex );
        if( !storage )
            throw new Error(
                `Kein Lager-Slot (Industrie #${industryIndex}, `
                + `${category === 'educt' ? 'Input' : 'Output'} Slot ${slotIndex + 1}). `
                + 'Nur vorhandene Slots nutzen — am Smelter z. B. Input Slot 1.'
            );

        const character = await this.plugin.world.getCharacter();
        if( !character )
            throw new Error( 'Spieler-Character nicht gefunden (im Spiel + attach nötig).' );

        const betaCharacter = character as unknown as BetaStructs.arr.ASCharacter;
        const betaStorage = storage as BetaStructs.arr.Astorage;
        const industry = this.plugin.world.data.industries[ industryIndex ] as BetaStructs.arr.Aindustry | undefined;

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const baselineState = await data.query( this.storageAmountQuery, storage );
        if( !baselineState || baselineState.maxitems <= 0 )
            throw new Error( 'Storage hat keine Kapazität.' );

        const baseline = baselineState.currentamountitems;
        const fillAmount = Math.round( baselineState.maxitems - baseline );
        const intFill = fillAmount > 0 ? fillAmount : Math.round( baselineState.maxitems );
        const playerName = this.resolvePlayerName();

        const attempts = this.buildAttempts( {
            character: betaCharacter,
            storage: betaStorage,
            industry,
            intFill,
            maxItems: Math.round( baselineState.maxitems ),
            playerName,
        } );

        const results: IndustryRpcResearchResult[ 'attempts' ] = [];

        for( const attempt of attempts ) {
            const before = await this.readStorageAmount( storage );
            try {
                await attempt.run();
                await this.sleep( 250 );
                const after = await this.readStorageAmount( storage );
                const ok = after > before + 0.5;
                results.push( { label: attempt.label, ok, amountAfter: after } );
                Log.info(
                    `Industry RPC research: ${attempt.label} `
                    + `${ok ? 'CHANGED' : 'no change'} `
                    + `(${before} -> ${after}, industry#${industryIndex} ${category}[${slotIndex}])`
                );
            } catch( err ) {
                const message = err instanceof Error ? err.message : String( err );
                results.push( {
                    label: attempt.label,
                    ok: false,
                    amountAfter: before,
                    error: message,
                } );
                Log.warn( `Industry RPC research: ${attempt.label} failed: ${message}` );
            }
        }

        const finalAmount = await this.readStorageAmount( storage );
        const hudLikelyChanged = finalAmount > baseline + 0.5;
        const summary: IndustryRpcResearchResult = {
            baseline,
            finalAmount,
            attempts: results,
            hudLikelyChanged,
        };

        if( hudLikelyChanged )
            Log.info( `Industry RPC research: memory amount rose ${baseline} -> ${finalAmount} — Spiel-HUD prüfen!` );
        else
            Log.warn( `Industry RPC research: no memory increase (${baseline} -> ${finalAmount}). Host-only vermutlich nötig.` );

        return summary;
    }

    public async runFocusTests(
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ) {
        const storage = this.cheats.getIndustryStorageForCheat( industryIndex, category, slotIndex );
        if( !storage )
            throw new Error( `Kein Lager-Slot (Industrie #${industryIndex}, ${category}[${slotIndex}]).` );

        const character = await this.plugin.world.getCharacter();
        if( !character )
            throw new Error( 'Spieler-Character nicht gefunden.' );

        const betaCharacter = character as unknown as BetaStructs.arr.ASCharacter;
        const betaStorage = storage as BetaStructs.arr.Astorage;
        const industry = this.plugin.world.data.industries[ industryIndex ] as BetaStructs.arr.Aindustry | undefined;

        const data = this.plugin.controller.getAction( Actions.QUERY );
        const state = await data.query( this.storageAmountQuery, storage );
        if( !state || state.maxitems <= 0 )
            throw new Error( 'Storage hat keine Kapazität.' );

        const label = `${category}[${slotIndex}]`;
        const entries: IndustryRpcFocusTestEntry[] = [];

        Log.info( `Industry RPC focus: start ${label} industry#${industryIndex} (${state.currentamountitems}/${state.maxitems})` );

        // Test 1: Controller-Sync (ohne RemoveFreight)
        const syncBaseline = state.currentamountitems;
        try {
            const controller = await this.plugin.world.getLocalPlayerController();
            if( !controller ) {
                entries.push( {
                    test: 'controller-sync',
                    baseline: syncBaseline,
                    finalAmount: syncBaseline,
                    memoryChanged: false,
                    ok: false,
                    detail: 'ARRPlayerController nicht gefunden',
                } );
                Log.warn( 'Industry RPC focus: controller-sync — kein ARRPlayerController' );
            } else {
                const controllerName = ( controller as BetaStructs.arr.AARRPlayerController ).PlayerName ?? '?';
                await controller.ServerUpdateGameStateIndustryArrays();
                await this.sleep( 350 );
                await controller.ServerUpdateGameStateData( controller as BetaStructs.arr.AARRPlayerController );
                await this.sleep( 350 );
                if( industry && controller.ServerUpdateIndustryArrays ) {
                    try {
                        await controller.ServerUpdateIndustryArrays( industry );
                        await this.sleep( 350 );
                    } catch( err ) {
                        Log.warn( `Industry RPC focus: ServerUpdateIndustryArrays: ${err instanceof Error ? err.message : String( err )}` );
                    }
                }
                const syncFinal = await this.readStorageAmount( storage );
                const memoryChanged = syncFinal > syncBaseline + 0.5;
                entries.push( {
                    test: 'controller-sync',
                    baseline: syncBaseline,
                    finalAmount: syncFinal,
                    memoryChanged,
                    ok: memoryChanged,
                    detail: `Controller „${controllerName}“ → GameState/Industry Sync`,
                } );
                Log.info(
                    `Industry RPC focus: controller-sync ${memoryChanged ? 'CHANGED' : 'no change'} `
                    + `(${syncBaseline} -> ${syncFinal}, controller=${controllerName}) — Spiel-HUD prüfen!`
                );
            }
        } catch( err ) {
            const message = err instanceof Error ? err.message : String( err );
            entries.push( {
                test: 'controller-sync',
                baseline: syncBaseline,
                finalAmount: syncBaseline,
                memoryChanged: false,
                ok: false,
                detail: 'Controller-Sync fehlgeschlagen',
                error: message,
            } );
            Log.warn( `Industry RPC focus: controller-sync failed: ${message}` );
        }

        // Test 2: nur ServerRemoveFreight (kein UseFreight/Toggle)
        const rfState = await data.query( this.storageAmountQuery, storage );
        const rfBaseline = rfState?.currentamountitems ?? 0;
        const intFill = Math.round( ( rfState?.maxitems ?? 0 ) - rfBaseline );
        const fill = intFill > 0 ? intFill : Math.round( rfState?.maxitems ?? 0 );
        try {
            if( fill <= 0 )
                throw new Error( 'Slot schon voll.' );

            await betaCharacter.ServerRemoveFreight( betaStorage, -fill as int32 );
            await this.sleep( 600 );
            const rfFinal = await this.readStorageAmount( storage );
            const memoryChanged = rfFinal > rfBaseline + 0.5;
            entries.push( {
                test: 'remove-freight-only',
                baseline: rfBaseline,
                finalAmount: rfFinal,
                memoryChanged,
                ok: memoryChanged,
                detail: `Nur ServerRemoveFreight(-${fill})`,
            } );
            Log.info(
                `Industry RPC focus: remove-freight-only ${memoryChanged ? 'CHANGED' : 'no change'} `
                + `(${rfBaseline} -> ${rfFinal}) — Spiel-HUD prüfen!`
            );
        } catch( err ) {
            const message = err instanceof Error ? err.message : String( err );
            entries.push( {
                test: 'remove-freight-only',
                baseline: rfBaseline,
                finalAmount: rfBaseline,
                memoryChanged: false,
                ok: false,
                detail: 'ServerRemoveFreight fehlgeschlagen',
                error: message,
            } );
            Log.warn( `Industry RPC focus: remove-freight-only failed: ${message}` );
        }

        Log.info( `Industry RPC focus: done ${label} — ${entries.filter( ( e ) => e.memoryChanged ).length}/2 memory, HUD entscheidet.` );

        return {
            industryIndex,
            category,
            slotIndex,
            label,
            entries,
        };
    }

    private buildAttempts( ctx: {
        character: BetaStructs.arr.ASCharacter,
        storage: BetaStructs.arr.Astorage,
        industry?: BetaStructs.arr.Aindustry,
        intFill: number,
        maxItems: number,
        playerName: string,
    } ): RpcAttempt[] {
        const { character, storage, industry, intFill, maxItems, playerName } = ctx;
        const freight = this.findFreightCandidate();

        const attempts: RpcAttempt[] = [
            {
                label: `ServerRemoveFreight(-${intFill})`,
                run: () => character.ServerRemoveFreight( storage, -intFill as int32 ),
            },
            {
                label: `ServerRemoveFreight(-${maxItems})`,
                run: () => character.ServerRemoveFreight( storage, -maxItems as int32 ),
            },
            {
                label: 'ServerToggleFreightLoading(storage)',
                run: () => character.ServerToggleFreightLoading( storage ),
            },
        ];

        if( industry ) {
            attempts.push( {
                label: 'ServerToggleFreightLoading(industry)',
                run: () => character.ServerToggleFreightLoading( industry ),
            } );
        }

        const crane = storage.Mycrane1 ?? storage.Mycrane2 ?? storage.Mycrane3;
        if( crane ) {
            attempts.push( {
                label: 'ServerUseCrane',
                run: () => character.ServerUseCrane( crane ),
            } );
        }

        attempts.push( {
            label: `Storage.AddFreight(${intFill})`,
            run: () => storage.AddFreight( intFill as int32 ),
        } );

        attempts.push( {
            label: 'ServerUpdateGameStateIndustryArrays',
            run: async () => {
                const controller = await this.plugin.world.getLocalPlayerController();
                if( !controller )
                    throw new Error( 'ARRPlayerController nicht gefunden.' );
                await controller.ServerUpdateGameStateIndustryArrays();
            },
        } );

        if( freight ) {
            attempts.push( {
                label: 'ServerUseFreight(left)',
                run: () => character.ServerUseFreight( freight, EUnloadSide.Left, playerName ),
            } );
            attempts.push( {
                label: 'ServerUseFreight(right)',
                run: () => character.ServerUseFreight( freight, EUnloadSide.Right, playerName ),
            } );
        }

        return attempts;
    }

    private findFreightCandidate(): BetaStructs.arr.AFreight | undefined {
        for( const car of this.plugin.world.data.frameCars ) {
            const freight = ( car as BetaStructs.arr.Aframecar ).MyFreight;
            if( freight && freight.currentfreight > 0 )
                return freight as BetaStructs.arr.AFreight;
        }
        return undefined;
    }

    private resolvePlayerName(): string {
        for( const player of this.plugin.world.data.players ) {
            if( player.PlayerNamePrivate )
                return player.PlayerNamePrivate;
        }
        return 'Player';
    }

    private async readStorageAmount( storage: Structs.Astorage ): Promise<float> {
        const data = this.plugin.controller.getAction( Actions.QUERY );
        const latest = await data.query( this.storageAmountQuery, storage );
        return latest?.currentamountitems ?? 0;
    }

    private sleep( ms: number ): Promise<void> {
        return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
    }

}
