import * as dnsJson from './dns-json';
import * as dnsMessage from './dns-message';

/**
 * Handles DNS over HTTPS requests.
 *
 * @param ctx The Workers execution context.
 * @param req The HTTP request.
 * @param dnsServer The upstream DNS server.
 *
 * @returns
 */
export async function handle(
    ctx: ExecutionContext,
    req: Request,
    dnsServer: SocketAddress,
): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;

    if (method === 'OPTIONS') {
        const headers = new Headers();
        headers.set('access-control-allow-origin', '*');
        headers.set('access-control-allow-methods', 'GET,POST');
        headers.set('access-control-allow-headers', 'Content-Type');
        return new Response(null, { headers: headers, status: 200 });
    }

    switch (req.headers.get('accept')) {
        case 'application/dns-message': {
            switch (method) {
                case 'GET': {
                    return dnsMessage.get(ctx, dnsServer, url);
                }
                case 'POST': {
                    // 'application/dns-message' or 'application/dns-message;charset=UTF-8'
                    const contextType = req.headers.get('Content-Type') ?? '';
                    const contentTypes = contextType.split(';');
                    if (
                        contentTypes.length === 0 ||
                        contentTypes[0] !== 'application/dns-message'
                    ) {
                        return dnsMessage.fail(`Unsupported media type: ${contentTypes}`, 415);
                    }
                    return dnsMessage.post(ctx, dnsServer, await req.arrayBuffer());
                }
                default: {
                    return dnsMessage.fail(`Unsupported request method: ${method}`, 405);
                }
            }
        }
        case 'application/dns-json': {
            if (method !== 'GET') {
                return dnsJson.fail(`Unsupported request method: ${method}`, 405);
            }
            return dnsJson.get(ctx, dnsServer, url);
        }
        default: {
            return new Response(
                'Unsupported representation, should be one of: application/dns-message, application/dns-json',
                {
                    status: 406,
                    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' },
                },
            );
        }
    }
}
