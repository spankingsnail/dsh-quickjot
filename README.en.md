<div align="center">

# 随手记

**Say it out loud, and it is on the calendar.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5b5bd6.svg)](https://github.com/deepseek-ai)
[![中文](https://img.shields.io/badge/README-简体中文-2f81f7.svg)](README.md)

**English** · [简体中文](README.md)

</div>

The hardest part of keeping a calendar was never remembering. It is **opening it, filling in a form, picking a date**.

随手记 is a local calendar plugin for [DeepSeek Harness](https://github.com/deepseek-ai) that collapses that into a sentence: notes, todos and dated events share one ledger, one line puts something in it, and it reminds you in the app when it is due — or on WeChat, if you have confirmed a target.

https://github.com/user-attachments/assets/a22ff3f9-1d85-48d2-b5e3-5d370c5f56a1

Everything lives on your machine as one JSON record per item: readable, backup-able, portable.

The WeChat part is not our own work: target management and the message channel come from **[DSH-IM](https://github.com/xmanrui/dsh-im)**. Without it, reminders would stop at the in-app list.

---

## Why it exists

Most of what you think out loud with an assistant is gone the moment the answer lands.

"Remind me to renew the contract at ten tomorrow", "note this idea down", "finish the proposal before next Wednesday" — those sentences dissolve into the transcript. What you need is not a smarter assistant but **a place where a sentence becomes an item**.

And yet the reason people abandon note-taking tools is rarely forgetting. It is friction: to record "meeting at ten tomorrow" you open an app, find New, choose a type, choose a date, choose a time, hit save. **Six steps per record is a habit nobody keeps.**

So the default posture here is: just say it.

- Say it in any conversation; the agent writes the item into the local ledger through the plugin's tools.
- Do not want to leave the page? Click **随口记** in the page header — it is a chat box, not a form: one input, one send button.
- When you do want to browse or edit, go to the sidebar: the calendar lists events by month, todos can be checked off, notes keep the ideas that have not crystallised yet.
- When it is due, it reminds you — in-app reminders need no setup at all; WeChat reminders need a target you have saved beforehand.

The form still exists. It is the fallback, not the main path.

What it deliberately does **not** do: it does not read or listen to your other conversations, does not act on todos by itself, does not infer authorisation from quoted material, does not upload anything, and does not make decisions for you.

## Three ways in, ordered by motion

Not by where the button sits — by what you are doing when the thought arrives:

| If you are | Use | Notes |
| --- | --- | --- |
| Talking to the assistant and something comes up | **Say it in chat** | The `dsh_quickjot_list` / `dsh_quickjot_write` tools; no context switch, keep working |
| Already on the page and cannot be bothered to leave | **随口记 in the page header** | A short chat on your DSH model quota; the item lands in the same ledger, no form |
| Tidying up, browsing, editing | **Sidebar 随手记** | Event / todo / note views; expand the month grid to filter by date; the full form lives here |

All three write the same ledger. Which one you use depends on how willing you are to walk away from what you were doing.

The UI follows the DSH theme. Dates and due times are always read as **Asia/Shanghai**, never the browser time zone.

## Design decisions you will notice

**Speaking is the entry point; the form is a fallback.** Say "meeting at ten tomorrow morning" in 随口记 and the assistant splits it into items and asks about anything vague; when the time is unclear it asks rather than guessing. The form stays because sometimes you really do want to click on a calendar — it just should not be the default.

**Quoting is not authorisation.** Articles you paste, meeting notes, other people's words are all just material. An item is created only when you explicitly ask for it. That rule lives in the plugin's global policy, not in the model's mood of the moment.

**Per-item writes can partially succeed.** When you write several items at once, each one lands independently under a revision-based optimistic lock. There is no whole-table overwrite, and a failed second item is never dressed up as "all good" — you get the reason per item.

**Reminder state is verifiable.** Before a WeChat send, the plugin persists "sending"; only a channel acknowledgement becomes "sent"; a timeout or crash becomes "uncertain" with **no automatic retry**, so you are never spammed twice. Check WeChat, then decide whether to resend.

**It does not pretend to be reliable.** Quitting the app stops reminders; real sleep defers delivery and produces a "missed reminder" afterwards. This is a best-effort local reminder, not a precision alarm clock — the README says so up front, because promising what cannot be delivered is worse than not promising.

## Install

> Currently v3.2.0, for the desktop build of DSH (0.2.x).

```bash
git clone https://github.com/spankingsnail/dsh-quickjot.git ~/dsh-quickjot
cd ~/dsh-quickjot
npm install
npm run build
```

Then register this checkout in your DSH profile (`~/.dsh/profiles/<profile>/package.json`):

```json
{
  "dependencies": {
    "dsh-quickjot": "link:/Users/you/dsh-quickjot"
  },
  "dsh": {
    "profile": {
      "bundles": ["...other bundles...", "dsh-quickjot"]
    }
  }
}
```

Run `pnpm install` inside that profile directory and restart DSH. The sidebar showing **随手记** means it loaded. You can disable or remove the plugin at any time; disabling does not delete existing items.

> Upgrading from an early version: the storage domains are `dsh_quickjot` / `dsh_quickjot_in_app`, and the tools are `dsh_quickjot_list` / `dsh_quickjot_write` / `dsh_quickjot_in_app_reminders`.

## Using it

**The shortest path: open 随手记, click 随口记 in the header, and say it.**

In the title bar, choose a model already configured in DSH and, when supported, its reasoning effort, without crowding the chat input. This changes only this quick-jot conversation, not the global default. Catalog and selection errors are shown explicitly; the plugin never silently switches to another model.

If the saved quick-jot conversation is archived, the popup explains why sending is disabled. Click the restore button to unarchive only this conversation, then submit manually. Restoring never resends old messages.

- "Remind me to renew the contract at ten tomorrow morning" → an event, plus a question about whether to send it to WeChat
- "Note this idea down: add a risk column to the weekly report" → a note
- "Finish the proposal before next Wednesday" → a todo with a due date
- "What is on my schedule this week?" → asking is allowed; not everything has to be recorded

When something is vague it asks. Notes and plain todos may have no date; an event must have a concrete date and time.

**In chat it works the same way:** say "remember this for me" in any conversation and the agent calls `dsh_quickjot_write`. No need to switch to the plugin page.

**When you do want the form:** click "+ New note / todo / event" in the page. That path still exists — it is just no longer the default.

**Reminders:** unfinished todos and events with a time enter the in-app reminder list automatically — the "Reminders N" button at the bottom right opens the unread list, popping at most three at the moment they come due. To also send some reminders to WeChat, first test and save a target under Settings → IM bot → WeChat, then select it as the default in the page.

## Data and privacy

- Items live in the DSH storage domain `dsh_quickjot` (version 1, one record each); unread reminder state lives in `dsh_quickjot_in_app`. The backend is plain per-record JSON at a path DSH decides (usually under `~/.dsh/storages/`).
- Only items, tags, reminder state and the ID of the delivery target you picked are stored. No conversation content, no address book, no WeChat token.
- WeChat delivery only calls a target **you have already saved** through the connected `dshIm` service. It never creates targets, reads credentials, or messages unknown contacts.
- Everything is local: no server, no cloud sync, no external data source.

## Credits

- **[DSH-IM](https://github.com/xmanrui/dsh-im)** (`@xmanrui/dsh-im`) — **the WeChat delivery in this plugin exists only because of its technology.** Target management, the IM channel and send receipts all come from DSH-IM; 随手记 adds only three things on top: picking one of your saved targets, recording delivery state locally, and letting you verify the result. No DSH-IM, no WeChat reminders.
- **[dsh-plugin-control-your-schedule](https://github.com/HaoyanZhang123/dsh-plugin-control-your-schedule)** (HaoyanZhang123, MIT) — the upstream this project grew out of. The data shape, the reminder state machine and the "quoting is not authorisation" policy are continued from it.
- **[DeepSeek Harness](https://github.com/deepseek-ai)** — plugin framework, UI slots, storage domains and model quota.

## License

MIT. Upstream copyright and provenance are retained; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
