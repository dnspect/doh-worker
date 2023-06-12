import { FQDN, Message, MessageBuilder, QType, qtypeFrom } from '@dnspect/dns-ts'
import { PacketBuffer } from '@dnspect/dns-ts/buffer'
import { ClientSubnet } from '@dnspect/dns-ts/edns'
import { Prefix } from '@dnspect/ip-address-ts'
import { ProxyError, proxy } from './proxy'

// The recommended default max EDNS0 UDP message size
// https://dnsflagday.net/2020/
const EDNS0_UDP_PAYLOAD_SIZE = 1232

/**
 * Processes DoH GET requests using application/dns-json scheme.
 *
 * @param ctx The Workers execution context.
 * @param dnsServer The upstream DNS server.
 * @param url The DoH request url.
 *
 * @returns
 */
export async function get(
    ctx: ExecutionContext,
    dnsServer: SocketAddress,
    url: URL,
): Promise<Response> {
    const name = url.searchParams.get('name')
    if (name === null) {
        return fail('Missing "name" parameter', 400)
    }
    let domain: FQDN
    try {
        domain = FQDN.parse(name)
    } catch (e) {
        return fail(`Invalid query name: ${name}`, 400)
    }

    const qtypeStr = url.searchParams.get('type') ?? 'A'
    const qtype = /\d+/.test(qtypeStr) ? (parseInt(qtypeStr) as QType) : qtypeFrom(qtypeStr)
    if (qtype === null) {
        return fail(`Invalid query type: ${qtypeStr}`, 400)
    }

    let dnssecOk = false
    const doFlag = url.searchParams.get('do')
    switch (doFlag) {
        case '':
        case '1':
        case 'true':
            dnssecOk = true
            break
        case null:
        case '0':
        case 'false':
            break
        default:
            return fail(`Invalid DO flag: ${doFlag}`, 400)
    }

    let checkDisabled = false
    const cdFlag = url.searchParams.get('cd')
    switch (cdFlag) {
        case '':
        case '1':
        case 'true':
            checkDisabled = true
            break
        case null:
        case '0':
        case 'false':
            break
        default:
            return fail(`Invalid CD flag: ${cdFlag}`, 400)
    }

    let ecs: Prefix | undefined
    const ecsStr = url.searchParams.get('edns_client_subnet')
    if (ecsStr !== null) {
        ecs = Prefix.parse(ecsStr)
    }

    const msg = buildQuery(domain, qtype, true, dnssecOk, checkDisabled, ecs)
    const buf = PacketBuffer.alloc(64)
    msg.pack(buf)

    try {
        const respData = await proxy(dnsServer, buf.slice(), ctx)
        const respMsg = Message.unpack(respData)
        if (respMsg.id() !== msg.id()) {
            throw new ProxyError(
                'Bad response from upstream server',
                'Message ids do not match',
                502,
            )
        }

        return new Response(JSON.stringify(respMsg.toJsonObject()), {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/dns-json',
            },
        })
    } catch (e) {
        if (e instanceof Error) {
            console.debug(e.stack)
        }

        if (e instanceof ProxyError) {
            return fail(e.publicMessage, e.status)
        }
        return fail('Unknown server error', 500)
    }
}

/**
 * Builds a DNS query message.
 *
 * @param name The query name.
 * @param qtype The query type.
 * @param rd If set RD bit.
 * @param dnssecOk If set DO bit.
 * @param checkDisabled If set CD bit.
 * @param ecs The client subnet.
 *
 * @returns A DNS message.
 */
function buildQuery(
    name: FQDN,
    qtype: QType,
    rd: boolean,
    dnssecOk: boolean,
    checkDisabled: boolean,
    ecs?: Prefix,
): Message {
    const mb = new MessageBuilder()

    const header = mb.header()
    header.randomId()
    header.setRD(rd)
    header.setCD(checkDisabled)

    const question = mb.question()
    question.push_in(name, qtype)

    const extra = mb.additional()
    extra.opt((ob) => {
        ob.setVersion(0)
        ob.setDnssecOk(dnssecOk)
        ob.setUdpPayloadSize(EDNS0_UDP_PAYLOAD_SIZE)
        if (ecs) {
            ob.push(ClientSubnet.fromPrefix(ecs))
        }
    })

    return mb.build()
}

/**
 * Returns a negative response in application/dns-json format.
 *
 * @param err The error message returned to client.
 * @param status The HTTP status code to use.
 *
 * @returns
 */
export async function fail(err: string, status: number): Promise<Response> {
    return new Response(`{"error": "${err}"}`, {
        status: status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/dns-json' },
    })
}
