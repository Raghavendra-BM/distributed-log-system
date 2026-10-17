<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Never name a source folder `logs` (it is gitignored, so Tailwind skips scanning it); log UI lives in `src/components/explorer`.
- All data fetching goes through `src/lib/api.ts`, which switches between the REST collector and the in-browser mock (`src/lib/mock.ts`) by data mode; keeps one place to explain and change.
