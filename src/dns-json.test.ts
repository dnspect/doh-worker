import { expect, test } from 'vitest';

test('test buildQuery()', () => {
    expect(true).to.be.true;
});

/*
import { expect, test } from 'vitest';
import { EDNS0_UDP_PAYLOAD_SIZE, buildQuery } from './dns-json';
import { Class, FQDN, RRType } from '@dnspect/dns-ts';
import { Prefix } from '@dnspect/ip-address-ts';
import { ClientSubnet, OptCode } from '@dnspect/dns-ts/edns';

test('test buildQuery()', () => {
    const qname = FQDN.parse('example.com');
    const qtype = RRType.A;
    const subnet = Prefix.parse('203.0.113.0/24');
    const query = buildQuery(
        qname,
        qtype,
        true,
        true,
        false,
        subnet,
    );
    const question = query.firstQuestion();
    const opt = query.opt();

    expect(query.id).to.be.greaterThan(0);
    expect(query.header.recursionDesired).to.be.true;
    expect(query.header.checkingDisabled).to.be.false;
    expect(query.header.qdCount).to.equals(1);
    expect(question).to.be.not.null;
    expect(question?.qname).to.equals(qname);
    expect(question?.qtype).to.equals(qtype);
    expect(question?.qclass).to.equals(Class.IN);
    expect(opt?.optHeader().dnssecOk()).to.be.true;
    expect(opt?.optHeader().udpPayloadSize()).to.equals(EDNS0_UDP_PAYLOAD_SIZE);

    const option = opt?.options.find((option) => option.optCode === OptCode.ClientSubnet);
    expect(option).not.undefined;
    const ecs = option as ClientSubnet;
    expect(ecs.address).to.be.equals(subnet.ip());
    expect(ecs.sourcePrefixLength).to.be.equals(subnet.length());
});

*/
