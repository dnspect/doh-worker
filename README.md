# DNS over HTTPS Worker

[![npm](https://img.shields.io/npm/v/@dnspect/doh-worker.svg)](https://www.npmjs.com/package/@dnspect/doh-worker) &nbsp;
[![CI](https://github.com/dnspect/doh-worker/actions/workflows/ci.yml/badge.svg)](https://github.com/dnspect/doh-worker/actions/workflows/ci.yml) &nbsp;

A TypeScript library for building DNS over HTTPS reverse proxies that make DNS servers speak DoH using Cloudflare Workers.

## Install

Add this package to your package.json by running this in the root of your project's directory:

```sh
npm install @dnspect/doh-worker
```

## Usage

This package is designed to be used with [Cloudflare Workers](https://workers.cloudflare.com/).

Build a DoH proxy:

```javascript
import { handle } from '@dnspect/doh-worker';

export interface Env {}

export default {
  async fetch(req: Request, _env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (ur.pathname === '/dns-query') {
      return handle(ctx, req, { hostname: '1.1.1.1', port: 53 });
    }

    return new Response(null, { status: 404 });
  },
};
```
