import { Message } from '@dnspect/dns-ts';
import { PacketBuffer } from '@dnspect/dns-ts/buffer';
import { connect } from 'cloudflare:sockets';

/**
 * Errors occur when communicating with the upstream server.
 */
export class ProxyError {
    /** Public message return to the client */
    publicMessage: string;
    /** Internal message for logging */
    private internal: string;
    /** The corresponding HTTP status */
    status: number;

    /**
     * Constructs a new proxy error.
     *
     * @param message The message would be returned to client
     * @param internal The message for internal logging.
     * @param status The HTTP status code.
     */
    constructor(message: string, internal: string, status: number) {
        this.publicMessage = message;
        this.internal = internal;
        this.status = status;
    }

    /**
     * @returns
     */
    toString(): string {
        return this.internal;
    }
}

/**
 *
 * @param dnsServer
 * @param data The DNS query payload
 * @param ctx
 * @returns
 *
 * @throws ProxyError
 */
export async function proxy(
    dnsServer: SocketAddress,
    data: Uint8Array,
    ctx: ExecutionContext,
): Promise<Uint8Array> {
    let msg: Message;
    try {
        msg = Message.unpack(data);
    } catch (e) {
        throw new ProxyError('Bad query message', `failed to unpack query message: ${e}`, 400);
    }

    console.debug('received query: ' + msg.firstQuestion()?.toString());

    let socket: Socket;
    try {
        socket = connect(dnsServer, { secureTransport: 'off', allowHalfOpen: false });
    } catch (e) {
        throw new ProxyError(
            'Connection to upstream server failed',
            `failed to connect to upstream server ${dnsServer}: ${e}`,
            502,
        );
    }

    try {
        // Upstream data writer
        const upWriter = socket.writable.getWriter();
        // Upstream data reader
        const upReader = socket.readable.getReader();
        // Message length in bytes
        const len = data.length;

        // First prefix with a two byte length field which gives the message length.
        const buf = new Uint8Array(len + 2);
        buf[0] = len >>> 8;
        buf[1] = len & 0xff;
        buf.set(data, 2);
        await upWriter.write(buf);

        let size = 0;
        let bytesRead = -1;
        let out: PacketBuffer | null = null;

        while (bytesRead < size) {
            const { done, value } = await upReader.read();
            if (done) {
                break;
            }

            if (value) {
                if (out === null) {
                    // 2 bytes for payload size + 12 bytes DNS header
                    if (value.length < 14) {
                        throw new ProxyError(
                            'Bad response from upstream server',
                            `invalid response from ${dnsServer}, size: ${value.length}`,
                            502,
                        );
                    }
                    size = (value[0] << 8) | value[1];
                    console.debug(`receiving response packet: ${size} bytes`);
                    out = PacketBuffer.alloc(size);
                    out.write(value.slice(2));
                    bytesRead = value.length - 2;
                } else {
                    out.write(value);
                    bytesRead += value.length;
                }
            }
        }

        if (out === null) {
            throw new ProxyError(
                'Bad response from upstream server',
                'receive no response from upstream server',
                502,
            );
        }

        console.debug(`received response data: ${bytesRead} bytes`);

        ctx.waitUntil(socket.close());
        return out.freeze(bytesRead).slice();
    } catch (e) {
        throw new ProxyError(
            'Connection to upstream server failed',
            `failed to communicate with upstream server ${dnsServer}: ${e}`,
            502,
        );
    }
}
