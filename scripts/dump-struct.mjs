/**
 * Dump live struct properties/functions from the game (pipe + inject).
 * Close RROx first. Game (arr-Win64-Shipping) must be running.
 *
 * Uses Electron's Node ABI (injector.node). Run via research-dump-struct.ps1.
 *
 *   .\scripts\research-dump-struct.ps1 "Class arr.ARRPlayerController"
 */
import net from 'net';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const structName = process.argv[ 2 ] || 'Class arr.ARRPlayerController';
const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const require = createRequire( import.meta.url );

const root = path.join( __dirname, '..' );
const electronExe = path.join( root, '_release/RailroadsOnline Extended.exe' );
const injector = require( path.join( root, '_release/resources/app/.webpack/main/native_modules/build/Release/injector.node' ) );
const dllPath = path.join( root, 'packages/dll/x64/Release/RROxDLL.dll' );
const releaseDll = path.join( root, '_release/resources/app/.webpack/main/assets/RROxDLL.dll' );
const processName = 'arr-Win64-Shipping.exe';

const MessageType = { LOG: 1, GET_STRUCT: 2, READY: 4 };
const PropertyType = {
    Unknown: 0,
    StructProperty: 1,
    ObjectProperty: 2,
    SoftObjectProperty: 3,
    FloatProperty: 4,
    ByteProperty: 5,
    BoolProperty: 6,
    IntProperty: 7,
    Int8Property: 8,
    Int16Property: 9,
    Int64Property: 10,
    UInt16Property: 11,
    UInt32Property: 12,
    UInt64Property: 13,
    NameProperty: 14,
    DelegateProperty: 15,
    SetProperty: 16,
    ArrayProperty: 17,
    WeakObjectProperty: 18,
    StrProperty: 19,
    TextProperty: 20,
    MulticastSparseDelegateProperty: 21,
    EnumProperty: 22,
    DoubleProperty: 23,
    MulticastDelegateProperty: 24,
    ClassProperty: 25,
    MapProperty: 26,
    InterfaceProperty: 27,
    FieldPathProperty: 28,
    SoftClassProperty: 29,
};

const CPF_Parm = 0x80n;
const CPF_OutParm = 0x100n;
const CPF_ReturnParm = 0x400n;

const TYPE_NAMES = Object.fromEntries( Object.entries( PropertyType ).map( ( [ k, v ] ) => [ v, k ] ) );

let nextId = 1;
let ready = false;
let pending = null;

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

function readArray( buf, pos, readItem ) {
    const count = Number( buf.readBigUInt64LE( pos ) );
    let p = pos + 8;
    const items = [];
    for ( let i = 0; i < count; i++ ) {
        const item = readItem( buf, p );
        items.push( item.value );
        p = item.next;
    }
    return { value: items, next: p };
}

function readProperty( buf, pos ) {
    const type = buf.readUInt32LE( pos );
    let r = readString( buf, pos + 4 );
    const name = r.value;
    const offset = buf.readUInt32LE( r.next );
    const size = buf.readUInt32LE( r.next + 4 );
    const propertyFlags = buf.readBigUInt64LE( r.next + 8 );
    const arrayDim = buf.readInt32LE( r.next + 16 );
    let p = r.next + 20;
    let extra = '';

    switch ( type ) {
        case PropertyType.StructProperty:
        case PropertyType.ObjectProperty:
        case PropertyType.ByteProperty:
        case PropertyType.DelegateProperty:
        case PropertyType.MulticastDelegateProperty:
        case PropertyType.MulticastSparseDelegateProperty:
        case PropertyType.EnumProperty:
        case PropertyType.ClassProperty:
        case PropertyType.InterfaceProperty:
        case PropertyType.FieldPathProperty:
        case PropertyType.SoftClassProperty:
        case PropertyType.SoftObjectProperty:
        case PropertyType.WeakObjectProperty: {
            r = readString( buf, p );
            extra = ` -> ${r.value}`;
            p = r.next;
            break;
        }
        case PropertyType.ArrayProperty:
        case PropertyType.SetProperty: {
            const inner = readProperty( buf, p );
            extra = ` inner=${formatProperty( inner.value, true )}`;
            p = inner.next;
            break;
        }
        case PropertyType.MapProperty: {
            const key = readProperty( buf, p );
            const value = readProperty( buf, key.next );
            extra = ` key=${formatProperty( key.value, true )} value=${formatProperty( value.value, true )}`;
            p = value.next;
            break;
        }
        case PropertyType.BoolProperty:
            p += 1;
            break;
        default:
            break;
    }

    return {
        value: { type, name, offset, size, propertyFlags, arrayDim, extra },
        next: p,
    };
}

