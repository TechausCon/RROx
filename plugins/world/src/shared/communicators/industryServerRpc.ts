import { SharedCommunicator } from "@rrox/api";
import { ProductType } from "../world";
import { StorageCategory } from "./storage";

export function formatIndustryStorageSlotLabel(
    category: StorageCategory,
    slotIndex: number,
    types: ProductType[]
): string {
    const direction = category === 'educt' ? 'Input' : 'Output';
    const goods = types.length > 0 ? types.join( ', ' ) : '?';
    return `${direction}[${slotIndex}] ${goods}`;
}

export type IndustryRpcResearchSummary = {
    baseline: number,
    finalAmount: number,
    hudLikelyChanged: boolean,
    attempts: {
        label: string,
        ok: boolean,
        amountAfter: number,
        error?: string,
    }[],
};

export type IndustryStorageSlotProbe = {
    category: StorageCategory,
    slotIndex: number,
    currentAmount: number,
    maxAmount: number,
    types: ProductType[],
    label: string,
};

export type IndustryRpcAutotestSlotResult = {
    category: StorageCategory,
    slotIndex: number,
    types: ProductType[],
    label: string,
    baseline: number,
    finalAmount: number,
    memoryChanged: boolean,
    bestRpc?: string,
    attempts: IndustryRpcResearchSummary[ 'attempts' ],
};

export type IndustryRpcFocusTestEntry = {
    test: 'controller-sync' | 'remove-freight-only',
    baseline: number,
    finalAmount: number,
    memoryChanged: boolean,
    ok: boolean,
    detail: string,
    error?: string,
};

export type IndustryRpcFocusTestResult = {
    industryIndex: number,
    category: StorageCategory,
    slotIndex: number,
    label: string,
    entries: IndustryRpcFocusTestEntry[],
};

export type IndustryRpcAutotestResult = {
    industryIndex: number,
    slots: IndustryRpcAutotestSlotResult[],
    anyMemoryChanged: boolean,
};

/** Welche Input/Output-Slots im Spiel-Speicher existieren (MP-Client). */
export const ProbeIndustryStorageSlots = SharedCommunicator<{
    rpc: ( industryIndex: number ) => IndustryStorageSlotProbe[],
}>( PluginInfo, 'ProbeIndustryStorageSlots' );

/** Experimental: try verified Server RPCs for MP client industry fill research. */
export const TryIndustryServerRpcFill = SharedCommunicator<{
    rpc: (
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ) => IndustryRpcResearchSummary,
}>( PluginInfo, 'TryIndustryServerRpcFill' );

/** Alle vorhandenen Slots nacheinander mit RPC-Forschung testen (Log: Industry RPC autotest). */
export const AutotestIndustryServerRpc = SharedCommunicator<{
    rpc: ( industryIndex: number ) => IndustryRpcAutotestResult,
}>( PluginInfo, 'AutotestIndustryServerRpc' );

/** Zwei letzte Hoffnungstests: Controller-Sync + isoliert ServerRemoveFreight (Log: Industry RPC focus). */
export const RunIndustryRpcFocusTests = SharedCommunicator<{
    rpc: (
        industryIndex: number,
        category: StorageCategory,
        slotIndex: number
    ) => IndustryRpcFocusTestResult,
}>( PluginInfo, 'RunIndustryRpcFocusTests' );
