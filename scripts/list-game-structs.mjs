/**
 * List UObject names from game memory (filter: Spline, Frame, Industry).
 * Close RROx first. Game must be running.
 */
import net from 'net';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const filter = ( process.argv[ 2 ] || 'Spline' ).toLowerCase();
const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const require = createRequire( import.meta.url );
const injector = require( path.join( __dirname, '../_release/resources/app/.webpack/main/native_modules/build/Release/injector.node' ) );
const dllPath = path.join( __dirname, '../packages/dll/x64/Release/RROxDLL.dll' );

const MessageType = { LOG: 1, GET_STRUCT_LIST: 3, READY: 4 };
let ready = false;

function writeMessage( socket, body ) {
    const size = Buffer.alloc( 8 );
    size.writeBigUInt64LE( BigInt( body.length ) );
    socket.write( Buffer.concat( [ size, body ] ) );
}

function readString( buf, pos ) {
    const len = Number( buf.readBigUInt64LE( pos ) );
    const start = pos + 8;
    return { value: buf.subarray( start, start + len ).toString( 'utf8' ), next: start + len };
}

const server = net.createServer( ( socket ) => {
    const chunks = [];
    socket.on( 'data', ( data ) => {
        chunks.push( data );
        let buf = Buffer.concat( chunks );
        while ( buf.length >= 8 ) {
            const size = Number( buf.readBigUInt64LE( 0 ) );
            if ( buf.length < 8 + size ) break;
            const body = Buffer.from( buf.subarray( 8, 8 + size ) );
            buf = buf.subarray( 8 + size );
            chunks.length = 0;
            if ( buf.length ) chunks.push( buf );

            const type = body.readUInt16LE( 0 );
            if ( type === MessageType.LOG ) {
                const text = readString( body, 4 ).value;
                if ( text ) console.log( `[dll] ${text}` );
                continue;
            }
            if ( type === MessageType.READY ) {
                ready = true;
                const req = Buffer.concat( [
                    ( () => { const b = Buffer.alloc( 2 ); b.writeUInt16LE( MessageType.GET_STRUCT_LIST ); return b; } )(),
                    ( () => { const b = Buffer.alloc( 2 ); b.writeUInt16LE( 1 ); return b; } )(),
                ] );
                writeMessage( socket, req );
                continue;
            }
            if ( type === MessageType.GET_STRUCT_LIST ) {
                let p = 4;
                const count = body.readUInt32LE( p );
                p += 4;
                const matches = [];
                for ( let i = 0; i < count; i++ ) {
                    const r = readString( body, p );
                    p = r.next;
                    if ( r.value.toLowerCase().includes( filter ) )
                        matches.push( r.value );
                }
                matches.sort();
                console.log( `\n${matches.length} names containing "${filter}":\n` );
                for ( const n of matches )
                    console.log( n );
                socket.destroy();
                server.close();
                process.exit( 0 );
            }
        }
        if ( buf.length ) chunks.push( buf );
    } );
} );

server.listen( '\\\\.\\pipe\\RRO', () => {
    if ( !injector.isProcessRunning( 'arr-Win64-Shipping.exe' ) ) {
        console.error( 'Game not running.' );
        process.exit( 1 );
    }
    console.log( `[inject] filtering UObject names for: ${filter}` );
    injector.inject( 'arr-Win64-Shipping.exe', dllPath );
} );

setTimeout( () => { console.error( 'Timeout' ); process.exit( 1 ); }, 120000 );
