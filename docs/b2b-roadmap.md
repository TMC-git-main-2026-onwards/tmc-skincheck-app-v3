# TMC SkinCheck — B2B roadmap (future phases, NOT built)

The app goes to market B2B-first: deployed at employer wellness days and
occupational-health screening, especially outdoor-worker cohorts
(construction, agriculture, transport, grounds) — the same population the
cumulative-UV dimension (brief §1.11) was built for.

## What exists today (v0.4)

- **Campaign / organisation code** (`profile.campaignCode`): optional,
  free-text alphanumeric, entered with the user's details. Additive, never a
  gate — no code means the exact consumer flow. The code is stamped on the
  saved result object and the emailed plain-text summary.
- **Partner co-branding**: a code matching a known partner in the `PARTNERS`
  registry applies a branded banner (demo partners: Northwind Travel,
  Meridian Health). Unknown codes are accepted and shown as
  "campaign {CODE}" without branding. The previous strict email-domain +
  invite-code gate was removed (brief §1.13); partner `domains` are retained
  in the registry for a future co-branding phase only.
- **Occupational-health framing**: when a code is present, the questionnaire
  intro acknowledges the workplace context, and the consent screen states
  that results stay on the device and are not shared with the employer.
- **Consumer booking funnel unchanged** — occupational-health clients
  convert through the same service-specific booking pages.

## Future phases (documented only — do not build yet)

1. **De-identified cohort dashboard for employers**
   - Aggregate outcomes per `campaignCode`: risk-band distribution
     (melanoma pathway, cumulative-UV pathway, overall), % flagged
     urgent, % with high cumulative occupational exposure.
   - Requires a backend ingestion endpoint; results currently never leave
     the device.
   - **GDPR/privacy**: before any aggregation is added, revisit the lawful
     basis and the privacy wording with the TMC Privacy Policy. The current
     consent copy explicitly promises results are *not* shared with the
     employer in this version — that promise must be re-consented, not
     silently changed. De-identification thresholds (e.g. suppress cohorts
     under n=10) needed to prevent re-identification at small sites.

2. **Co-branded / white-label campaign theming**
   - Partner logo slot beside the TMC logo, brand colour theming via the
     existing `PARTNERS.brandColor`, partner-specific welcome copy.
   - Registry should move from hard-coded `PARTNERS` to a fetched config.

3. **Occupational-health-specific next step**
   - As an alternative to the consumer booking funnel: "book onto the
     on-site screening day" (employer-arranged), driven by campaign-code
     configuration — e.g. a `bookingMode: 'onsite'` flag with an event date
     and location instead of the TMC booking URL.

4. **Email results via backend** (replaces the §1.7 `mailto:` draft) —
   prerequisite for both the dashboard and any follow-up journeys.
