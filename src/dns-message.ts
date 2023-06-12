import { stringToBinary } from '@dnspect/dns-ts';
import { ProxyError, proxy } from './proxy';

const MIN_DNS_QUERY_SIZE = 12;
const MAX_DNS_QUERY_SIZE = 512;

/**
 * Processes DoH GET requests using application/dns-message scheme.
 *
 * @param ctx The Workers execution context.
 * @param dnsServer The upstream DNS server.
 * @param url The DoH request url.
 * @returns
 */
export async function get(
    ctx: ExecutionContext,
    dnsServer: SocketAddress,
    url: URL,
): Promise<Response> {
    let dns = url.searchParams.get('dns');
    if (!dns) {
        return fail('Missing "dns" parameter', 400);
    }

    dns = unescapeBase64Url(dns);

    const size = (dns.length * 3) / 4;
    if (size > MAX_DNS_QUERY_SIZE) {
        return fail(`DNS message exceeded the 512 byte maximum message size`, 414);
    }

    let data: Uint8Array;
    try {
        data = stringToBinary(dns, 'base64');
    } catch (e) {
        console.debug('failed to decode base64url: ' + e);
        return fail('Invalid base64url string', 400);
    }

    // Obviously, invalid data.
    if (data.byteLength < MIN_DNS_QUERY_SIZE) {
        return fail(`Invalid DNS message`, 400);
    }

    try {
        const respData = await proxy(dnsServer, data, ctx);
        return new Response(respData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/dns-message',
            },
        });
    } catch (e) {
        if (e instanceof Error) {
            console.debug(e.stack);
        }
        if (e instanceof ProxyError) {
            return fail(e.publicMessage, e.status);
        }
        return fail('unknown server error', 500);
    }
}

/**
 * Processes DoH POST requests using application/dns-message scheme.
 *
 * @param ctx The Workers execution context.
 * @param dnsServer The upstream DNS server.
 * @param payload The request payload containing the DNS query message.
 * @returns
 */
export async function post(
    ctx: ExecutionContext,
    dnsServer: SocketAddress,
    payload: ArrayBuffer,
): Promise<Response> {
    if (payload.byteLength > MAX_DNS_QUERY_SIZE) {
        return fail(`DNS message exceeded the 512 byte maximum message size`, 413);
    }

    const data = new Uint8Array(payload);
    if (data.byteLength < MIN_DNS_QUERY_SIZE) {
        return fail(`Invalid DNS message`, 400);
    }

    try {
        const respData = await proxy(dnsServer, data, ctx);
        return new Response(respData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/dns-message',
            },
        });
    } catch (e) {
        if (e instanceof Error) {
            console.debug(e.stack);
        }
        if (e instanceof ProxyError) {
            return fail(e.publicMessage, e.status);
        }
        return fail('unknown server error', 500);
    }
}

function unescapeBase64Url(b64: string): string {
    return b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
}

export async function fail(msg: string, status: number): Promise<Response> {
    return new Response(msg, {
        status: status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' },
    });
}
