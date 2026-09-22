# When something goes wrong in Dealroom

This page is for people using Dealroom, including the hosted pilot at
dealroom.todo.law. It explains how to report a problem, what the reference on
an error page is for, and why your work is never locked in.

## How to report a problem

Use the **Feedback** button in Dealroom. It is in the top bar on a computer
(the speech-bubble icon next to your email address) and in the menu on a
phone. Say what you were doing, what you expected, and what happened
instead. If an error page gave you a reference, include it.

Every report reaches the person who runs the service in their daily summary.
You do not need to send it anywhere else.

If you cannot sign in, and so cannot reach the Feedback button, use the
contact details on the [todo.law](https://todo.law) website and include the
reference if you have one.

## The reference on an error page

When a page or an action fails, Dealroom shows a short sentence, a way back,
and a reference such as `DR-3F9A1C07B2`. The same reference is written to the
service's log next to the technical details of the failure. Quoting it lets
the failure be found at once, without you having to describe it in technical
terms. The reference itself contains nothing about you or your documents.

Messages that start "Something went wrong on our side" also end with a
reference. Trying again after a moment often works. If it keeps happening,
report it with the reference.

## Your work is always available to you

- **Your documents.** Every deal page offers its contract as PDF, DOCX and
  plain text.
- **Everything at once.** Signed in, open `/api/account/export` to download
  everything your account created or joined (deals, their terms and your
  own choices, and your startup journeys) as one file.
- **On the hosted pilot,** reading and exporting are never blocked: not when
  you reach a pilot limit, and not after the 90-day editing period ends,
  when the account becomes read-only.

## Is the service up?

`/api/health` answers `200` when the service and its database are working
and up to date, and `503` with one word (`database` or `migrations`) when
they are not. It shows no personal data.
