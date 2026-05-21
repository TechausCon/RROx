import { Avatar, Button, List } from 'antd';
import { ControlOutlined, AimOutlined } from '@ant-design/icons';
import React from 'react';
import { FrameDefinitions } from '../map/definitions';
import { FrameCarType, IFrameCar } from '@rrox-plugins/world/shared';
import { formatGameDistance } from '../map/utils/distance';

export function FramesList( {
    data,
    onOpenControls,
    onLocate,
    showDistance = false,
}: {
    data: { index: number, frame: IFrameCar, distance?: number }[] | undefined,
    onOpenControls: ( index: number ) => void,
    onLocate: ( index: number ) => void,
    showDistance?: boolean,
} ) {
    return <List
        itemLayout="horizontal"
        dataSource={data ?? []}
        renderItem={( { frame, index, distance } ) => {
            const definition = FrameDefinitions[ frame.type ] ?? FrameDefinitions[ FrameCarType.UNKNOWN ];
            if( !definition )
                return null;

            let actions = [];
            if ( definition.engine )
                actions.push( <Button
                    title="Open controls in new window"
                    icon={<ControlOutlined />}
                    onClick={() => onOpenControls( index )}
                    size='large'
                /> );
            actions.push( <Button
                title="Locate on the map"
                icon={<AimOutlined />}
                onClick={() => onLocate( index )}
                size='large'
            /> );

            return <List.Item
                actions={actions}
                className={'frame-list-item'}
            >
                <List.Item.Meta
                    avatar={<Avatar shape='square' className='dark-mode-invert' src={definition.image} size={100} style={{ marginTop: -25 }} />}
                    title={<>
                        {`${frame.name.toUpperCase()}${frame.name && frame.number ? ' - ' : ''}${frame.number.toUpperCase() || ''}`}
                        {showDistance && typeof distance === 'number' && (
                            <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
                                {formatGameDistance( distance )}
                            </span>
                        )}
                    </>}
                    description={definition.engine && frame.boiler ? <table>
                        <thead>
                            <tr>
                                <th style={{ width: '30%' }}>Boiler Pressure</th>
                                <th style={{ width: '30%' }}>Fuel Amount</th>
                                <th style={{ width: '20%' }}>Fire Temp.</th>
                                <th style={{ width: '20%' }}>Water Temp.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ textAlign: 'center', color: frame.boiler!.pressure < 80 ? "red" : "" }} className={frame.boiler!.pressure < 80 ? "dnt" : ""}>{frame.boiler!.pressure.toFixed( 0 )}</td>
                                <td style={{ textAlign: 'center', color: frame.boiler!.fuel < 10 ? "red" : "" }} className={frame.boiler!.fuel < 10 ? "dnt" : ""}>{frame.boiler!.fuel.toFixed( 0 )}</td>
                                <td style={{ textAlign: 'center', color: frame.boiler!.fireTemperature < 100 ? "red" : "" }} className={frame.boiler!.fireTemperature < 100 ? "dnt" : ""}>{frame.boiler!.fireTemperature.toFixed( 0 )}</td>
                                <td style={{ textAlign: 'center', color: frame.boiler!.waterTemperature < 100 ? "red" : "" }} className={frame.boiler!.waterTemperature < 100 ? "dnt" : ""}>{frame.boiler!.waterTemperature.toFixed( 0 )}</td>
                            </tr>
                        </tbody>
                    </table> : null
                    }
                />
            </List.Item>;
        }}
    />;
}