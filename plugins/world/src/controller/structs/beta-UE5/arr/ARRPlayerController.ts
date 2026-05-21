import { Property, Struct, StructInfo } from "@rrox/api";
import { APlayerController } from "../Engine/PlayerController";
import { Aindustry } from "./industry";

/** Verified via research-dump-struct.ps1 (2026-05-21). */
@Struct( "Class arr.ARRPlayerController" )
export class AARRPlayerController extends APlayerController {

    constructor( struct: StructInfo<AARRPlayerController> ) {
        super( struct );
        struct.apply( this );
    }

    @Property.Str( "PlayerName" )
    public PlayerName: string;

    @Property.Function( "Function arr.ARRPlayerController.ServerUpdateGameStateIndustryArrays", [] )
    public ServerUpdateGameStateIndustryArrays: () => Promise<void>;

    @Property.Function(
        "Function arr.ARRPlayerController.ServerUpdateGameStateData",
        [ [ () => AARRPlayerController ] ]
    )
    public ServerUpdateGameStateData: ( playerController: AARRPlayerController ) => Promise<void>;

    @Property.Function( "Function arr.ARRPlayerController.ServerUpdateIndustryArrays", [ [ () => Aindustry ] ] )
    public ServerUpdateIndustryArrays: ( industry: Aindustry ) => Promise<void>;

}