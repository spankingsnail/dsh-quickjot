# Third-party notices

Reference project: https://github.com/HaoyanZhang123/dsh-plugin-control-your-schedule

Reviewed version: 0.6.2, commit e24bd2262b81ea6c0b7c7d1dadfcd28655edb6d7.
License: MIT, Copyright (c) 2026 HaoyanZhang123. Full permission and warranty notice retained in LICENSE.

The note/task/calendar organization and native sidebar registration pattern informed this implementation. Its iframe workspace snapshot persistence, drawing area and prompt library are intentionally not included. This is a focused rewrite using DSH storageDomain per-item records and a Host delivery worker, not a copy of the upstream bundled web application. No upstream image or font assets are included. The note outline icon is original SVG geometry.

Delivery integration: @xmanrui/dsh-im (DSH-IM) 5.10.0, MIT, Copyright (c) xmanrui (https://github.com/xmanrui).
The WeChat reminder feature exists only because of DSH-IM's technology: target management, the IM delivery channel
and send receipts all come from that plugin. DSH-Calendar adds only the item-to-target selection, records delivery
state locally, and lets the user verify the outcome. It calls the `dshIm` service for delivery and never creates
targets, reads credentials or contacts the channel on its own. DSH-IM itself is not bundled or redistributed here.

Runtime dependency: Zod 3.25.76, MIT (Colin McDonnell). The dependency retains its own license in its distributed package. No remote runtime scripts, CDN fonts, or analytics are used.
