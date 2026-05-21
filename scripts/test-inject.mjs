/**
 * Safe attach test — run ONLY while arr-Win64-Shipping.exe is in the main menu.
 * Close RROx / other tools using \\.\pipe\RRO before running.
 *
 *   $env:ELECTRON_RUN_AS_NODE=1
 *   & "...\node_modules\electron\dist\electron.exe" scripts\test-inject.mjs
 */
import net from 'net';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const require = createRequire( import.meta.url );

const injector = require( path.join( __dirname, '../_release/resources/app/.webpack/main/native_modules/build/Release/injector.node' ) );
const dllPath = path.join( __dirname, '../packages/dll/x64/Release/RROxDLL.dll' );
const processName = 'arr-Win64-Shipping.exe';

function readLengthPrefixedString( body, offset = 4 ) {
    if ( body.length < offset + 8 )
        return null;
    const len = Number( body.readBigUInt64LE( offset ) );
    if ( body.length < offset + 8 + len )
        return null;
    return body.subarray( offset + 8, offset + 8 + len ).toString( 'utf8' );
}

function parseMessages( socket, onReady, onFail ) {
    const chunks = [];

    socket.on( 'data', ( data ) => {
        chunks.push( data );
        let buf = Buffer.concat( chunks );

        while ( buf.length >= 8 ) {
            const size = Number( buf.readBigUInt64LE( 0 ) );
            if ( buf.length < 8 + size )
                break;

            const body = Buffer.from( buf.subarray( 8, 8 + size ) );
            buf = buf.subarray( 8 + size );

            const type = body.readUInt16LE( 0 );
            const id = body.readUInt16LE( 2 );
            console.log( `[pipe] message type=${type} id=${id} size=${size}` );

            if ( type === 1 ) {
                const text = readLengthPrefixedString( body );
                if ( text )
                    console.log( `[dll] ${text}` );
                if ( text && text.includes( 'init failed' ) )
                    onFail( text );
            }

            if ( type === 4 )
                onReady();
        }

        chunks.length = 0;
        if ( buf.length )
            chunks.push( buf );
    } );
}

const server = net.createServer( ( socket ) => {
    console.log( '[pipe] client connected' );
    parseMessages(
        socket,
        () => {
            console.log( '[ok] READY — DLL attach succeeded' );
            socket.destroy();
            server.close();
            process.exit( 0 );
        },
        ( reason ) => {
            console.error( `[fail] ${reason}` );
            socket.destroy();
            server.close();
            process.exit( 1 );
        },
    );
} );

server.on( 'error', ( err ) => {
    console.error( '[fail] pipe server error:', err.message );
    if ( err.code === 'EADDRINUSE' )
        console.error( 'Another RROx instance or test is already using \\\\.\\pipe\\RRO — close it first.' );
    process.exit( 1 );
} );

server.listen( '\\\\.\\pipe\\RRO', () => {
    console.log( '[pipe] listening on \\\\.\\pipe\\RRO' );

    const gameRunning = injector.isProcessRunning( processName );
    console.log( `[check] ${processName} running: ${gameRunning}` );
    if ( !gameRunning ) {
        console.error( `[fail] Start Railroads Online first (main menu), then run this script again.` );
        process.exit( 1 );
    }

    console.log( `[inject] ${dllPath}` );
    const error = injector.inject( processName, dllPath );
    if ( error ) {
        console.error( `[fail] inject error code: ${error}` );
        process.exit( 1 );
    }
    console.log( '[inject] ok — waiting for pipe client + READY (max 30s)...' );
} );

setTimeout( () => {
    console.error( '[fail] timeout — no READY (check [dll] lines above)' );
    process.exit( 1 );
}, 30000 );
