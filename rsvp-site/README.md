# Public RSVP Vercel Project

Deploy this folder as the Root Directory of the `akhila-akshay-rsvp` Vercel project.

Required environment variables (copy the existing values from the private dashboard project):

```text
VERCEL_KV_REST_API_URL
VERCEL_KV_REST_API_TOKEN
COMMON_EVENT_ADDRESS
```

Optional event-address variables:

```text
PELLIKUTHURU_ADDRESS
PELLIKODUKU_ADDRESS
```

This project intentionally contains only the public RSVP page and API. It uses the same Vercel KV guest data as the private dashboard, and locks a guest record after its first public RSVP submission.