function formatProperty( prop, compact = false ) {
    const typeName = TYPE_NAMES[ prop.type ] ?? `type${prop.type}`;
    const flags = [];
    if ( prop.propertyFlags & CPF_Parm ) flags.push( 'Parm' );
    if ( prop.propertyFlags & CPF_OutParm ) flags.push( 'Out' );
    if ( prop.propertyFlags & CPF_ReturnParm ) flags.push( 'Return' );
    const flagText = flags.length ? ` [${flags.join( ',' )}]` : '';
    if ( compact )
        return `${typeName} ${prop.name}${prop.extra || ''}${flagText}`;
    return `  ${prop.name}: ${typeName} @${prop.offset}+${prop.size}${prop.extra || ''}${flagText}`;
}

function readFunction( buf, pos ) {
    let r = readString( buf, pos );
    const fullName = r.value;
    r = readString( buf, r.next );
    const cppName = r.value;
    const flags = buf.readUInt32LE( r.next );
    const size = buf.readUInt32LE( r.next + 4 );
    const params = readArray( buf, r.next + 8, readProperty );
    return {
        value: { fullName, cppName, flags, size, params: params.value },
        next: params.next,
    };
}

function parseStruct( buf, pos ) {
    let r = readString( buf, pos );
    const fullName = r.value;
    r = readString( buf, r.next );
    const cppName = r.value;
    r = readString( buf, r.next );
    const superName = r.value;
    const isClass = buf.readUInt8( r.next ) !== 0;
    const size = buf.readUInt32LE( r.next + 1 );
    let p = r.next + 5;

    const members = readArray( buf, p, readProperty );
    p = members.next;
    const functions = readArray( buf, p, readFunction );

    return { fullName, cppName, superName, isClass, size, members: members.value, functions: functions.value };
}

function printStruct( parsed ) {
    console.log( `\n${parsed.fullName}` );
    console.log( `  super: ${parsed.superName || '(none)'}` );
    console.log( `  size: ${parsed.size}` );
    console.log( `\nMembers (${parsed.members.length}):` );
    for ( const m of parsed.members )
        console.log( formatProperty( m ) );

    console.log( `\nFunctions (${parsed.functions.length}):` );
    for ( const fn of parsed.functions ) {
        console.log( `\n  ${fn.fullName}` );
        console.log( `    cpp: ${fn.cppName}, size: ${fn.size}, flags: 0x${fn.flags.toString( 16 )}` );
        if ( fn.params.length === 0 ) {
            console.log( '    (no params)' );
            continue;
        }
        for ( const p of fn.params )
            console.log( `    - ${formatProperty( p, true )}` );
    }
}

function handleBody( body ) {
    const type = body.readUInt16LE( 0 );
    const id = body.readUInt16LE( 2 );

    if ( type === MessageType.LOG ) {
        const text = readString( body, 4 ).value;
        console.log( `[dll] ${text}` );
        return;
    }

    if ( type === MessageType.READY ) {
        ready = true;
        if ( pending ) pending();
        return;
    }

    if ( type === MessageType.GET_STRUCT && id === pending?.id ) {
        const structType = body.readUInt32LE( 4 );
        if ( structType !== 1 ) {
            console.error( 'Struct not found:', structName );
            process.exit( 1 );
        }
        const parsed = parseStruct( body, 8 );
        printStruct( parsed );
        process.exit( 0 );
    }
}

const server = net.createServer( ( socket ) => {
    const chunks = [];
    socket.on( 'data', ( data ) => {
        chunks.push( data );
        let buf = Buffer.concat( chunks );
        while ( buf.length >= 8 ) {
            const size = Number( buf.readBigUInt64LE( 0 ) );
            if ( buf.length < 8 + size ) break;
            handleBody( Buffer.from( buf.subarray( 8, 8 + size ) ) );
            buf = buf.subarray( 8 + size );
        }
        chunks.length = 0;
        if ( buf.length ) chunks.push( buf );
    } );

    const sendGetStruct = () => {
        const id = nextId++;
        const io = [];
        const w16 = ( v ) => { const b = Buffer.alloc( 2 ); b.writeUInt16LE( v ); io.push( b ); };
        const wStr = ( s ) => {
            const b = Buffer.from( s, 'utf8' );
            const len = Buffer.alloc( 8 );
            len.writeBigUInt64LE( BigInt( b.length ) );
            io.push( len, b );
        };
        w16( MessageType.GET_STRUCT );
        w16( id );
        wStr( structName );
        writeMessage( socket, Buffer.concat( io ) );
        pending = { id };
    };

    setTimeout( () => {
        if ( !ready ) {
            console.error( 'Timeout waiting for READY' );
            process.exit( 1 );
        }
        sendGetStruct();
    }, 500 );
} );

server.listen( '\\\\.\\pipe\\RRO', () => {
    if ( !injector.isProcessRunning( processName ) ) {
        console.error( 'Game not running.' );
        process.exit( 1 );
    }
    console.log( `[inject] ${structName}` );
    const dll = require( 'fs' ).existsSync( dllPath ) ? dllPath : releaseDll;
    const err = injector.inject( processName, dll );
    if ( err ) {
        console.error( 'Inject failed:', err );
        process.exit( 1 );
    }
} );

setTimeout( () => process.exit( 1 ), 60000 );
