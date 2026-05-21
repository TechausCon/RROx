import { PageContent, PageLayout } from "@rrox/base-ui";
import { useWorld } from "@rrox-plugins/world/renderer";
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs } from "antd";
import { FrameDefinitions } from "../map/definitions";
import { FrameCarType } from "@rrox-plugins/world/shared";
import { FramesList } from "./frames";
import { AttachHintBanner } from "../map/components";
import { usePlayerName } from "../map/hooks";
import { gameDistance } from "../map/utils/distance";

export function RollingStockListPage() {
    const navigate = useNavigate();

    const world = useWorld();
    const frameCars = world?.frameCars ?? [];
    const playerName = usePlayerName( world );
    const player = world?.players.find( ( p ) => p.name === playerName );

    const sortedByDistance = useMemo( () => {
        if( !player?.location )
            return frameCars.map( ( frame, index ) => ( { frame, index } ) );

        return frameCars
            .map( ( frame, index ) => ( {
                frame,
                index,
                distance: gameDistance( player.location, frame.location ),
            } ) )
            .sort( ( a, b ) => a.distance - b.distance );
    }, [ frameCars, player?.location ] );

    if( !frameCars.length )
        return (
            <PageLayout>
                <PageContent style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 40 }}>
                    <p>Keine Fahrzeug-Daten. Bitte zuerst <strong>Attach</strong> (Home) und Save laden.</p>
                </PageContent>
            </PageLayout>
        );

    const openControl = ( index: number ) => {
        navigate( `/@rrox-plugins/map/controls/${index}` );
    };

    const locate = ( index: number ) => {
        navigate( '/@rrox-plugins/map/map', {
            state: {
                locate: {
                    type: 'frameCars',
                    index: index,
                }
            }
        } );
    }

    return (
        <PageLayout>
            <PageContent style={{ maxWidth: 1200 }}>
                <AttachHintBanner />
                <Tabs defaultActiveKey="0" style={{ margin: '0 10px' }} centered>
                    <Tabs.TabPane tab="In der Nähe" key="0" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={sortedByDistance}
                            onOpenControls={openControl}
                            onLocate={locate}
                            showDistance
                        />
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Locomotives" key="1" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={frameCars.map( ( frame, index ) => ( { frame, index } ) ).filter( ( { frame } ) => FrameDefinitions[ frame.type ]?.engine )}
                            onOpenControls={openControl}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Freight Cars" key="2" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={frameCars.map( ( frame, index ) => ( { frame, index } ) ).filter( ( { frame } ) => FrameDefinitions[ frame.type ]?.freight )}
                            onOpenControls={openControl}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Tenders" key="3" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={frameCars.map( ( frame, index ) => ( { frame, index } ) ).filter( ( { frame } ) => FrameDefinitions[ frame.type ]?.tender )}
                            onOpenControls={openControl}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="In Bewegung" key="5" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={frameCars.map( ( frame, index ) => ( { frame, index } ) ).filter( ( { frame } ) => Math.abs( frame.speedMs ) > 50 )}
                            onOpenControls={openControl}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Cabooses &#38; Miscellaneous" key="4" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <FramesList
                            data={frameCars.map( ( frame, index ) => ( { frame, index } ) ).filter( ( { frame } ) => frame.type === FrameCarType.CABOOSE || frame.type === FrameCarType.WAYCAR || frame.type === FrameCarType.PLOW || frame.type === FrameCarType.COACH_DSPRR_1 || frame.type === FrameCarType.COACH_DSPRR_2 )}
                            onOpenControls={openControl}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                </Tabs>
            </PageContent>
        </PageLayout>
    );
}