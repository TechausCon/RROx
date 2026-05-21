import { Property, Struct, StructInfo } from "@rrox/api";
import { FVector_NetQuantize } from "../CoreUObject/FVector_NetQuantize";
import { AActor } from "../Engine/Actor";

/** Non-deprecated spline actor class (UE5 builds after SplineActorDeprecated). */
@Struct( "Class arr.SplineActor" )
export class ASplineActorLive extends AActor {

    constructor( struct: StructInfo<ASplineActorLive> ) {
        super( struct );
        struct.apply( this );
    }

    @Property.Int( "SplineType" )
    public SplineType: int32;

    @Property.Array( "SplineControlPoints", [ () => FVector_NetQuantize ] )
    public SplineControlPoints: Array<FVector_NetQuantize>;

    @Property.Array( "SplineMeshBoolArray", [] )
    public SplineMeshBoolArray: Array<boolean>;

}
