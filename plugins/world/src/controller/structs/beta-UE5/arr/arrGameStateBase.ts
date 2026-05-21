import { InOutParam, Property, Struct, StructInfo } from "@rrox/api";
import { AGameStateBase } from "../Engine/GameStateBase";
import { Aframecar } from "./framecar";
import { Aindustry } from "./industry";
import { Asandhouse } from "./sandhouse";
import { ASplineActor } from "./SplineActor";
import { Aturntable } from "./turntable";
import { Awatertower } from "./watertower";

@Struct( "Class arr.ARRGameStateBase" )
export class AarrGameStateBase extends AGameStateBase {

    constructor( struct: StructInfo<AarrGameStateBase> ) {
        super( struct );
        struct.apply( this );
    }

    // Player id/name/location/money/xp arrays were removed from ARRGameStateBase in newer game builds.
    // Players are read via GameStateBase.PlayerArray instead.

    /**
     * An array containing:
     * Object property
     */
    @Property.Array( "SplineArray", [ () => ASplineActor ] )
    public SplineArray: Array<ASplineActor>;
    
    /**
     * An array containing:
     * Object property
     */
    @Property.Array( "IndustryArray", [ () => Aindustry ] )
    public IndustryArray: Array<Aindustry>;
    
    /**
     * An array containing:
     * Object property
     */
    @Property.Array( "FrameCarArray", [ () => Aframecar ] )
    public FrameCarArray: Array<Aframecar>;
    
}