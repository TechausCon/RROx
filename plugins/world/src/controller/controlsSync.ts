import { Actions } from "@rrox/api";
import WorldPlugin from ".";
import { FrameCarControl, getCoupledFrames, isEngine } from "../shared";
import { Structs } from "./structs/types";

export class ControlsSynchronizer {
    public synchronizedEngines: Structs.Aframecar[] = [];

    private interval: NodeJS.Timeout | undefined;

    constructor( private plugin: WorldPlugin ) {}

    public start() {
        this.stop();

        const data = this.plugin.controller.getAction( Actions.QUERY );

        this.interval = setInterval( async () => {
            const engines = [ ...this.synchronizedEngines ];
            const ignoredFrames: number[] = [];
            const world = this.plugin.world.valueProvider.getValue();
            if( !world )
                return;

            for( const engine of engines ) {
                if( !this.synchronizedEngines.some( ( e ) => data.equals( e, engine ) ) )
                    continue;

                const index = this.plugin.world.data.frameCars.findIndex( ( fc ) => data.equals( fc, engine ) );
                if( index < 0 || ignoredFrames.includes( index ) )
                    continue;

                const frame = world.frameCars[ index ];
                const coupledFrames = getCoupledFrames( frame, index, world.frameCars );
                let demotedSelf = false;

                for( const coupled of coupledFrames ) {
                    if( !isEngine( coupled.frame ) || coupled.index === index || !coupled.isCoupled )
                        continue;

                    const gameObj = this.plugin.world.data.frameCars[ coupled.index ];
                    const coupledIsMaster = this.synchronizedEngines.some( ( e ) => data.equals( e, gameObj ) );

                    if( coupled.frame.syncedControls && coupledIsMaster ) {
                        // Only one master per consist — lower frame index wins.
                        if( coupled.index < index ) {
                            this.removeEngine( engine );
                            ignoredFrames.push( index );
                            demotedSelf = true;
                            break;
                        }

                        this.removeEngine( gameObj );
                        ignoredFrames.push( coupled.index );
                    }

                    if( demotedSelf )
                        break;

                    if( frame.controls.regulator === undefined || frame.controls.reverser === undefined )
                        continue;

                    const regulator = frame.controls.regulator;
                    const reverser = coupled.flipped ? frame.controls.reverser * -1 : frame.controls.reverser;
                    const brake = frame.controls.brake;

                    if( coupled.frame.controls.regulator !== undefined && Math.abs( regulator - coupled.frame.controls.regulator ) > 0.005 )
                        await this.plugin.world.setControls( gameObj, FrameCarControl.Regulator, regulator );
                    if( coupled.frame.controls.reverser !== undefined && Math.abs( reverser - coupled.frame.controls.reverser ) > 0.005 )
                        await this.plugin.world.setControls( gameObj, FrameCarControl.Reverser, reverser );
                    if( coupled.frame.controls.brake !== undefined && Math.abs( brake - coupled.frame.controls.brake ) > 0.005 )
                        await this.plugin.world.setControls( gameObj, FrameCarControl.Brake, brake );
                }
            }
        }, 500 );
    }

    public stop() {
        if( this.interval !== undefined ) {
            clearInterval( this.interval );
            this.interval = undefined;
        }
    }

    public addEngine( engine: Structs.Aframecar ) {
        const data = this.plugin.controller.getAction( Actions.QUERY );

        if( this.synchronizedEngines.some( ( e ) => data.equals( e, engine ) ) )
            return;
        this.synchronizedEngines.push( engine );
    }

    public removeEngine( engine: Structs.Aframecar ) {
        const data = this.plugin.controller.getAction( Actions.QUERY );

        this.synchronizedEngines = this.synchronizedEngines.filter( ( e ) => !data.equals( e, engine ) );
    }
}
