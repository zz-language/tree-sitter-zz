# tree-sitter-zz

Tree-sitter grammar for the [ZZ programming language](https://github.com/zz-language/zz).

Docs: <https://zz-lang.pages.dev>.

## Use

```bash
bun install
bunx tree-sitter generate   # builds src/
bunx tree-sitter test       # runs test/corpus
```

Neovim (nvim-treesitter):

```lua
vim.filetype.add({ extension = { zz = "zz" } })
-- point the `zz` parser at this repo, then `:TSInstall zz`
```

The `queries/` folder (highlights, folds, indents) is mirrored in
`../nvim/zz-lang.nvim/queries/zz/` — keep both in sync.

## GitHub language statistics (Linguist)

GitHub's language breakdown comes from
[github-linguist/linguist](https://github.com/github-linguist/linguist).
To make `.zz` files count as ZZ:

1. Fork `github-linguist/linguist`.
2. In `lib/linguist/languages.yml`, add (alphabetical, under `Z`):

```yaml
ZZ:
  type: programming
  color: "#7B61FF"
  extensions:
    - ".zz"
  tm_scope: source.zz
  ace_mode: text
  language_id: 123456789  # request a real id in your PR description
```

3. Add samples: `samples/ZZ/hello.zz`, `samples/ZZ/server.zz`
   (take them from `test/corpus/basics.txt` sources above).
4. Open the PR titled "Add ZZ language". Linguist requires the language to
   be in use on GitHub already — push `tree-sitter-zz` and a few `.zz`
   repos first, and link them in the PR.

Notes:
- `color` must not collide with an existing language color; if CI
  complains, pick another and update `vscode/zz-vscode` icon + docs.
- `language_id` must be unique — ask the maintainers for one in the PR.

## License

MIT
