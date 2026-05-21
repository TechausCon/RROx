import { SharedCommunicator } from "@rrox/api";
import { IStorage } from "../world";

export type StorageOwnerType = 'industry' | 'sandhouse' | 'watertower' | 'framecar';

/** Industry: `educt` / `product`. Buildings: `main`. Rolling stock: freight/tender/boiler. */
export type StorageCategory = 'educt' | 'product' | 'main' | 'freight' | 'tender_water' | 'tender_fuel' | 'boiler_water' | 'boiler_fuel';

export const storageUseCrane = SharedCommunicator<{
	rpc: ( sindustryIndex: number, storageOutputIndex: number, craneNumber: number) => void,
}>( PluginInfo, 'storageUseCrane' );

export const AddStorageCheats = SharedCommunicator<{
	rpc: (
		owner: StorageOwnerType,
		parentIndex: number,
		category: StorageCategory,
		slotIndex: number,
		delta?: number,
		fillMax?: boolean
	) => void,
}>( PluginInfo, 'AddStorageCheats' );

/** Hält Lager/Tender/Kessel dauerhaft voll (Spiel tickt Werte sonst sofort runter). */
export const SetStorageKeepFull = SharedCommunicator<{
	rpc: (
		owner: StorageOwnerType,
		parentIndex: number,
		category: StorageCategory,
		slotIndex: number,
		enabled: boolean
	) => void,
}>( PluginInfo, 'SetStorageKeepFull' );

/** Alle Input/Output-Slots einer Industrie auf Max + Immer voll. */
export const ApplyIndustryKeepAll = SharedCommunicator<{
	rpc: ( industryIndex: number ) => void,
}>( PluginInfo, 'ApplyIndustryKeepAll' );

/** Alle Industrien der Session: alle Slots Max + Immer voll. */
export const ApplyAllIndustriesKeepAll = SharedCommunicator<{
	rpc: () => void,
}>( PluginInfo, 'ApplyAllIndustriesKeepAll' );