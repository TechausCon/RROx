import { Property, Struct, StructInfo } from "@rrox/api";
import { APawn } from "./Pawn";
import { AController } from "./Controller";

@Struct( "Class Engine.PlayerController" )
export class APlayerController extends AController {

    constructor( struct: StructInfo<APlayerController> ) {
        super( struct );
        struct.apply( this );
    }

    @Property.Object( "AcknowledgedPawn", () => APawn )
    public AcknowledgedPawn: APawn;

}
