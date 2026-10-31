# Level 1: Resilient Client

## Overview
In production environments, networks are unreliable. A client application must handle failures gracefully. This challenge requires you to build a resilient HTTP client wrapper that automatically retries failed `PUT` requests using an exponential backoff strategy.

## Challenge Requirements
1. Create an `index.js` containing an `async function resilientPut(url, data, retries)`.
2. The function must attempt to send a `PUT` request to the provided URL.
3. If the request fails (network error or HTTP status `!res.ok`), it should wait and try again.
4. The wait time should double on each retry (Exponential Backoff): `100ms`, `200ms`, `400ms`, etc.
5. If it fails after the maximum number of retries, it must throw an error.

## Architecture
```text
[Client Wrapper]                 [Server API]
       | -- PUT /api/user -->      |
       | <- 500 Error -------      | (Attempt 1)
       | (Wait 100ms)              |
       | -- PUT /api/user -->      |
       | <- 500 Error -------      | (Attempt 2)
       | (Wait 200ms)              |
       | -- PUT /api/user -->      |
       | <- 200 OK ----------      | (Attempt 3 Success)
```

## Setup & Testing
1. Install dependencies: `npm install`
2. Run tests: `npm test`
