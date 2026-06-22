# Public RSVP Vercel Project

Deploy this folder as the Root Directory of the `akhila-akshay-rsvp` Vercel project.

Required environment variables (copy the existing values from the private dashboard project):

```text
VERCEL_KV_REST_API_URL
VERCEL_KV_REST_API_TOKEN
COMMON_EVENT_ADDRESS
RSVP_SECRET
GMAIL_SENDER_EMAIL
GMAIL_SENDER_NAME
GMAIL_OAUTH_CLIENT_ID
GMAIL_OAUTH_CLIENT_SECRET
GMAIL_OAUTH_REFRESH_TOKEN
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

Copy the same Gmail and Twilio credentials from the private dashboard project. The public RSVP API sends a detailed email and SMS confirmation only after a final RSVP has been saved. Gmail variables take precedence over the legacy Resend variables, so a verified custom domain is not required for confirmation emails.

Before generating the final Gmail refresh token, set the Google OAuth app's publishing status to **In production**. The app has only one authorized user—the wedding Gmail account—so guests never interact with Google's OAuth screen. Testing-mode refresh tokens expire after seven days.
