# Contract pages

Each file here is one public guide page at `/contracts/<slug>` (English) or
`/es/contracts/<slug>` (Spanish). The file name is `<slug>.en.md` or
`<slug>.es.md`; both languages use the same slug. Edit the wording freely: the
site reads these files when it is built, so a change goes live with the next
deployment.

The list of pages, their contract types and the index groups is in
`src/lib/contract-pages.ts`. A test fails if a contract type in the catalogue has
no page in both languages, or if a page lacks a title, a description or its
questions.

## Front matter

Between the two `---` lines at the top. Every text value is written in double
quotes; a double quote inside the text is written `\"`.

```
---
contractType: "NDA"
title: "NDA template: mutual and one-way non-disclosure agreement"
description: "One or two sentences, 140 to 160 characters, for search results."
heading: "Non-disclosure agreement (NDA)"
summary: "The opening paragraph shown under the heading."
related: ["master-services-agreement", "ip-assignment-agreement"]
faq:
  - q: "A question people actually ask?"
    a: "A plain answer in two to four sentences."
---
```

- `title`: the search result title, about 50 to 60 characters, built around
  the words people search for. " | Dealroom" is added by the site.
- `description`: the search result text, about 140 to 160 characters.
- `related`: slugs of other pages (they become links at the end).
- `faq`: four or five questions. They are shown on the page and published as
  structured data.

## Body

Plain Markdown after the front matter: `##` and `###` headings, paragraphs,
lists (`-` or `1.`), `**bold**`, `*italic*`, `[links](/contracts/nda)` and
`` `code` ``. Do not add the "two ways to make it" section, the price, the
related links, the questions or the closing note: the site adds those to every
page.

Writing rules: plain business English and Castilian Spanish (Spain), no
marketing tone, no long dashes (use commas, parentheses or a full stop). State
only what the skill itself contains.
