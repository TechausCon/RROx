import React, { useEffect } from "react";
import { Alert, Form, Switch } from "antd";
import { WorldSettings } from "../../shared";
import { useSettings } from "@rrox/api";

const CHEATS_MP_HELP = <>
    <strong>Multiplayer — Host vs. Client</strong>
    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        <li><strong>Industrie-Lager</strong> (Smelter, Mine, …): nur <strong>Host</strong>. Als Client ändert sich im Spiel nichts (RPC-Forschung 2026-05-21: ergebnislos).</li>
        <li><strong>Lok / Waggon</strong> (Wasser, Kohle, Kessel, Güter am Zug, Speed, Bremsluft): als Client nutzbar — Map → Lok → Open Controls.</li>
        <li><strong>Karte, Teleport, Weichen, Krane, Lok-Steuerung</strong>: als Client nutzbar (Features + Attach).</li>
    </ul>
    <p style={{ margin: '8px 0 0' }}>
        Details: <code>docs/research/mp-client-capabilities.md</code>
    </p>
</>;

export function FeaturesSettings() {
    const [ settings, store ] = useSettings( WorldSettings );
    const [ form ] = Form.useForm();

    useEffect( () => {
        form.setFieldsValue( settings );
    }, [ settings ] );

    return <Form
        name="settings"
        layout="vertical"
        form={form}
        labelCol={{ span: 8, offset: 3 }}
        wrapperCol={{ span: 16, offset: 3 }}
        onValuesChange={( changed ) => store.setAll( changed )}
        autoComplete="off"
    >
        <Form.Item
            help={<p style={{ padding: '10px 0', marginTop: -45 }}>Enable or disable one or more RROx features.</p>}
        />
        <Form.Item
            label="Control Engines"
            name={[ 'features', 'controlEngines' ]}
            valuePropName="checked"
        >
            <Switch />
        </Form.Item>
        <Form.Item
            label="Control Switches"
            name={[ 'features', 'controlSwitches' ]}
            valuePropName="checked"
        >
            <Switch />
        </Form.Item>
        <Form.Item
            label="Teleport"
            name={[ 'features', 'teleport' ]}
            valuePropName="checked"
        >
            <Switch />
        </Form.Item>
        <Form.Item
            label="Cheats"
            name={[ 'features', 'cheats' ]}
            valuePropName="checked"
            help={settings.features.cheats ? (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="Cheats & Multiplayer"
                    description={CHEATS_MP_HELP}
                />
            ) : undefined}
        >
            <Switch />
        </Form.Item>
        {settings.features.cheats && !settings.features.experimentalIndustryServerRpc && (
            <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message="Industrie-RPC-Forschung abgeschlossen"
                description="Kein Client-Weg für Industrie-Lager gefunden. RPC-Test-Buttons in der Karte sind entfernt. Lok-/Waggon-Cheats bleiben verfügbar."
            />
        )}
		<Form.Item
            label="Control Cranes"
            name={[ 'features', 'controlCranes' ]}
            valuePropName="checked"
        >
            <Switch />
        </Form.Item>
    </Form>;
}