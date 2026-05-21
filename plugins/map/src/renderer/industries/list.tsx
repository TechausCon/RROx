import { PageContent, PageLayout } from "@rrox/base-ui";
import { useWorld } from "@rrox-plugins/world/renderer";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Tabs } from "antd";
import { IndustryDefinitions } from "../map/definitions";
import { IndustryType } from "@rrox-plugins/world/shared";
import { IndustryList } from "./industries";
import { EconomyInformation } from "./economyInformation";
import { CargoPricesCapacities } from "./cargoPricesCapacities";
import { AttachHintBanner } from "../map/components";

export function IndustryListPage() {
    const navigate = useNavigate();

    const world = useWorld();

    if( !world?.industries?.length )
        return (
            <PageLayout>
                <PageContent style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 40 }}>
                    <p>Keine Industrie-Daten. Bitte zuerst <strong>Attach</strong> (Home) und Save laden.</p>
                    <p style={{ color: '#888', marginTop: 12 }}>
                        Lager-Cheats (Wasser/Kohle): Tab <strong>Map</strong> → Lok anklicken → <strong>Open Controls</strong> → unten „Lager-Cheats“.
                    </p>
                </PageContent>
            </PageLayout>
        );

    const locate = ( index: number ) => {
        navigate( '/@rrox-plugins/map/map', {
            state: {
                locate: {
                    type: 'industries',
                    index: index,
                }
            }
        } );
    }

    return (
        <PageLayout>
            <PageContent style={{ maxWidth: 1200 }}>
                <AttachHintBanner />
                <Tabs defaultActiveKey="1" style={{ margin: '0 10px' }} centered>
                    <Tabs.TabPane tab="Production Buildings" key="1" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <IndustryList
                            data={( world?.industries ?? [] ).map( ( industry, index ) => ( { industry, index } ) ).filter( ( { industry } ) => IndustryDefinitions[ industry.type ]?.productionChainBuilding )}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Fueling Buildings" key="2" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <IndustryList
                            data={( world?.industries ?? [] ).map( ( industry, index ) => ( { industry, index } ) ).filter( ( { industry } ) => IndustryDefinitions[ industry.type ]?.fuelingBuilding )}
                            onLocate={locate}
                        />
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Economy Information" key="3" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <EconomyInformation />
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Cargo Prices & Capacities" key="4" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <CargoPricesCapacities />
                    </Tabs.TabPane>
                </Tabs>
            </PageContent>
        </PageLayout>
    );
}