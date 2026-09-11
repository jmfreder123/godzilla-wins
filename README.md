# Godzilla Wins run sheet

Public run sheet page for the Godzilla Wins Saturday show, hosted on GitHub Pages.

- Every headline links to the news story it came from.
- Anyone can leave a comment or add a story under any segment (name only, no login).
- Comments are stored in a Google Sheet through a small Apps Script (`apps-script/Code.gs`).

## Adding a new week

1. Copy `data/shows/2026-09-12.json` to `data/shows/YYYY-MM-DD.json` and edit it.
2. Add the new show to the top of `data/shows/index.json`. The first entry is the one the page opens to; older shows stay available from the dropdown.

Comments are kept separately for each show date.

## Moderating comments

Open the comments Google Sheet and type `TRUE` in the `hidden` column of any row. It disappears from the page on the next load.

## Comments backend setup

1. Create a Google Sheet (sheets.new). Name it "Godzilla Wins comments".
2. Extensions > Apps Script. Replace the code with `apps-script/Code.gs` and save.
3. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy and authorize.
4. Copy the web app URL (ends in `/exec`) into `assets/config.js`.
