import { Struct, StructInfo } from "@rrox/api";
import { AActor } from "./Actor";

@Struct( "Class Engine.Controller" )
export class AController extends AActor {

    constructor( struct: StructInfo<AController> ) {
        super( struct );
        struct.apply( this );
    }

}
