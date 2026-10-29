# Local application fonts

`app/layout.tsx` loads these files with `next/font/local`. Builds and development
do not download fonts; the browser receives emitted fonts from this application.
Keep `--font-prompt` and `--font-radio-canada` unchanged for the existing CSS.

| Files | Weight / style | Upstream version |
| --- | --- | --- |
| `prompt/Prompt-Regular.woff2` | 400 normal | 1.001 |
| `prompt/Prompt-Medium.woff2` | 500 normal | 1.001 |
| `prompt/Prompt-SemiBold.woff2` | 600 normal | 1.001 |
| `prompt/Prompt-Bold.woff2` | 700 normal | 1.001 |
| `radio-canada/RadioCanada-Variable.woff2` | Variable 300–700 normal | 2.104 |

Sources were obtained from the [Google Fonts Prompt directory](https://github.com/google/fonts/tree/main/ofl/prompt)
and [Radio Canada directory](https://github.com/google/fonts/tree/main/ofl/radiocanada)
on 2026-10-29. Both families include their upstream SIL Open Font License 1.1
and copyright notice in their respective `OFL.txt` files.

The full upstream TTF files were converted losslessly to WOFF2 using FontTools
4.68.0 and Brotli 1.2.1 (`TTFont(...); font.flavor = "woff2"; font.save(...)`).
These are asset preparation tools, not application dependencies. No build-time
conversion or download is needed. Font versions and sample glyph advance widths
match the previous successful Google-font build.

Full glyph coverage preserves the Philippine peso sign and extended characters
that were previously served through additional Google-font subsets. Radio Canada
retains its weight axis (300–700, default 400) and width axis (75–100, default 100).
Normal width remains the application default. There are no typography/CSS usage
changes: the body and `.font-body` use Radio Canada; `.font-heading` uses Prompt.

SHA-256:

```text
40f025b5e6ff1e5c03476494473e64c524eb752e9858a2e2d9242fcff0182459  prompt/Prompt-Regular.woff2
e6d7dcf48fc8c4e4b45ce1b9849805cac3197d9dfdd0f8090c74542a4d9266d2  prompt/Prompt-Medium.woff2
c4402b86929dfa5f6014ea5370e8ed273e6b62f7d694bdb2c23845e864144903  prompt/Prompt-SemiBold.woff2
48d8f3b74735fcfc6c5641d8d21b7a703d8612196f8d50057194e47fbc8228b6  prompt/Prompt-Bold.woff2
406d3891e7b68d295a1ba526a82a1e2ead4db3c895eeee440c18bef4e3b43855  radio-canada/RadioCanada-Variable.woff2
```
