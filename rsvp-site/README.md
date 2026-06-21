# Public RSVP Vercel Project

Deploy this folder as the Root Directory of the `akhila-akshay-rsvp` Vercel project.

Required environment variables (copy the existing values from the private dashboard project):

```text
VERCEL_KV_REST_API_URL
VERCEL_KV_REST_API_TOKEN
COMMON_EVENT_ADDRESS
RSVP_SECRET
RESEND_API_KEY
INVITE_FROM_EMAIL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Optional event-address variables:

```text
PELLIKUTHURU_ADDRESS
PELLIKODUKU_ADDRESS
```

This project intentionally contains only the public RSVP page and API. It uses the same Vercel KV guest data as the private dashboard, and locks a guest record after its first public RSVP submission.

`RSVP_SECRET` must exactly match the value in the private dashboard project. This lets signed, guest-specific invitation links open here, with the guest's invited events and Apple Calendar download. In the private dashboard project, set `RSVP_SITE_URL=https://akhila-akshay-rsvp.vercel.app` so invitation emails use this public site.

Copy the same Resend and Twilio credentials from the private dashboard project. The public RSVP API sends a detailed email and SMS confirmation only after a final RSVP has been saved.
